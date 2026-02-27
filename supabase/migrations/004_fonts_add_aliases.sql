-- Add font_aliases column to store all name variants a DOCX might reference.
-- This allows the frontend to create @font-face rules matching any name the DOCX uses.
ALTER TABLE fonts ADD COLUMN IF NOT EXISTS font_aliases JSONB NOT NULL DEFAULT '[]';
