import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { Binary } from 'bson';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

describe('GET /api/storage/file/:id', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  it('serves a database file stored as a BSON Binary', async () => {
    const content = Buffer.from('binary-image-bytes');
    getMockCollection('files').findOne.mockResolvedValue({
      _id: new ObjectId(createId()),
      type: 'image/png',
      storage: 'database',
      data: new Binary(content),
    });

    const res = await request(app).get(`/api/storage/file/${createId()}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['content-length']).toBe(String(content.length));
  });

  it('serves a database file stored as a Node Buffer', async () => {
    const content = Buffer.from('buffer-bytes');
    getMockCollection('files').findOne.mockResolvedValue({
      _id: new ObjectId(createId()),
      type: 'application/octet-stream',
      storage: 'database',
      data: content,
    });

    const res = await request(app).get(`/api/storage/file/${createId()}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-length']).toBe(String(content.length));
  });

  it('supports range requests', async () => {
    const content = Buffer.from('0123456789');
    getMockCollection('files').findOne.mockResolvedValue({
      _id: new ObjectId(createId()),
      type: 'text/plain',
      storage: 'database',
      data: new Binary(content),
    });

    const res = await request(app)
      .get(`/api/storage/file/${createId()}`)
      .set('Range', 'bytes=0-3');

    expect(res.status).toBe(206);
    expect(res.headers['content-range']).toBe('bytes 0-3/10');
  });

  it('returns 404 when the file does not exist', async () => {
    getMockCollection('files').findOne.mockResolvedValue(null);

    const res = await request(app).get(`/api/storage/file/${createId()}`);

    expect(res.status).toBe(404);
  });

  it('returns 404 when a database file has no data', async () => {
    getMockCollection('files').findOne.mockResolvedValue({
      _id: new ObjectId(createId()),
      type: 'image/png',
      storage: 'database',
    });

    const res = await request(app).get(`/api/storage/file/${createId()}`);

    expect(res.status).toBe(404);
  });
});
