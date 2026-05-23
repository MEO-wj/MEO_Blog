type SaveStatus = "saving" | "saved" | "failed";

interface SaveJob {
  id: string;
  label: string;
  status: SaveStatus;
  execute: () => Promise<unknown>;
  retryCount: number;
  version: number;
  onComplete?: () => void;
  onError?: (err: unknown) => void;
}

const MAX_RETRIES = 3;
const BACKOFF_BASE = 2000;

const jobs = new Map<string, SaveJob>();
const listeners = new Set<() => void>();
const processing = new Set<string>();
let cachedSnapshot: SaveJob[] = [];
let snapshotDirty = true;

function notify() {
  snapshotDirty = true;
  for (const fn of listeners) fn();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processJob(id: string) {
  if (processing.has(id)) return;
  processing.add(id);

  try {
    while (true) {
      const job = jobs.get(id);
      if (!job) return;

      const runVersion = job.version;
      job.status = "saving";
      job.retryCount = 0;
      notify();

      let lastError: unknown = null;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          await job.execute();
          const latest = jobs.get(id);
          if (!latest) return;

          // A newer save for the same id arrived while this request was in flight.
          if (latest.version !== runVersion) break;

          latest.status = "saved";
          latest.retryCount = attempt;
          notify();
          latest.onComplete?.();
          window.setTimeout(() => {
            const current = jobs.get(id);
            if (current?.version === runVersion && current.status === "saved") {
              jobs.delete(id);
              notify();
            }
          }, 2000);
          return;
        } catch (err) {
          lastError = err;
          const latest = jobs.get(id);
          if (!latest) return;
          if (latest.version !== runVersion) break;

          console.error(`[saveQueue] ${job.label} attempt ${attempt + 1} failed:`, err);
          latest.retryCount = attempt + 1;
          notify();
          if (attempt < MAX_RETRIES) {
            await delay(BACKOFF_BASE * Math.pow(2, attempt));
          }
        }
      }

      const latest = jobs.get(id);
      if (!latest) return;
      if (latest.version !== runVersion) {
        continue;
      }

      latest.status = "failed";
      notify();
      latest.onError?.(lastError ?? new Error("save failed after retries"));
      return;
    }
  } finally {
    processing.delete(id);
  }
}

export const saveQueue = {
  enqueue(opts: {
    id: string;
    label: string;
    execute: () => Promise<unknown>;
    onComplete?: () => void;
    onError?: (err: unknown) => void;
  }): string {
    const existing = jobs.get(opts.id);
    const job: SaveJob = {
      id: opts.id,
      label: opts.label,
      status: "saving",
      execute: opts.execute,
      retryCount: 0,
      version: (existing?.version ?? 0) + 1,
      onComplete: opts.onComplete,
      onError: opts.onError,
    };

    jobs.set(job.id, job);
    notify();
    void processJob(job.id);
    return job.id;
  },

  retry(id: string) {
    const job = jobs.get(id);
    if (!job || job.status !== "failed") return;
    job.status = "saving";
    job.retryCount = 0;
    job.version += 1;
    notify();
    void processJob(job.id);
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
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
