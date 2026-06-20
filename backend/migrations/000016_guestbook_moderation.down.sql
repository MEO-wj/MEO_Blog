DROP INDEX IF EXISTS idx_guestbook_messages_moderation;

ALTER TABLE guestbook_messages
DROP CONSTRAINT IF EXISTS guestbook_messages_moderation_status_check;

ALTER TABLE guestbook_messages
DROP COLUMN IF EXISTS reviewed_at,
DROP COLUMN IF EXISTS moderation_status;
