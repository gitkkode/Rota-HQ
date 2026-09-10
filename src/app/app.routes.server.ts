import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'auth/login', renderMode: RenderMode.Prerender },
  { path: 'auth/register', renderMode: RenderMode.Prerender },
  { path: 'auth/forgot-password', renderMode: RenderMode.Prerender },
  { path: 'organizations/:id', renderMode: RenderMode.Client },
  { path: 'subscriptions/:id', renderMode: RenderMode.Client },
  { path: 'plans/:id', renderMode: RenderMode.Client },
  { path: 'plans/:id/edit', renderMode: RenderMode.Client },
  { path: 'permissions/:id', renderMode: RenderMode.Client },
  { path: 'usage/:orgId', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
