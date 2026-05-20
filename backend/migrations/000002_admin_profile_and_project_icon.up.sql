ALTER TABLE projects ADD COLUMN IF NOT EXISTS icon_url TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#24c9f4';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ready';

CREATE TABLE IF NOT EXISTS admin_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL DEFAULT 'MEO',
    email TEXT,
    bio TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO admin_profile (display_name, email) VALUES ('MEO', '')
ON CONFLICT DO NOTHING;
