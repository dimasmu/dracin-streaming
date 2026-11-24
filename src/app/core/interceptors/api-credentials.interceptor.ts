import type { HttpInterceptorFn } from '@angular/common/http';

/** Ensures Better Auth session cookies and signed guest quota cookies are sent on API calls. */
export const apiCredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
    return next(req.clone({ withCredentials: true }));
  }
  return next(req);
};
