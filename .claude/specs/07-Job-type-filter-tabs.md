Implement F-03: add job type filter tabs to src/pages/jobs/index.astro

- Read ?type= query param server-side in Astro.url.searchParams
- Add WHERE jt.slug = ? to the D1 query when type param is present
- Render tabs: All | Government | PSU/Semi-Govt | Private | Freelance/Gig
- Active tab highlighted (add active class or inline style)
- Tab links preserve other existing query params
- Show job count per tab using the counts query from F-03 spec
- Run `wrangler dev`, test each tab, confirm counts and filtering work