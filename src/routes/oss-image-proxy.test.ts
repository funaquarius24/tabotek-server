import { vi } from 'vitest';
vi.mock('../../lib/oss.js', () => ({
  signUrl: vi.fn(() => 'https://signed-url.example.com/path'),
}));
import request from 'supertest';
import { app } from '../app.js';

describe('GET /api/oss/image-proxy', () => {
  it('redirects with signed URL for valid path', async () => {
    const res = await request(app).get('/api/oss/image-proxy?path=uploads/test.jpg');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('signed-url');
  });

  it('rejects missing path', async () => {
    const res = await request(app).get('/api/oss/image-proxy');
    expect(res.status).toBe(400);
  });

  it('rejects invalid path', async () => {
    const res = await request(app).get('/api/oss/image-proxy?path=invalid/path');
    expect(res.status).toBe(400);
  });
});
