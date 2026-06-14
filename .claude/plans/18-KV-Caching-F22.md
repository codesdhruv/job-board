# F-22 KV Caching Layer — Implementation Plan

## Context
F-22 adds a Cloudflare KV cache in front of D1 on the high-traffic listing pages (`/jobs` and `/state/[slug]`). Cache TTL is 5 minutes for listings, 10 minutes for type counts. All caches are invalidated on any admin write (admin wiring deferred to later prompts). Job detail pages and admin pages are never cached.

## Status of `src/lib/kv.ts`
**Already complete.** Both functions exist and are correct:
- `getListingCached<T>(kv, key, fetchFn, ttlSeconds=300)` — cache-aside, falls through on KV errors
- `invalidateAllListingCaches(kv)` — paginated `kv.list({ prefix: 'jobs:' })` + delete

No changes needed to this file.

---

## Changes Required

### 1. `src/pages/jobs/index.astro`

Add at the top of the frontmatter (after existing imports):
```ts
import { getListingCached } from '../../lib/kv';
const kv = (env as any).KV as KVNamespace;
const page = parseInt(Astro.url.searchParams.get('page') ?? '1', 10);
```

Cache key builder (after all filter params are resolved):
```ts
function buildListingKey(): string {
  const parts = ['jobs'];
  if (activeState)    { parts.push('state',    activeState); }
  if (activeType)     { parts.push('type',      activeType); }
  if (activeCategory) { parts.push('category',  activeCategory); }
  if (!activeState && !activeType && !activeCategory) parts.push('all');
  parts.push(`p${page}`);
  return parts.join(':');
}
```

Key scheme matches spec exactly:
- No filters → `jobs:all:p1`
- Type only → `jobs:type:government:p1`
- State + type → `jobs:state:uttar-pradesh:type:government:p1`
- Category only → `jobs:category:engineering:p1`

**Jobs query:** Skip caching when `activeQuery` is set (keyword search results are unique). Otherwise wrap in `getListingCached`.

**Counts query:** Wrap with `counts:all` key and 600s (10-min) TTL.

---

### 2. `src/pages/state/[slug].astro`

Add imports + page param. Wrap jobs query with key `jobs:state:{slug}:p{page}`, TTL 300s.  
The state row lookup (`SELECT id, name, slug`) is NOT cached — needed live for 404 detection.

---

## Files Changed
- `src/pages/jobs/index.astro`
- `src/pages/state/[slug].astro`

## Files NOT Changed
- `src/lib/kv.ts` — already complete
- `src/pages/jobs/[slug].astro` — spec excludes detail pages
- Any admin pages — never cached

---

## Verification
1. `npm run build` passes
2. `npx wrangler dev` → `/jobs` — cache miss, D1 queried
3. `/jobs` again — cache hit, D1 skipped
4. `/state/all-india` — same miss-then-hit pattern
5. `?type=government` etc. each get their own cache slot
6. `?q=clerk` bypasses cache — D1 queried every time
