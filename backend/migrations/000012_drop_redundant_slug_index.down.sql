-- Restore the redundant slug index
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects (slug);
