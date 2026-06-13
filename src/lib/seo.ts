import type { JobRow, DepartmentRow, StateRow } from './db';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function toIsoDateTime(date: string): string {
  // Input: "YYYY-MM-DD" from D1; output: "YYYY-MM-DDT00:00:00"
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00` : date;
}

function parseSalaryNumber(salary: string): number | null {
  const m = salary.match(/\d[\d,]*/);
  if (!m) return null;
  const n = parseInt(m[0].replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export interface JobPostingSchema {
  '@context': 'https://schema.org/';
  '@type': 'JobPosting';
  title: string;
  description: string;
  identifier?: { '@type': 'PropertyValue'; name: string; value: string };
  datePosted: string;
  validThrough?: string;
  employmentType: 'FULL_TIME';
  hiringOrganization?: { '@type': 'Organization'; name: string };
  jobLocation?: {
    '@type': 'Place';
    address: {
      '@type': 'PostalAddress';
      addressLocality?: string;
      addressRegion?: string;
      addressCountry: 'IN';
    };
  };
  baseSalary?: {
    '@type': 'MonetaryAmount';
    currency: 'INR';
    value: { '@type': 'QuantitativeValue'; value: number; unitText: 'MONTH' };
  };
}

export function buildJobPostingSchema(
  job: JobRow,
  dept: DepartmentRow | null,
  state: StateRow | null,
): JobPostingSchema {
  const descriptionSource = job.description ? stripHtml(job.description) : `${job.title}${dept ? ' — ' + dept.name : ''}`;
  const description = descriptionSource.length > 500 ? descriptionSource.slice(0, 500) : descriptionSource;

  const schema: JobPostingSchema = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description,
    datePosted: job.created_at,
    employmentType: 'FULL_TIME',
  };

  if (dept) {
    schema.identifier = { '@type': 'PropertyValue', name: dept.name, value: job.slug };
    schema.hiringOrganization = { '@type': 'Organization', name: dept.name };
  }

  if (job.last_date) {
    schema.validThrough = toIsoDateTime(job.last_date);
  }

  if (job.location || state) {
    schema.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'IN',
        ...(job.location ? { addressLocality: job.location } : {}),
        ...(state ? { addressRegion: state.name } : {}),
      },
    };
  }

  if (job.salary) {
    const n = parseSalaryNumber(job.salary);
    if (n !== null) {
      schema.baseSalary = {
        '@type': 'MonetaryAmount',
        currency: 'INR',
        value: { '@type': 'QuantitativeValue', value: n, unitText: 'MONTH' },
      };
    }
  }

  return schema;
}
