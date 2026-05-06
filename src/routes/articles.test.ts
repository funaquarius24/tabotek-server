import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

const userId = createId();

describe('Articles List Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/articles/', () => {
    it('returns paginated articles', async () => {
      getMockCollection('articles').countDocuments.mockResolvedValue(1);
      getMockCollection('articles').toArray.mockResolvedValue([{
        _id: new ObjectId(createId()),
        title: 'Test Article',
        slug: 'test-article',
        status: 'published',
        categoryId: new ObjectId(createId()),
        authorId: new ObjectId(createId()),
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const res = await request(app).get('/api/articles/');
      expect(res.status).toBe(200);
      expect(res.body.articles).toHaveLength(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('filters by category slug', async () => {
      getMockCollection('categories').findOne.mockResolvedValue({ _id: new ObjectId(createId()) });
      getMockCollection('articles').countDocuments.mockResolvedValue(0);
      getMockCollection('articles').toArray.mockResolvedValue([]);

      const res = await request(app).get('/api/articles/?category=tech');
      expect(res.status).toBe(200);
    });

    it('filters by search query', async () => {
      getMockCollection('articles').countDocuments.mockResolvedValue(0);
      getMockCollection('articles').toArray.mockResolvedValue([]);

      const res = await request(app).get('/api/articles/?search=test');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/articles/', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/articles/')
        .send({ title: 'Test', slug: 'test', content: 'Content', categoryId: createId() });

      expect(res.status).toBe(401);
    });

    it('creates article when authenticated as author', async () => {
      const users = getMockCollection('users');
      users.findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'author' });
      getMockCollection('articles').findOne.mockResolvedValue(null);
      getMockCollection('articles').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });

      const res = await request(app)
        .post('/api/articles/')
        .set('Cookie', `user_id=${userId}`)
        .send({ title: 'Test Article', slug: 'test-article', content: 'Content here', categoryId: createId(), status: 'published' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Test Article');
    });

    it('rejects missing required fields', async () => {
      const users = getMockCollection('users');
      users.findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'author' });

      const res = await request(app)
        .post('/api/articles/')
        .set('Cookie', `user_id=${userId}`)
        .send({ title: 'Test' });

      expect(res.status).toBe(400);
    });

    it('rejects duplicate slug', async () => {
      const users = getMockCollection('users');
      users.findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'author' });
      getMockCollection('articles').findOne.mockResolvedValue({ slug: 'test-article' });

      const res = await request(app)
        .post('/api/articles/')
        .set('Cookie', `user_id=${userId}`)
        .send({ title: 'Test', slug: 'test-article', content: 'Content', categoryId: createId() });

      expect(res.status).toBe(409);
    });
  });
});
