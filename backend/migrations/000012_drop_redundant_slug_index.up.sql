-- Remove redundant index on slug; the UNIQUE constraint already maintains its own index
DROP INDEX IF EXISTS idx_projects_slug;
