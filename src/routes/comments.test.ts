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
import { resetRateLimits } from './comments.js';

const userId = createId();
const articleId = createId();
const commentId = createId();
const agent = request.agent(app);

function mockComment(overrides = {}) {
  return {
    _id: new ObjectId(commentId),
    articleSlug: 'test-article',
    articleId: new ObjectId(articleId),
    parentId: null,
    depth: 0,
    author: { name: 'Alice', email: '', avatar: '', userId: null },
    content: 'Great article!',
    likes: 0,
    dislikes: 0,
    hidden: false,
    flagged: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    deleted: false,
    ...overrides,
  };
}

describe('Comments Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
    resetRateLimits();
    getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), name: 'TestUser', email: 'test@test.com', avatar: '' });
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
    function authSetup() {
      setupMockDb(connectToDatabase);
      resetRateLimits();
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), name: 'Bob', email: 'bob@test.com', avatar: '' });
      getMockCollection('articles').findOne.mockResolvedValue({ _id: new ObjectId(articleId), slug: 'test-article', allowComments: true, authorId: new ObjectId(createId()) });
      getMockCollection('comments').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });
    }

    it('creates a top-level comment when authenticated', async () => {
      authSetup();

      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .set('Cookie', `user_id=${userId}`)
        .send({ content: 'Nice post!' });
      expect(res.status).toBe(201);
      expect(res.body.author.name).toBe('Bob');
      expect(res.body.depth).toBe(0);
      expect(res.body.parentId).toBeNull();
    });

    it('returns 401 without auth', async () => {
      authSetup();

      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .send({ content: 'Nice post!' });
      expect(res.status).toBe(401);
    });

    it('creates a reply with depth validation', async () => {
      const parentCommentId = createId();
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), name: 'Charlie', email: '', avatar: '' });
      getMockCollection('articles').findOne.mockResolvedValue({ _id: new ObjectId(articleId), slug: 'test-article', allowComments: true });
      getMockCollection('comments').findOne
        .mockResolvedValueOnce(mockComment({ _id: new ObjectId(parentCommentId), depth: 0 }))
        .mockResolvedValueOnce(mockComment({ _id: new ObjectId(parentCommentId), depth: 0, likes: 0 }));
      getMockCollection('comments').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });

      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .set('Cookie', `user_id=${userId}`)
        .send({ content: 'A reply', parentId: parentCommentId });
      expect(res.status).toBe(201);
      expect(res.body.depth).toBe(1);
      expect(res.body.parentId).toBe(parentCommentId);
    });

    it('rejects reply beyond depth 3', async () => {
      const deepId = createId();
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), name: 'Deep', email: '', avatar: '' });
      getMockCollection('articles').findOne.mockResolvedValue({ _id: new ObjectId(articleId), slug: 'test-article', allowComments: true });
      getMockCollection('comments').findOne.mockResolvedValue(mockComment({ _id: new ObjectId(deepId), depth: 3 }));

      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .set('Cookie', `user_id=${userId}`)
        .send({ content: 'Too deep', parentId: deepId });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Maximum reply depth');
    });

    it('rejects empty content', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), name: 'Bob', email: '', avatar: '' });
      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .set('Cookie', `user_id=${userId}`)
        .send({ content: '   ' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when article not found', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), name: 'Bob', email: '', avatar: '' });
      getMockCollection('articles').findOne.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/articles/non-existent/comments')
        .set('Cookie', `user_id=${userId}`)
        .send({ content: 'Content' });
      expect(res.status).toBe(404);
    });

    it('returns 403 when comments are disabled', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), name: 'Bob', email: '', avatar: '' });
      getMockCollection('articles').findOne.mockResolvedValue({ _id: new ObjectId(articleId), slug: 'test-article', allowComments: false });
      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .set('Cookie', `user_id=${userId}`)
        .send({ content: 'Content' });
      expect(res.status).toBe(403);
    });

    it('returns 404 for invalid parent comment', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), name: 'Bob', email: '', avatar: '' });
      getMockCollection('articles').findOne.mockResolvedValue({ _id: new ObjectId(articleId), slug: 'test-article', allowComments: true });
      getMockCollection('comments').findOne.mockResolvedValue(null);
      const res = await request(app)
        .post('/api/articles/test-article/comments')
        .set('Cookie', `user_id=${userId}`)
        .send({ content: 'Content', parentId: createId() });
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
      getMockCollection('comments').findOne.mockResolvedValue(mockComment());
      getMockCollection('comments').deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete(`/api/articles/test-article/comments/${commentId}`)
        .set('Cookie', `user_id=${userId}`);
      expect(res.status).toBe(200);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).delete(`/api/articles/test-article/comments/${commentId}`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent comment', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('comments').findOne.mockResolvedValue(null);
      const res = await request(app)
        .delete(`/api/articles/test-article/comments/${commentId}`)
        .set('Cookie', `user_id=${userId}`);
      expect(res.status).toBe(404);
    });
  });
});
