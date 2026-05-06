import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

const userId = createId();

describe('Single Tag Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/tags/:id', () => {
    it('returns tag by id', async () => {
      getMockCollection('tags').findOne.mockResolvedValue({
        _id: new ObjectId(createId()),
        name: 'JavaScript',
        slug: 'javascript',
        articleCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app).get(`/api/tags/${createId()}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('JavaScript');
    });

    it('returns tag by slug', async () => {
      getMockCollection('tags').findOne.mockResolvedValue({
        _id: new ObjectId(createId()),
        name: 'TypeScript',
        slug: 'typescript',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app).get('/api/tags/typescript');
      expect(res.status).toBe(200);
    });

    it('returns 404 for non-existent tag', async () => {
      getMockCollection('tags').findOne.mockResolvedValue(null);

      const res = await request(app).get(`/api/tags/${createId()}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/tags/:id', () => {
    it('updates tag when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('tags').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(createId()), name: 'JS', slug: 'js' })
        .mockResolvedValueOnce({ _id: new ObjectId(createId()), name: 'JavaScript', slug: 'js', createdAt: new Date(), updatedAt: new Date() });

      const res = await request(app)
        .put(`/api/tags/${createId()}`)
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'JavaScript' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('JavaScript');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .put(`/api/tags/${createId()}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent tag', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('tags').findOne.mockResolvedValue(null);

      const res = await request(app)
        .put(`/api/tags/${createId()}`)
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/tags/:id', () => {
    it('deletes tag when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('tags').deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete(`/api/tags/${createId()}`)
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).delete(`/api/tags/${createId()}`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent tag', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('tags').deleteOne.mockResolvedValue({ deletedCount: 0 });

      const res = await request(app)
        .delete(`/api/tags/${createId()}`)
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(404);
    });
  });
});
