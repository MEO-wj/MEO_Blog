ALTER TABLE blog_comments
ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'published',
ADD COLUMN reviewed_at TIMESTAMPTZ;

ALTER TABLE blog_comments
ALTER COLUMN moderation_status SET DEFAULT 'pending';

ALTER TABLE blog_comments
ADD CONSTRAINT blog_comments_moderation_status_check
CHECK (moderation_status IN ('pending', 'published'));

CREATE INDEX idx_blog_comments_moderation
ON blog_comments(moderation_status, created_at DESC);