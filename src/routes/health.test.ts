import request from 'supertest';
import { app } from '../app.js';

describe('GET /api/health', () => {
  it('responds with status ok and timestamp', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });
});
