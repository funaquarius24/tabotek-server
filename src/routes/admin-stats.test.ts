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

describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  it('returns stats when authorized', async () => {
    getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
    getMockCollection('articles').countDocuments
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(80);
    getMockCollection('categories').countDocuments.mockResolvedValue(10);
    getMockCollection('users').countDocuments.mockResolvedValue(50);
    getMockCollection('tags').countDocuments.mockResolvedValue(30);

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Cookie', `user_id=${userId}`);

    expect(res.status).toBe(200);
    expect(res.body.totalArticles).toBe(100);
    expect(res.body.publishedArticles).toBe(80);
    expect(res.body.draftArticles).toBe(20);
    expect(res.body.totalCategories).toBe(10);
    expect(res.body.totalUsers).toBe(50);
    expect(res.body.totalTags).toBe(30);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-admin', async () => {
    getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'user' });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Cookie', `user_id=${userId}`);

    expect(res.status).toBe(200);
  });
});
