export function getDb(locals: App.Locals): D1Database {
  const db = locals.runtime?.env?.DB;
  if (!db) throw new Error('D1 binding "DB" is not available on locals.runtime.env');
  return db;
}

export interface JobTypeRow {
  id: number;
  name: string;
  slug: string;
}

export interface StateRow {
  id: number;
  name: string;
  slug: string;
  is_union_territory: number;
}

export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
}

export interface DepartmentRow {
  id: number;
  name: string;
  logo_r2_key: string | null;
}

export interface AdminRow {
  id: number;
  username: string;
  password_hash: string;
  created_at: string;
}

export interface JobRow {
  id: number;
  slug: string;
  title: string;
  department_id: number | null;
  job_type_id: number | null;
  category_id: number | null;
  state_id: number | null;
  location: string | null;
  vacancies: number | null;
  qualification: string | null;
  age_limit: string | null;
  salary: string | null;
  last_date: string;
  apply_url: string | null;
  apply_email: string | null;
  description: string | null;
  is_published: number;
  created_at: string;
  updated_at: string | null;
}
