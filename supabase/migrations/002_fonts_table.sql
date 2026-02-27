-- Fonts table: tracks uploaded custom font files
CREATE TABLE IF NOT EXISTS fonts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    family TEXT NOT NULL DEFAULT '',
    filename TEXT NOT NULL,
    file_storage_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'font/ttf',
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE fonts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view fonts
CREATE POLICY "Authenticated users can view fonts"
    ON fonts FOR SELECT
    TO authenticated
    USING (true);

-- Users can insert their own fonts
CREATE POLICY "Users can insert own fonts"
    ON fonts FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Users can delete their own fonts
CREATE POLICY "Users can delete own fonts"
    ON fonts FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- Storage bucket for fonts (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('fonts', 'fonts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for fonts bucket
CREATE POLICY "Authenticated users can read fonts"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'fonts');

CREATE POLICY "Authenticated users can upload fonts"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'fonts');

CREATE POLICY "Users can delete own font files"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'fonts');
