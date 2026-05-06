import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

describe('GET /api/articles/search', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  it('returns search results', async () => {
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

    const res = await request(app).get('/api/articles/search?q=test');
    expect(res.status).toBe(200);
    expect(res.body.articles).toHaveLength(1);
    expect(res.body.query).toBe('test');
  });

  it('rejects empty search query', async () => {
    const res = await request(app).get('/api/articles/search?q=');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Search query is required');
  });

  it('rejects missing search query', async () => {
    const res = await request(app).get('/api/articles/search');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Search query is required');
  });
});
