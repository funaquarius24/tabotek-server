import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

const userId = createId();

describe('Categories Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/categories/', () => {
    it('returns all categories', async () => {
      getMockCollection('categories').toArray.mockResolvedValue([{
        _id: new ObjectId(createId()),
        name: 'Tech',
        slug: 'tech',
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const res = await request(app).get('/api/categories/');
      expect(res.status).toBe(200);
      expect(res.body.categories).toHaveLength(1);
    });

    it('filters featured categories', async () => {
      getMockCollection('categories').toArray.mockResolvedValue([]);

      const res = await request(app).get('/api/categories/?featured=true');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/categories/', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post('/api/categories/')
        .send({ name: 'Tech', slug: 'tech' });

      expect(res.status).toBe(401);
    });

    it('creates category when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('categories').findOne.mockResolvedValue(null);
      getMockCollection('categories').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });

      const res = await request(app)
        .post('/api/categories/')
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'Tech', slug: 'tech' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Tech');
    });

    it('rejects missing name or slug', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });

      const res = await request(app)
        .post('/api/categories/')
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'Tech' });

      expect(res.status).toBe(400);
    });

    it('rejects duplicate slug', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('categories').findOne.mockResolvedValue({ slug: 'tech' });

      const res = await request(app)
        .post('/api/categories/')
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'Tech', slug: 'tech' });

      expect(res.status).toBe(409);
    });
  });
});
