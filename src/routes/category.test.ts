import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

const userId = createId();

describe('Single Category Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/categories/:id', () => {
    it('returns category by id', async () => {
      getMockCollection('categories').findOne.mockResolvedValue({
        _id: new ObjectId(createId()),
        name: 'Tech',
        slug: 'tech',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app).get(`/api/categories/${createId()}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Tech');
    });

    it('returns category by slug', async () => {
      getMockCollection('categories').findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ _id: new ObjectId(createId()) })
        .mockResolvedValueOnce({
          _id: new ObjectId(createId()),
          name: 'Tech',
          slug: 'tech',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const res = await request(app).get('/api/categories/tech');
      expect(res.status).toBe(200);
    });

    it('returns 404 for non-existent category', async () => {
      getMockCollection('categories').findOne.mockResolvedValue(null);

      const res = await request(app).get(`/api/categories/${createId()}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/categories/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .put(`/api/categories/${createId()}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('updates category when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('categories').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(createId()), name: 'Tech', slug: 'tech' })
        .mockResolvedValueOnce({ _id: new ObjectId(createId()), name: 'Updated', slug: 'tech', createdAt: new Date(), updatedAt: new Date() });

      const res = await request(app)
        .put(`/api/categories/${createId()}`)
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
    });

    it('returns 404 for non-existent category', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('categories').findOne.mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/categories/${createId()}`)
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/categories/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).delete(`/api/categories/${createId()}`);
      expect(res.status).toBe(401);
    });

    it('deletes category when authorized and empty', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('categories').countDocuments.mockResolvedValue(0);
      getMockCollection('articles').countDocuments.mockResolvedValue(0);
      getMockCollection('categories').deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete(`/api/categories/${createId()}`)
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('refuses to delete category with children', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('categories').countDocuments
        .mockResolvedValueOnce(1);

      const res = await request(app)
        .delete(`/api/categories/${createId()}`)
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('child categories');
    });

    it('refuses to delete category with articles', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('categories').countDocuments.mockResolvedValue(0);
      getMockCollection('articles').countDocuments.mockResolvedValue(1);

      const res = await request(app)
        .delete(`/api/categories/${createId()}`)
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('associated articles');
    });
  });
});
