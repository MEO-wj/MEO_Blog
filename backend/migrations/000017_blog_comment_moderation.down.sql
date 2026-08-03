DROP INDEX IF EXISTS idx_blog_comments_moderation;

ALTER TABLE blog_comments
DROP CONSTRAINT IF EXISTS blog_comments_moderation_status_check;

ALTER TABLE blog_comments
DROP COLUMN IF EXISTS reviewed_at,
DROP COLUMN IF EXISTS moderation_status;