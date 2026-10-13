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

    it('keeps the original author and records the editor when a different user edits', async () => {
      const adminId = createId();
      const originalAuthorId = createId();
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(adminId), role: 'admin' })
        .mockResolvedValueOnce({ _id: new ObjectId(adminId), name: 'Admin User' })
        .mockResolvedValueOnce({ _id: new ObjectId(originalAuthorId), name: 'Original Author' });
      getMockCollection('articles').findOne
        .mockResolvedValueOnce({ slug: 'test-slug', title: 'Old', status: 'draft', _id: new ObjectId(createId()), categoryId: new ObjectId(createId()), authorId: new ObjectId(originalAuthorId), authorName: 'Original Author', editors: [], publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() })
        .mockResolvedValueOnce({ slug: 'test-slug', title: 'New', status: 'draft', _id: new ObjectId(createId()), categoryId: new ObjectId(createId()), authorId: new ObjectId(originalAuthorId), authorName: 'Original Author', editors: [{ userId: new ObjectId(adminId), name: 'Admin User', editedAt: new Date() }], publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
      getMockCollection('articles').updateOne.mockResolvedValue({ modifiedCount: 1 });

      const res = await request(app)
        .put('/api/articles/test-slug')
        .set('Cookie', `user_id=${adminId}`)
        .send({ title: 'New', authorId: adminId });

      expect(res.status).toBe(200);
      expect(res.body.authorId).toBe(originalAuthorId);
      const calls = getMockCollection('articles').updateOne.mock.calls;
      const mainSet = calls[0][1].$set;
      expect(mainSet.authorId).toBeUndefined();
      expect(mainSet.editors).toBeUndefined();
      const pushCall = calls.find((c) => c[1].$push);
      expect(pushCall).toBeTruthy();
      expect(pushCall![1].$push.editors.userId.toString()).toBe(adminId);
      expect(pushCall![1].$push.editors.name).toBe('Admin User');
      expect(res.body.editors).toHaveLength(1);
    });

    it('does not add an editor entry when the author edits their own article', async () => {
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(userId), role: 'author' })
        .mockResolvedValueOnce({ _id: new ObjectId(userId), name: 'Author' });
      getMockCollection('articles').findOne
        .mockResolvedValueOnce({ slug: 'test-slug', title: 'Old', status: 'draft', _id: new ObjectId(createId()), categoryId: new ObjectId(createId()), authorId: new ObjectId(userId), authorName: 'Author', editors: [], publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() })
        .mockResolvedValueOnce({ slug: 'test-slug', title: 'New', status: 'draft', _id: new ObjectId(createId()), categoryId: new ObjectId(createId()), authorId: new ObjectId(userId), authorName: 'Author', editors: [], publishedAt: new Date(), createdAt: new Date(), updatedAt: new Date() });
      getMockCollection('articles').updateOne.mockResolvedValue({ modifiedCount: 1 });

      const res = await request(app)
        .put('/api/articles/test-slug')
        .set('Cookie', `user_id=${userId}`)
        .send({ title: 'New', authorId: userId });

      expect(res.status).toBe(200);
      const mainSet = getMockCollection('articles').updateOne.mock.calls[0][1].$set;
      expect(mainSet.authorId).toBeUndefined();
      expect(mainSet.editors).toBeUndefined();
      expect(getMockCollection('articles').updateOne.mock.calls.filter((c) => c[1].$push)).toHaveLength(0);
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
      getMockCollection('articles').findOne.mockResolvedValue({
        _id: new ObjectId(createId()),
        authorId: new ObjectId(userId),
        slug: 'test-slug',
      });
      getMockCollection('articles').deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete('/api/articles/test-slug')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows an editor to delete an author article', async () => {
      const editorId = createId();
      const authorId = createId();
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(editorId), role: 'editor' })
        .mockResolvedValueOnce({ _id: new ObjectId(authorId), role: 'author' });
      getMockCollection('articles').findOne.mockResolvedValue({
        _id: new ObjectId(createId()),
        authorId: new ObjectId(authorId),
        slug: 'author-article',
      });
      getMockCollection('articles').deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete('/api/articles/author-article')
        .set('Cookie', `user_id=${editorId}`);

      expect(res.status).toBe(200);
    });

    it('rejects an author deleting another author article', async () => {
      const authorId = createId();
      const otherAuthorId = createId();
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(authorId), role: 'author' })
        .mockResolvedValueOnce({ _id: new ObjectId(otherAuthorId), role: 'author' });
      getMockCollection('articles').findOne.mockResolvedValue({
        _id: new ObjectId(createId()),
        authorId: new ObjectId(otherAuthorId),
        slug: 'other-author-article',
      });

      const res = await request(app)
        .delete('/api/articles/other-author-article')
        .set('Cookie', `user_id=${authorId}`);

      expect(res.status).toBe(403);
      expect(getMockCollection('articles').deleteOne).not.toHaveBeenCalled();
    });

    it('rejects an editor deleting another editor article', async () => {
      const editorId = createId();
      const otherEditorId = createId();
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(editorId), role: 'editor' })
        .mockResolvedValueOnce({ _id: new ObjectId(otherEditorId), role: 'editor' });
      getMockCollection('articles').findOne.mockResolvedValue({
        _id: new ObjectId(createId()),
        authorId: new ObjectId(otherEditorId),
        slug: 'editor-article',
      });

      const res = await request(app)
        .delete('/api/articles/editor-article')
        .set('Cookie', `user_id=${editorId}`);

      expect(res.status).toBe(403);
      expect(getMockCollection('articles').deleteOne).not.toHaveBeenCalled();
    });

    it('rejects an editor deleting an administrator article', async () => {
      const editorId = createId();
      const adminId = createId();
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(editorId), role: 'editor' })
        .mockResolvedValueOnce({ _id: new ObjectId(adminId), role: 'admin' });
      getMockCollection('articles').findOne.mockResolvedValue({
        _id: new ObjectId(createId()),
        authorId: new ObjectId(adminId),
        slug: 'admin-article',
      });

      const res = await request(app)
        .delete('/api/articles/admin-article')
        .set('Cookie', `user_id=${editorId}`);

      expect(res.status).toBe(403);
      expect(getMockCollection('articles').deleteOne).not.toHaveBeenCalled();
    });

    it('returns 404 for non-existent article', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'author' });
      getMockCollection('articles').findOne.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/articles/non-existent')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(404);
    });
  });
});
