import { defineMiddleware } from 'astro:middleware';
import { env } from 'cloudflare:workers';
import { verifySession } from '../lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  if (!pathname.startsWith('/admin')) return next();
  if (pathname === '/admin/login') return next();

  const cookie = context.cookies.get('admin_session');
  if (!cookie) return context.redirect('/admin/login');

  const secret = (env as any).ADMIN_SECRET as string | undefined;
  if (!secret) throw new Error('ADMIN_SECRET is not configured');

  const payload = await verifySession(cookie.value, secret);
  if (!payload) {
    context.cookies.delete('admin_session', { path: '/' });
    return context.redirect('/admin/login');
  }

  return next();
});
