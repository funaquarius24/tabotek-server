import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

const userId = createId();

describe('Single Article Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/articles/:slug', () => {
    it('returns article by slug', async () => {
      getMockCollection('articles').findOne.mockResolvedValue({
        _id: new ObjectId(createId()),
        title: 'Test Article',
        slug: 'test-article',
        status: 'published',
        categoryId: new ObjectId(createId()),
        authorId: new ObjectId(createId()),
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app).get('/api/articles/test-article');
      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Test Article');
    });

    it('returns 404 for non-existent article', async () => {
      getMockCollection('articles').findOne.mockResolvedValue(null);

      const res = await request(app).get('/api/articles/non-existent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Article not found');
    });
  });

  describe('PUT /api/articles/:slug', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .put('/api/articles/test-slug')
        .send({ title: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('updates article when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'author' });
      getMockCollection('articles').findOne
        .mockResolvedValueOnce({ slug: 'test-slug', status: 'draft', _id: new ObjectId(createId()), categoryId: new ObjectId(createId()), authorId: new ObjectId(createId()), publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() })
        .mockResolvedValueOnce({ slug: 'test-slug', title: 'Updated', status: 'draft', _id: new ObjectId(createId()), categoryId: new ObjectId(createId()), authorId: new ObjectId(createId()), publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
      getMockCollection('articles').updateOne.mockResolvedValue({ modifiedCount: 1 });

      const res = await request(app)
        .put('/api/articles/test-slug')
        .set('Cookie', `user_id=${userId}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated');
    });

    it('returns 404 for non-existent article', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'author' });
      getMockCollection('articles').findOne.mockResolvedValue(null);

      const res = await request(app)
        .put('/api/articles/non-existent')
        .set('Cookie', `user_id=${userId}`)
        .send({ title: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/articles/:slug/vote', () => {
    it('records a like', async () => {
      getMockCollection('articles').findOne
        .mockResolvedValueOnce({ slug: 'test-article', authorId: new ObjectId(createId()), likes: 0, dislikes: 0, _id: new ObjectId(createId()), categoryId: new ObjectId(createId()), publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() })
        .mockResolvedValueOnce({ slug: 'test-article', authorId: new ObjectId(createId()), likes: 1, dislikes: 0, _id: new ObjectId(createId()), categoryId: new ObjectId(createId()), publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });

      const res = await request(app)
        .post('/api/articles/test-article/vote')
        .send({ vote: 'like' });

      expect(res.status).toBe(200);
    });

    it('returns 400 for invalid vote value', async () => {
      const res = await request(app)
        .post('/api/articles/test-article/vote')
        .send({ vote: 'invalid' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent article', async () => {
      getMockCollection('articles').findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/articles/non-existent/vote')
        .send({ vote: 'like' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/articles/:slug', () => {
    it('returns 403 without auth', async () => {
      const res = await request(app).delete('/api/articles/test-slug');
      expect(res.status).toBe(403);
    });

    it('deletes article when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'author' });
      getMockCollection('articles').deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete('/api/articles/test-slug')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 for non-existent article', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'author' });
      getMockCollection('articles').deleteOne.mockResolvedValue({ deletedCount: 0 });

      const res = await request(app)
        .delete('/api/articles/non-existent')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(404);
    });
  });
});
