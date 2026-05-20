-- Guestbook / Message Wall
CREATE TABLE guestbook_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nickname TEXT NOT NULL,
    avatar_url TEXT DEFAULT '',
    content TEXT NOT NULL,
    ip_address INET,
    parent_id UUID REFERENCES guestbook_messages(id) ON DELETE CASCADE,
    is_admin_reply BOOLEAN NOT NULL DEFAULT false,
    admin_display_name TEXT DEFAULT '',
    admin_avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guestbook_messages_parent ON guestbook_messages(parent_id);
CREATE INDEX idx_guestbook_messages_created ON guestbook_messages(created_at DESC);
