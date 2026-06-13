Now extract the job row into a reusable component: src/components/JobCard.astro

- Fields to show per F-01: title, department name, job type badge, state name,
  vacancies, last_date (red if ≤7 days away), salary, "View Details →" link
- No styling framework — plain semantic HTML with inline style for the red date only
- Use it in jobs/index.astro
- Confirm /jobs still loads
-also test and verify task