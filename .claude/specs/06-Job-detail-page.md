Implement F-02: create src/pages/jobs/[slug].astro

- Use the exact SQL from F-02 in the spec
- If slug not found or is_published = 0 → return 404 (Astro.response.status = 404)
- If last_date is past → render page but show "Applications closed" banner, hide apply button
- Apply button logic per F-02: apply_url → external link, apply_email → mailto, both null → text message
- Similar jobs sidebar query per F-02 spec (same category, max 5)
- Run `wrangler dev`, visit a valid slug and an invalid slug, confirm both work correctly