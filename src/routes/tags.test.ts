import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

const userId = createId();

describe('Tags List Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/tags/', () => {
    it('returns all tags', async () => {
      getMockCollection('tags').toArray.mockResolvedValue([{
        _id: new ObjectId(createId()),
        name: 'JavaScript',
        slug: 'javascript',
        articleCount: 5,
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const res = await request(app).get('/api/tags/');
      expect(res.status).toBe(200);
      expect(res.body.tags).toHaveLength(1);
    });
  });

  describe('POST /api/tags/', () => {
    it('creates tag when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('tags').findOne.mockResolvedValue(null);
      getMockCollection('tags').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });

      const res = await request(app)
        .post('/api/tags/')
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'JavaScript', slug: 'javascript' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('JavaScript');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/tags/')
        .send({ name: 'JS', slug: 'js' });

      expect(res.status).toBe(401);
    });

    it('rejects duplicate slug', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('tags').findOne.mockResolvedValue({ slug: 'javascript' });

      const res = await request(app)
        .post('/api/tags/')
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'JavaScript', slug: 'javascript' });

      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/tags/merge', () => {
    it('merges source tag into target tag', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('tags').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(createId()), name: 'Source' })
        .mockResolvedValueOnce({ _id: new ObjectId(createId()), name: 'Target' });
      getMockCollection('articles').updateMany.mockResolvedValue({ modifiedCount: 3 });
      getMockCollection('articles').countDocuments.mockResolvedValue(3);
      getMockCollection('tags').updateOne.mockResolvedValue({});
      getMockCollection('tags').deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .post('/api/tags/merge')
        .set('Cookie', `user_id=${userId}`)
        .send({ sourceId: createId(), targetId: createId() });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.articlesUpdated).toBe(3);
    });

    it('rejects missing IDs', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });

      const res = await request(app)
        .post('/api/tags/merge')
        .set('Cookie', `user_id=${userId}`)
        .send({ sourceId: createId() });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/tags/cleanup', () => {
    it('cleans up unused tags', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('tags').find
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue([
          { _id: new ObjectId(createId()), name: 'Unused', articleCount: 0, createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
        ])})
        .mockReturnValueOnce({ toArray: vi.fn().mockResolvedValue([]) });
      getMockCollection('tags').deleteOne.mockResolvedValue({ deletedCount: 1 });
      getMockCollection('articles').countDocuments.mockResolvedValue(0);

      const res = await request(app)
        .post('/api/tags/cleanup')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.deletedCount).toBe(1);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/tags/cleanup');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/tags/suggestions', () => {
    it('returns tag suggestions from articles', async () => {
      getMockCollection('tags').toArray.mockResolvedValue([]);
      getMockCollection('articles').toArray.mockResolvedValue([
        { title: 'Learning JavaScript Basics', tags: ['react'], status: 'published' },
        { title: 'JavaScript Advanced Concepts', tags: ['react'], status: 'published' },
      ]);

      const res = await request(app).get('/api/tags/suggestions');
      expect(res.status).toBe(200);
      expect(res.body.suggestions).toBeDefined();
    });
  });

  describe('POST /api/tags/recount', () => {
    it('recounts article counts for all tags', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('tags').toArray.mockResolvedValue([
        { _id: new ObjectId(createId()), name: 'JavaScript' },
        { _id: new ObjectId(createId()), name: 'TypeScript' },
      ]);
      getMockCollection('articles').countDocuments.mockResolvedValue(5);

      const res = await request(app)
        .post('/api/tags/recount')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.tagsUpdated).toBe(2);
    });
  });
});
