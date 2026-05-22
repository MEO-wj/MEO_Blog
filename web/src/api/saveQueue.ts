type SaveStatus = 'saving' | 'saved' | 'failed';

interface SaveJob {
  id: string;
  label: string;
  status: SaveStatus;
  execute: () => Promise<unknown>;
  retryCount: number;
}

const MAX_RETRIES = 3;
const BACKOFF_BASE = 2000; // 2s, 4s, 8s

const jobs = new Map<string, SaveJob>();
const listeners = new Set<() => void>();
let cachedSnapshot: SaveJob[] = [];
let snapshotDirty = true;

function notify() {
  snapshotDirty = true;
  for (const fn of listeners) fn();
}

const processing = new Set<string>();

async function processJob(job: SaveJob) {
  if (processing.has(job.id)) return;
  processing.add(job.id);
  try {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        await job.execute();
        job.status = 'saved';
        job.retryCount = attempt;
        notify();
        setTimeout(() => {
          jobs.delete(job.id);
          notify();
        }, 2000);
        return;
      } catch {
        job.retryCount = attempt + 1;
        notify();
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, BACKOFF_BASE * Math.pow(2, attempt)));
        }
      }
    }
    job.status = 'failed';
    notify();
  } finally {
    processing.delete(job.id);
  }
}

export const saveQueue = {
  enqueue(opts: { id: string; label: string; execute: () => Promise<unknown> }): string {
    const job: SaveJob = {
      id: opts.id,
      label: opts.label,
      status: 'saving',
      execute: opts.execute,
      retryCount: 0,
    };
    jobs.set(job.id, job);
    notify();
    processJob(job);
    return job.id;
  },

  retry(id: string) {
    const job = jobs.get(id);
    if (!job || job.status !== 'failed') return;
    job.status = 'saving';
    job.retryCount = 0;
    notify();
    processJob(job);
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },

  getSnapshot(): SaveJob[] {
    if (snapshotDirty) {
      cachedSnapshot = Array.from(jobs.values());
      snapshotDirty = false;
    }
    return cachedSnapshot;
  },

  remove(id: string) {
    jobs.delete(id);
    notify();
  },
};
