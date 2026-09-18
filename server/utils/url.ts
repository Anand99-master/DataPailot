import { Request } from 'express';

/**
 * Derives the canonical base application URL for generating verification and reset links.
 * Prefers explicitly configured APP_URL, then reverse-proxy headers, then request host, then localhost.
 */
export function getAppUrl(req?: Request): string {
  if (process.env.APP_URL && process.env.APP_URL.trim().length > 0) {
    return process.env.APP_URL.trim().replace(/\/+$/, '');
  }

  if (req) {
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
    const host = (req.headers['x-forwarded-host'] as string) || req.get('host');
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  }

  const port = process.env.PORT || 3000;
  return `http://localhost:${port}`;
}
