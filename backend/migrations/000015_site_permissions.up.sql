CREATE TABLE site_permissions (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO site_permissions (key, enabled)
VALUES
    ('github', true),
    ('resume', true),
    ('guestbook', true),
    ('blog', true),
    ('favorites', true)
ON CONFLICT (key) DO NOTHING;
