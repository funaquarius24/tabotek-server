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

function mockComment(overrides = {}) {
  return {
    _id: new ObjectId(createId()),
    articleSlug: 'test-article',
    articleId: new ObjectId(articleId),
    parentId: null,
    depth: 0,
    author: { name: 'Alice', email: '', avatar: '' },
    content: 'Great article!',
    likes: 0,
    dislikes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deleted: false,
    ...overrides,
  };
}

describe('Comments Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/articles/:slug/comments', () => {
    it('returns comments for an article', async () => {
      getMockCollection('comments').toArray.mockResolvedValue([mockComment()]);

      const res = await request(app).get('/api/articles/test-article/comments');
      expect(res.status).toBe(200);
      expect(res.body.comments).toHaveLength(1);
      expect(res.body.comments[0].author.name).toBe('Alice');
    });

    it('returns empty list when no comments', async () => {
      getMockCollection('comments').toArray.mockResolvedValue([]);
      const res = await request(app).get('/api/articles/no-comments/comments');
      expect(res.status).toBe(200);
      expect(res.body.comments).toEqual([]);
    });
  });

  describe('POST /api/articles/:slug/comments', () => {
    it('creates a top-level comment', async () => {
      getMockCollection('articles').findOne.mockResolvedValue({ _id: new ObjectId(articleId), slug: 'test-article', allowComments: true });
      getMockCollection('comments').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });

      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ author: { name: 'Bob' }, content: 'Nice post!' });
      expect(res.status).toBe(201);
      expect(res.body.author.name).toBe('Bob');
      expect(res.body.depth).toBe(0);
      expect(res.body.parentId).toBeNull();
    });

    it('creates a reply with depth validation', async () => {
      const parentCommentId = createId();
      getMockCollection('articles').findOne.mockResolvedValue({ _id: new ObjectId(articleId), slug: 'test-article', allowComments: true });
      getMockCollection('comments').findOne.mockResolvedValue(mockComment({ _id: new ObjectId(parentCommentId), depth: 0 }));
      getMockCollection('comments').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });

      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ author: { name: 'Charlie' }, content: 'A reply', parentId: parentCommentId });
      expect(res.status).toBe(201);
      expect(res.body.depth).toBe(1);
      expect(res.body.parentId).toBe(parentCommentId);
    });

    it('rejects reply beyond depth 3', async () => {
      const deepId = createId();
      getMockCollection('articles').findOne.mockResolvedValue({ _id: new ObjectId(articleId), slug: 'test-article', allowComments: true });
      getMockCollection('comments').findOne.mockResolvedValue(mockComment({ _id: new ObjectId(deepId), depth: 3 }));

      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ author: { name: 'Deep' }, content: 'Too deep', parentId: deepId });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Maximum reply depth');
    });

    it('rejects missing author name', async () => {
      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ content: 'Some content' });
      expect(res.status).toBe(400);
    });

    it('rejects missing content', async () => {
      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ author: { name: 'Bob' } });
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
      getMockCollection('articles').findOne.mockResolvedValue({ _id: new ObjectId(articleId), slug: 'test-article', allowComments: false });
      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ author: { name: 'Bob' }, content: 'Content' });
      expect(res.status).toBe(403);
    });

    it('returns 404 for invalid parent comment', async () => {
      getMockCollection('articles').findOne.mockResolvedValue({ _id: new ObjectId(articleId), slug: 'test-article', allowComments: true });
      getMockCollection('comments').findOne.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ author: { name: 'Bob' }, content: 'Content', parentId: createId() });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/articles/:slug/comments/:commentId/like', () => {
    it('records a like', async () => {
      const cid = createId();
      getMockCollection('comments').findOne
        .mockResolvedValueOnce(mockComment({ _id: new ObjectId(cid), likes: 0 }))
        .mockResolvedValueOnce(mockComment({ _id: new ObjectId(cid), likes: 1 }));
      getMockCollection('comments').updateOne.mockResolvedValue({});

      const res = await request(app)
        .post(`/api/articles/test-article/comments/${cid}/like`)
        .send({ vote: 'like' });
      expect(res.status).toBe(200);
      expect(res.body.likes).toBe(1);
    });

    it('returns 400 for invalid vote value', async () => {
      const res = await request(app)
        .post(`/api/articles/test-article/comments/${createId()}/like`)
        .send({ vote: 'invalid' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent comment', async () => {
      getMockCollection('comments').findOne.mockResolvedValue(null);
      const res = await request(app)
        .post(`/api/articles/test-article/comments/${createId()}/like`)
        .send({ vote: 'like' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid comment ID', async () => {
      const res = await request(app)
        .post('/api/articles/test-article/comments/bad-id/like')
        .send({ vote: 'like' });
      expect(res.status).toBe(400);
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
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).delete(`/api/articles/test-article/comments/${createId()}`);
      expect(res.status).toBe(401);
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
