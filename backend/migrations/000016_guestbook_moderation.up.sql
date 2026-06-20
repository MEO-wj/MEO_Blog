ALTER TABLE guestbook_messages
ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'published',
ADD COLUMN reviewed_at TIMESTAMPTZ;

ALTER TABLE guestbook_messages
ADD CONSTRAINT guestbook_messages_moderation_status_check
CHECK (moderation_status IN ('pending', 'published'));

CREATE INDEX idx_guestbook_messages_moderation
ON guestbook_messages(moderation_status, created_at DESC);
