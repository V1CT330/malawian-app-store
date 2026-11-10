-- Allow public profile avatars to be read from the private app-assets bucket.
-- profiles is intentionally private (users can read only their own row), so using
-- it in a Storage SELECT policy prevents other members from signing avatar URLs.
-- profile_cards has a public SELECT policy for active profiles and is the safe
-- public lookup source for avatar object paths.
drop policy if exists app_assets_read_published_assets on storage.objects;

create policy app_assets_read_published_assets
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'app-assets'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or has_role((select auth.uid()), 'admin'::app_role)
    or exists (
      select 1
      from public.listings l
      where l.status = 'published'
        and (
          l.icon_url = objects.name
          or l.banner_url = objects.name
          or l.video_url = objects.name
          or objects.name = any(l.screenshots)
          or objects.name = any(l.promo_images)
        )
    )
    or exists (
      select 1
      from public.listing_versions v
      join public.listings l on l.id = v.listing_id
      where v.file_url = objects.name
        and v.status = any(array['released', 'published'])
        and l.status = 'published'
    )
    or exists (
      select 1
      from public.profile_cards p
      where p.avatar_url = objects.name
        and p.suspended = false
    )
  )
);
