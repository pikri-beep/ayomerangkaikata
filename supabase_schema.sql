-- =======================================================
-- Skrip Setup Database Supabase untuk Ayo Merangkai Kata
-- Salin dan jalankan skrip ini di menu SQL Editor di Supabase
-- =======================================================

-- 1. Tabel Kata Kustom (custom_words)
CREATE TABLE IF NOT EXISTS public.custom_words (
  id TEXT PRIMARY KEY,
  word TEXT NOT NULL,
  phonetic TEXT,
  syllables JSONB,
  hint TEXT,
  category TEXT,
  level TEXT,
  emoji TEXT,
  updated_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

-- Enable RLS & Izinkan Akses Publik (Read & Write)
ALTER TABLE public.custom_words ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read custom_words" ON public.custom_words;
CREATE POLICY "Public read custom_words" ON public.custom_words FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert custom_words" ON public.custom_words;
CREATE POLICY "Public insert custom_words" ON public.custom_words FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update custom_words" ON public.custom_words;
CREATE POLICY "Public update custom_words" ON public.custom_words FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public delete custom_words" ON public.custom_words;
CREATE POLICY "Public delete custom_words" ON public.custom_words FOR DELETE USING (true);


-- 2. Tabel Metadata Rekaman Audio (custom_audio_meta)
CREATE TABLE IF NOT EXISTS public.custom_audio_meta (
  key TEXT PRIMARY KEY,
  label TEXT,
  mime_type TEXT,
  size INTEGER,
  storage_path TEXT,
  public_url TEXT,
  updated_at BIGINT DEFAULT (EXTRACT(epoch FROM NOW()) * 1000)::BIGINT
);

-- Enable RLS & Izinkan Akses Publik (Read & Write)
ALTER TABLE public.custom_audio_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read audio_meta" ON public.custom_audio_meta;
CREATE POLICY "Public read audio_meta" ON public.custom_audio_meta FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert audio_meta" ON public.custom_audio_meta;
CREATE POLICY "Public insert audio_meta" ON public.custom_audio_meta FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update audio_meta" ON public.custom_audio_meta;
CREATE POLICY "Public update audio_meta" ON public.custom_audio_meta FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public delete audio_meta" ON public.custom_audio_meta;
CREATE POLICY "Public delete audio_meta" ON public.custom_audio_meta FOR DELETE USING (true);


-- 3. Storage Bucket untuk Rekaman Audio (custom_audio)
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom_audio', 'custom_audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Kebijakan Akses Storage Bucket (Public Read & Write)
DROP POLICY IF EXISTS "Public Access Audio Read" ON storage.objects;
CREATE POLICY "Public Access Audio Read" ON storage.objects
  FOR SELECT USING (bucket_id = 'custom_audio');

DROP POLICY IF EXISTS "Public Access Audio Insert" ON storage.objects;
CREATE POLICY "Public Access Audio Insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'custom_audio');

DROP POLICY IF EXISTS "Public Access Audio Update" ON storage.objects;
CREATE POLICY "Public Access Audio Update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'custom_audio');

DROP POLICY IF EXISTS "Public Access Audio Delete" ON storage.objects;
CREATE POLICY "Public Access Audio Delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'custom_audio');
