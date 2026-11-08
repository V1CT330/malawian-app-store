-- Add nested replies and optional voice attachments to Social comments.
-- Existing text-only comments remain valid and unchanged.
ALTER TABLE public.social_post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;

ALTER TABLE public.social_post_comments DROP CONSTRAINT IF EXISTS social_post_comments_body_check;
ALTER TABLE public.social_post_comments ADD CONSTRAINT social_post_comments_body_check
  CHECK (
    char_length(btrim(body)) BETWEEN 1 AND 1000
    OR (char_length(btrim(body)) = 0 AND media_type = 'audio' AND media_url IS NOT NULL)
  );

ALTER TABLE public.social_post_comments DROP CONSTRAINT IF EXISTS social_post_comments_media_type_check;
ALTER TABLE public.social_post_comments ADD CONSTRAINT social_post_comments_media_type_check
  CHECK (media_type IS NULL OR media_type = 'audio');

ALTER TABLE public.social_post_comments DROP CONSTRAINT IF EXISTS social_post_comments_media_pair_check;
ALTER TABLE public.social_post_comments ADD CONSTRAINT social_post_comments_media_pair_check
  CHECK ((media_url IS NULL AND media_type IS NULL) OR (media_url IS NOT NULL AND media_type = 'audio'));

ALTER TABLE public.social_post_comments DROP CONSTRAINT IF EXISTS social_post_comments_parent_same_post_unique;
ALTER TABLE public.social_post_comments ADD CONSTRAINT social_post_comments_parent_same_post_unique UNIQUE (id, post_id);

ALTER TABLE public.social_post_comments DROP CONSTRAINT IF EXISTS social_post_comments_parent_post_fkey;
ALTER TABLE public.social_post_comments ADD CONSTRAINT social_post_comments_parent_post_fkey
  FOREIGN KEY (parent_comment_id, post_id)
  REFERENCES public.social_post_comments (id, post_id)
  ON DELETE CASCADE;

ALTER TABLE public.social_post_comments DROP CONSTRAINT IF EXISTS social_post_comments_parent_not_self_check;
ALTER TABLE public.social_post_comments ADD CONSTRAINT social_post_comments_parent_not_self_check
  CHECK (parent_comment_id IS NULL OR parent_comment_id <> id);

CREATE INDEX IF NOT EXISTS social_comments_post_parent_idx
  ON public.social_post_comments (post_id, parent_comment_id, created_at);

UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT mime_type
  FROM unnest(
    COALESCE(allowed_mime_types, ARRAY[]::text[])
    || ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/wav']::text[]
  ) AS mime_type
  ORDER BY mime_type
)
WHERE id = 'social-media';
