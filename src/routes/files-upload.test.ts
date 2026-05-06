import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

describe('POST /api/files/upload', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  it('uploads a file from base64 data', async () => {
    getMockCollection('files').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });

    const base64Data = Buffer.from('test file content').toString('base64');
    const res = await request(app)
      .post('/api/files/upload')
      .send({ file: base64Data, filename: 'test.txt', type: 'text/plain' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('url');
  });

  it('uploads a file from data URL', async () => {
    getMockCollection('files').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });

    const base64Data = Buffer.from('test content').toString('base64');
    const res = await request(app)
      .post('/api/files/upload')
      .send({ file: `data:text/plain;base64,${base64Data}`, filename: 'test.txt', type: 'text/plain' });

    expect(res.status).toBe(201);
  });

  it('rejects missing file data', async () => {
    const res = await request(app)
      .post('/api/files/upload')
      .send({ filename: 'test.txt' });

    expect(res.status).toBe(400);
  });

  it('rejects disallowed file types', async () => {
    const base64Data = Buffer.from('test').toString('base64');
    const res = await request(app)
      .post('/api/files/upload')
      .send({ file: base64Data, filename: 'test.exe', type: 'application/x-msdownload' });

    expect(res.status).toBe(400);
  });
});
