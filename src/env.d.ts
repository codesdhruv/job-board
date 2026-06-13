/// <reference types="astro/client" />

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  ADMIN_SECRET: string;
  SITE_URL: string;
}

declare namespace App {
  interface Locals extends Runtime {}
}
