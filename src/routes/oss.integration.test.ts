import { startMemoryServer, stopMemoryServer, getApp } from '../integration-setup.js';
import { Express } from 'express';
import request from 'supertest';
import { vi } from 'vitest';

vi.mock('../../lib/oss.js', () => ({
  signUrl: vi.fn((method: string, path: string) => `https://signed.example.com/${path}?sig=mock`),
  getOssEndpoint: vi.fn((name: string) => `https://oss.example.com/${name}`),
  createUploadTicket: vi.fn(() => Promise.resolve({
    uploadUrl: 'https://upload.example.com/file.jpg',
    publicUrl: 'https://public.example.com/file.jpg',
    imageId: 'mock-image-uuid',
  })),
  confirmUpload: vi.fn(() => Promise.resolve()),
}));

let app: Express;

beforeAll(async () => {
  await startMemoryServer();
  app = await getApp();
});

afterAll(async () => {
  await stopMemoryServer();
});

describe('OSS Integration', () => {
  describe('POST /api/oss/upload-url', () => {
    it('returns upload URL with valid image data', async () => {
      const res = await request(app)
        .post('/api/oss/upload-url')
        .send({ filename: 'photo.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('uploadUrl');
      expect(res.body).toHaveProperty('publicUrl');
      expect(res.body).toHaveProperty('imageId');
      expect(res.body.uploadUrl).toContain('upload.example.com');
      expect(res.body.publicUrl).toContain('public.example.com');
    });

    it('rejects missing filename', async () => {
      const res = await request(app)
        .post('/api/oss/upload-url')
        .send({ contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('filename');
    });

    it('rejects missing contentType', async () => {
      const res = await request(app)
        .post('/api/oss/upload-url')
        .send({ filename: 'photo.jpg' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('contentType');
    });

    it('rejects disallowed content type', async () => {
      const res = await request(app)
        .post('/api/oss/upload-url')
        .send({ filename: 'file.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid content type');
    });
  });

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
      expect(res.body.error).toContain('imageId');
    });
  });

  describe('GET /api/oss/image-proxy', () => {
    it('redirects with signed URL for valid path', async () => {
      const res = await request(app)
        .get('/api/oss/image-proxy?path=uploads/test.jpg');

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('signed.example.com');
      expect(res.headers.location).toContain('uploads/test.jpg');
    });

    it('rejects missing path parameter', async () => {
      const res = await request(app)
        .get('/api/oss/image-proxy');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('path');
    });

    it('rejects path not starting with uploads/', async () => {
      const res = await request(app)
        .get('/api/oss/image-proxy?path=etc/passwd');

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('invalid path');
    });
  });
});
