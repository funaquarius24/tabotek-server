import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
vi.mock('../../lib/roles.js', () => ({
  canAccessAdmin: vi.fn(() => true),
  ROLE_LEVELS: { user: 0, author: 1, editor: 2, admin: 3, superuser: 4 },
  hasRole: vi.fn(() => true),
}));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

const userId = createId();
const articleId = createId();

describe('Comments Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/articles/:slug/comments', () => {
    it('returns comments for an article', async () => {
      getMockCollection('comments').toArray.mockResolvedValue([{
        _id: new ObjectId(createId()),
        articleSlug: 'test-article',
        articleId: new ObjectId(articleId),
        author: { name: 'Alice', email: '', avatar: '' },
        content: 'Great article!',
        createdAt: new Date(),
        updatedAt: new Date(),
        deleted: false,
      }]);

      const res = await request(app).get('/api/articles/test-article/comments');
      expect(res.status).toBe(200);
      expect(res.body.comments).toHaveLength(1);
      expect(res.body.comments[0].author.name).toBe('Alice');
      expect(res.body.comments[0].content).toBe('Great article!');
    });

    it('returns empty list when no comments', async () => {
      getMockCollection('comments').toArray.mockResolvedValue([]);

      const res = await request(app).get('/api/articles/no-comments/comments');
      expect(res.status).toBe(200);
      expect(res.body.comments).toEqual([]);
    });
  });

  describe('POST /api/articles/:slug/comments', () => {
    it('creates a comment with valid data', async () => {
      getMockCollection('articles').findOne.mockResolvedValue({
        _id: new ObjectId(articleId),
        slug: 'test-article',
        allowComments: true,
      });
      getMockCollection('comments').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });

      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ author: { name: 'Bob' }, content: 'Nice post!' });

      expect(res.status).toBe(201);
      expect(res.body.author.name).toBe('Bob');
      expect(res.body.content).toBe('Nice post!');
    });

    it('rejects missing author name', async () => {
      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ content: 'Some content' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Author name');
    });

    it('rejects missing content', async () => {
      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ author: { name: 'Bob' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('content');
    });

    it('rejects empty content', async () => {
      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ author: { name: 'Bob' }, content: '   ' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when article not found', async () => {
      getMockCollection('articles').findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/articles/non-existent/comments')
        .send({ author: { name: 'Bob' }, content: 'Content' });
      expect(res.status).toBe(404);
    });

    it('returns 403 when comments are disabled', async () => {
      getMockCollection('articles').findOne.mockResolvedValue({
        _id: new ObjectId(articleId),
        slug: 'test-article',
        allowComments: false,
      });

      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ author: { name: 'Bob' }, content: 'Content' });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('disabled');
    });
  });

  describe('DELETE /api/articles/:slug/comments/:commentId', () => {
    it('deletes a comment when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('comments').deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete(`/api/articles/test-article/comments/${createId()}`)
        .set('Cookie', `user_id=${userId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .delete(`/api/articles/test-article/comments/${createId()}`);
      expect(res.status).toBe(401);
    });

    it('returns 400 for invalid comment ID', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });

      const res = await request(app)
        .delete('/api/articles/test-article/comments/invalid-id')
        .set('Cookie', `user_id=${userId}`);
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent comment', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('comments').deleteOne.mockResolvedValue({ deletedCount: 0 });

      const res = await request(app)
        .delete(`/api/articles/test-article/comments/${createId()}`)
        .set('Cookie', `user_id=${userId}`);
      expect(res.status).toBe(404);
    });
  });
});
