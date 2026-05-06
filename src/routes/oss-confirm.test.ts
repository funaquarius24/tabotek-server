import { vi } from 'vitest';
vi.mock('../../lib/oss.js', () => ({
  confirmUpload: vi.fn(() => Promise.resolve()),
}));
import request from 'supertest';
import { app } from '../app.js';

describe('POST /api/oss/confirm', () => {
  it('confirms upload with valid imageId', async () => {
    const res = await request(app)
      .post('/api/oss/confirm')
      .send({ imageId: 'test-image-id' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('rejects missing imageId', async () => {
    const res = await request(app)
      .post('/api/oss/confirm')
      .send({});

    expect(res.status).toBe(400);
  });
});
