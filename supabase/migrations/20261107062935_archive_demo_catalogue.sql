-- Archive the fictional catalogue seeded by the initial demo-catalogue migration.
-- Preserve linked activity records; do not delete user data.
UPDATE public.listings
SET status = 'archived',
    downloads = 0,
    rating_avg = 0,
    rating_count = 0
WHERE developer_id IN (
  '11111111-1111-4111-8111-111111111101'::uuid,
  '11111111-1111-4111-8111-111111111102'::uuid,
  '11111111-1111-4111-8111-111111111103'::uuid,
  '11111111-1111-4111-8111-111111111104'::uuid,
  '11111111-1111-4111-8111-111111111105'::uuid,
  '11111111-1111-4111-8111-111111111106'::uuid,
  '11111111-1111-4111-8111-111111111107'::uuid,
  '11111111-1111-4111-8111-111111111108'::uuid
)
AND slug IN (
  'mzuni-notes',
  'malipo-pay',
  'nyasa-news',
  'chigwirizano-market',
  'moyo-health',
  'tili-transport',
  'kwacha-books',
  'warm-heart-tours'
);