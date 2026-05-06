import { startMemoryServer, stopMemoryServer, getApp } from '../integration-setup.js';

let app: Awaited<ReturnType<typeof getApp>>;

beforeAll(async () => {
  await startMemoryServer();
  app = await getApp();
});

afterAll(async () => {
  await stopMemoryServer();
});

describe('GET /api/health', () => {
  it('responds with status ok', async () => {
    const request = (await import('supertest')).default;
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });
});
