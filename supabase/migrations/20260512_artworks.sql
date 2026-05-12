-- Table artworks
CREATE TABLE IF NOT EXISTS artworks (
  id          text        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_id   text        NOT NULL,
  sender_name text,
  image_url   text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE artworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read all artworks"
  ON artworks FOR SELECT TO authenticated USING (true);

CREATE POLICY "users can insert their own artworks"
  ON artworks FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid()::text);

-- Storage bucket public
INSERT INTO storage.buckets (id, name, public)
VALUES ('artworks', 'artworks', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "authenticated users can upload artworks"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artworks');

CREATE POLICY "artworks are publicly viewable"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'artworks');

-- Trigger push notification à chaque nouvel artwork
CREATE TRIGGER on_new_artwork
AFTER INSERT ON public.artworks
FOR EACH ROW
EXECUTE FUNCTION supabase_functions.http_request(
  'https://xymhisdmffdgarabglne.supabase.co/functions/v1/send-push',
  'POST',
  '{"Content-Type":"application/json"}',
  '{}',
  '5000'
);
