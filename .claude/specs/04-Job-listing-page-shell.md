Implement F-01 only: create src/pages/jobs/index.astro.

- Query D1 using the exact SQL from F-01 in the spec
- No filters yet — just fetch all published, non-expired jobs ordered by created_at DESC
- Render a plain list of job titles with last_date and slug
- No styling, no components yet
- Run `wrangler dev` and confirm the page loads at /jobs without errors
- Show me the output of wrangler dev