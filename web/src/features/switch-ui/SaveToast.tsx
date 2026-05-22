import { useSyncExternalStore } from "react";
import { saveQueue } from "../../api/saveQueue";

export function SaveToast() {
  const jobs = useSyncExternalStore(saveQueue.subscribe, saveQueue.getSnapshot);

  if (jobs.length === 0) return null;

  const saving = jobs.filter(j => j.status === 'saving');
  const failed = jobs.filter(j => j.status === 'failed');
  const saved = jobs.filter(j => j.status === 'saved');

  if (failed.length > 0) {
    const job = failed[0];
    return (
      <span
        className="admin-panel-msg admin-panel-msg-error admin-panel-msg-retry"
        onClick={() => saveQueue.retry(job.id)}
      >
        {job.label}失败，点击重试
      </span>
    );
  }

  if (saving.length > 0) {
    return (
      <span className="admin-panel-msg admin-panel-msg-saving">
        {saving[0].label}中...
      </span>
    );
  }

  if (saved.length > 0) {
    return (
      <span className="admin-panel-msg">
        {saved[0].label}成功
      </span>
    );
  }

  return null;
}
