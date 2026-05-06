import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

const userId = createId();

describe('User Settings Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/user/settings', () => {
    it('returns settings when authenticated', async () => {
      getMockCollection('user_settings').findOne.mockResolvedValue({
        userId: new ObjectId(userId),
        settings: { editorFontSize: 16, darkMode: true },
      });

      const res = await request(app)
        .get('/api/user/settings')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.settings.editorFontSize).toBe(16);
      expect(res.body.settings.darkMode).toBe(true);
    });

    it('returns default settings when not authenticated', async () => {
      const res = await request(app).get('/api/user/settings');
      expect(res.status).toBe(200);
      expect(res.body.settings).toBeDefined();
    });

    it('returns default settings when none saved', async () => {
      getMockCollection('user_settings').findOne.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/user/settings')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.settings.editorFontFamily).toBe('Geist Mono');
    });
  });

  describe('PUT /api/user/settings', () => {
    it('updates settings when authenticated', async () => {
      getMockCollection('user_settings').updateOne.mockResolvedValue({});

      const res = await request(app)
        .put('/api/user/settings')
        .set('Cookie', `user_id=${userId}`)
        .send({ settings: { editorFontSize: 18, darkMode: true } });

      expect(res.status).toBe(200);
      expect(res.body.settings.editorFontSize).toBe(18);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .put('/api/user/settings')
        .send({ settings: { editorFontSize: 18 } });

      expect(res.status).toBe(401);
    });

    it('rejects missing settings object', async () => {
      const res = await request(app)
        .put('/api/user/settings')
        .set('Cookie', `user_id=${userId}`)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
