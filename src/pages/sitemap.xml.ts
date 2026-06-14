import { env } from 'cloudflare:workers';
import { getDb } from '../lib/db';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function GET(): Promise<Response> {
  const db = getDb();
  const base = ((env as any).SITE_URL ?? '').replace(/\/$/, '');

  const [jobsRes, statesRes, govtStatesRes, psuStatesRes, catsRes] = await Promise.all([
    db
      .prepare(
        `SELECT slug, COALESCE(updated_at, created_at) AS lastmod
         FROM jobs
         WHERE is_published = 1 AND last_date >= DATE('now')
         ORDER BY lastmod DESC`,
      )
      .all<{ slug: string; lastmod: string }>(),

    db
      .prepare(
        `SELECT DISTINCT s.slug
         FROM states s JOIN jobs j ON j.state_id = s.id
         WHERE j.is_published = 1 AND j.last_date >= DATE('now')`,
      )
      .all<{ slug: string }>(),

    db
      .prepare(
        `SELECT DISTINCT s.slug
         FROM states s
         JOIN jobs j ON j.state_id = s.id
         JOIN job_types jt ON j.job_type_id = jt.id
         WHERE j.is_published = 1 AND j.last_date >= DATE('now') AND jt.slug = 'government'`,
      )
      .all<{ slug: string }>(),

    db
      .prepare(
        `SELECT DISTINCT s.slug
         FROM states s
         JOIN jobs j ON j.state_id = s.id
         JOIN job_types jt ON j.job_type_id = jt.id
         WHERE j.is_published = 1 AND j.last_date >= DATE('now') AND jt.slug = 'psu'`,
      )
      .all<{ slug: string }>(),

    db
      .prepare(
        `SELECT DISTINCT c.slug
         FROM categories c JOIN jobs j ON j.category_id = c.id
         WHERE j.is_published = 1 AND j.last_date >= DATE('now')`,
      )
      .all<{ slug: string }>(),
  ]);

  const jobs = jobsRes.results ?? [];
  const states = statesRes.results ?? [];
  const govtStates = new Set((govtStatesRes.results ?? []).map((r) => r.slug));
  const psuStates = new Set((psuStatesRes.results ?? []).map((r) => r.slug));
  const cats = catsRes.results ?? [];

  const staticUrls = ['/', '/jobs', '/states', '/about', '/privacy-policy', '/terms', '/contact'];

  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticUrls.map((p) => `  <url><loc>${esc(base + p)}</loc></url>`),
    ...states.map((s) => `  <url><loc>${esc(`${base}/state/${s.slug}`)}</loc></url>`),
    ...states
      .filter((s) => govtStates.has(s.slug))
      .map((s) => `  <url><loc>${esc(`${base}/state/${s.slug}/government`)}</loc></url>`),
    ...states
      .filter((s) => psuStates.has(s.slug))
      .map((s) => `  <url><loc>${esc(`${base}/state/${s.slug}/psu`)}</loc></url>`),
    ...cats.map((c) => `  <url><loc>${esc(`${base}/category/${c.slug}`)}</loc></url>`),
    ...jobs.map((j) => {
      const lastmod = j.lastmod ? j.lastmod.slice(0, 10) : '';
      return [
        '  <url>',
        `    <loc>${esc(`${base}/jobs/${j.slug}`)}</loc>`,
        lastmod ? `    <lastmod>${lastmod}</lastmod>` : '',
        '    <changefreq>weekly</changefreq>',
        '    <priority>0.8</priority>',
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n');
    }),
    '</urlset>',
  ];

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
