import request from 'supertest';
import { app } from '../app.js';

describe('POST /api/oss/upload-url', () => {
  it('returns upload URL with valid data', async () => {
    const res = await request(app)
      .post('/api/oss/upload-url')
      .send({ filename: 'image.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uploadUrl');
    expect(res.body).toHaveProperty('publicUrl');
    expect(res.body).toHaveProperty('imageId');
  });

  it('rejects missing filename', async () => {
    const res = await request(app)
      .post('/api/oss/upload-url')
      .send({ contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
  });

  it('rejects invalid content type', async () => {
    const res = await request(app)
      .post('/api/oss/upload-url')
      .send({ filename: 'file.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
  });
});
