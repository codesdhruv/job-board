import { env } from 'cloudflare:workers';
import { getDb } from '../lib/db';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(datetime: string): string {
  // D1 stores DATETIME as "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS"
  const normalized = datetime.replace(' ', 'T');
  const d = new Date(normalized.includes('Z') ? normalized : normalized + 'Z');
  return d.toUTCString().replace('GMT', '+0000');
}

export async function GET(): Promise<Response> {
  const db = getDb();
  const base = ((env as any).SITE_URL ?? '').replace(/\/$/, '');

  const res = await db
    .prepare(
      `SELECT j.slug, j.title, j.last_date, j.vacancies, j.created_at,
              s.name AS state_name, d.name AS dept_name
       FROM jobs j
       LEFT JOIN states s ON j.state_id = s.id
       LEFT JOIN departments d ON j.department_id = d.id
       WHERE j.is_published = 1 AND j.last_date >= DATE('now')
       ORDER BY j.created_at DESC
       LIMIT 50`,
    )
    .all<{
      slug: string;
      title: string;
      last_date: string;
      vacancies: number | null;
      created_at: string;
      state_name: string | null;
      dept_name: string | null;
    }>();

  const jobs = res.results ?? [];
  const buildDate = new Date().toUTCString().replace('GMT', '+0000');

  const items = jobs
    .map((j) => {
      const itemTitle = j.dept_name ? `${j.title} — ${j.dept_name}` : j.title;
      const link = `${base}/jobs/${j.slug}`;
      const desc =
        `${j.vacancies != null ? j.vacancies : 'See post for'} vacancies. ` +
        `Last date: ${j.last_date}. ` +
        `State: ${j.state_name ?? 'All India'}.`;
      const pubDate = toRfc822(j.created_at);
      return [
        '    <item>',
        `      <title>${esc(itemTitle)}</title>`,
        `      <link>${esc(link)}</link>`,
        `      <description>${esc(desc)}</description>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <guid>${esc(link)}</guid>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>SarkariNaukriBoard — Latest Jobs</title>
    <link>${esc(base)}</link>
    <description>Latest government and private sector job listings</description>
    <lastBuildDate>${buildDate}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
