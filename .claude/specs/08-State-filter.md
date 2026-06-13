Implement F-04: add state filter dropdown to src/pages/jobs/index.astro

- Read ?state= query param server-side
- Add WHERE s.slug = ? to D1 query when state param is present
- Fetch all states from DB: SELECT id, name, slug, is_union_territory FROM states ORDER BY is_union_territory, name
- Render as <select> with two <optgroup>: "States" and "Union Territories"
- "All India" as first <option> outside both groups
- When active type tab is Government or PSU: move state dropdown above category, add label "Select your state"
- Selecting state sets ?state={slug} in URL, preserves other params
- Run `wrangler dev`, test state filter alone and combined with type tab