import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

describe('Files Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/files/', () => {
    it('returns paginated files', async () => {
      getMockCollection('files').countDocuments.mockResolvedValue(1);
      getMockCollection('files').toArray.mockResolvedValue([{
        _id: new ObjectId(createId()),
        originalname: 'test.jpg',
        filename: 'test.jpg',
        url: '/uploads/test.jpg',
        type: 'image/jpeg',
        size: 1024,
        createdAt: new Date(),
      }]);

      const res = await request(app).get('/api/files/');
      expect(res.status).toBe(200);
      expect(res.body.files).toHaveLength(1);
    });

    it('filters by image type', async () => {
      getMockCollection('files').countDocuments.mockResolvedValue(0);
      getMockCollection('files').toArray.mockResolvedValue([]);

      const res = await request(app).get('/api/files/?type=image');
      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/files/', () => {
    it('deletes a file by id', async () => {
      getMockCollection('files').findOne.mockResolvedValue({
        _id: new ObjectId(createId()),
        filename: 'test.jpg',
      });
      getMockCollection('files').deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app).delete(`/api/files/?id=${createId()}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects missing id', async () => {
      const res = await request(app).delete('/api/files/');
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent file', async () => {
      getMockCollection('files').findOne.mockResolvedValue(null);

      const res = await request(app).delete(`/api/files/?id=${createId()}`);
      expect(res.status).toBe(404);
    });
  });
});
