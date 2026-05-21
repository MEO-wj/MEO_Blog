ALTER TABLE projects ADD COLUMN sort_order INT NOT NULL DEFAULT 0;
UPDATE projects SET sort_order = row_number FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY pinned DESC, created_at DESC) - 1 AS row_number
  FROM projects
) sub WHERE projects.id = sub.id;
