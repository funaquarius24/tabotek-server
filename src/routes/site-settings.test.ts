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

describe('Site Settings Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/admin/site-settings', () => {
    it('returns settings when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('site_settings').findOne.mockResolvedValue({
        _id: 'global',
        settings: { siteTitle: 'My Site' },
      });

      const res = await request(app)
        .get('/api/admin/site-settings')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.settings.siteTitle).toBe('My Site');
    });

    it('returns default settings when none saved', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('site_settings').findOne.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/admin/site-settings')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.settings).toBeDefined();
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/admin/site-settings');
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/admin/site-settings', () => {
    it('updates settings when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('site_settings').updateOne.mockResolvedValue({});

      const res = await request(app)
        .put('/api/admin/site-settings')
        .set('Cookie', `user_id=${userId}`)
        .send({ settings: { siteTitle: 'Updated Site' } });

      expect(res.status).toBe(200);
      expect(res.body.settings.siteTitle).toBe('Updated Site');
    });

    it('rejects missing settings object', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });

      const res = await request(app)
        .put('/api/admin/site-settings')
        .set('Cookie', `user_id=${userId}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .put('/api/admin/site-settings')
        .send({ settings: { siteTitle: 'Test' } });

      expect(res.status).toBe(401);
    });
  });
});
