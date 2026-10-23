import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('API Health and Public Routes', () => {
  it('GET /api/health should return ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toContain('InvoiceFlow');
  });

  it('GET /api/auth/me should return 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/invoices should return 401 when unauthenticated', async () => {
    const res = await request(app).get('/api/invoices');
    expect(res.status).toBe(401);
  });

  it('GET unknown route should return 404', async () => {
    const res = await request(app).get('/api/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
