import { getServiceClient } from '../lib/supabase.js';
import { env } from '../config/env.js';

const buckets = [
  { name: env.storage.topicBucket, public: false },
  { name: env.storage.uploadBucket, public: false },
];

async function main() {
  if (!env.supabase.url || !env.supabase.serviceRoleKey) {
    console.error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to create storage buckets.',
    );
    process.exit(1);
  }

  const client = getServiceClient();
  for (const bucket of buckets) {
    const { data: existing } = await client.storage.getBucket(bucket.name);
    if (existing) {
      console.log(`[storage] bucket already exists: ${bucket.name}`);
      continue;
    }

    const { error } = await client.storage.createBucket(bucket.name, {
      public: bucket.public,
    });

    if (error && !/already exists|duplicate/i.test(error.message || '')) {
      throw new Error(`${bucket.name}: ${error.message}`);
    }

    console.log(`[storage] created bucket: ${bucket.name} (public=${bucket.public})`);
  }

  console.log('[storage] Done.');
}

main().catch((error) => {
  console.error('[storage] Failed:', error.message);
  process.exitCode = 1;
});
