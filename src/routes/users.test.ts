import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

const userId = createId();
const otherUserId = createId();

describe('Users Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('GET /api/users/', () => {
    it('returns all users when authorized', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'admin' });
      getMockCollection('users').toArray.mockResolvedValue([{
        _id: new ObjectId(userId),
        email: 'admin@example.com',
        name: 'Admin',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      }]);

      const res = await request(app)
        .get('/api/users/')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.users).toHaveLength(1);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/users/');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/users/:id', () => {
    it('returns user by id when authorized', async () => {
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(userId), role: 'admin' })
        .mockResolvedValueOnce({ _id: new ObjectId(otherUserId), email: 'user@example.com', name: 'User', role: 'user', createdAt: new Date(), updatedAt: new Date() });

      const res = await request(app)
        .get(`/api/users/${otherUserId}`)
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('user@example.com');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/api/users/${otherUserId}`);
      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent user', async () => {
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(userId), role: 'admin' })
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .get(`/api/users/${otherUserId}`)
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('updates user when authorized', async () => {
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(userId), role: 'admin' })
        .mockResolvedValueOnce({ _id: new ObjectId(otherUserId), email: 'user@example.com', role: 'user' })
        .mockResolvedValueOnce({ _id: new ObjectId(otherUserId), email: 'user@example.com', name: 'Updated User', role: 'user', createdAt: new Date(), updatedAt: new Date() });
      getMockCollection('users').updateOne.mockResolvedValue({ matchedCount: 1 });

      const res = await request(app)
        .put(`/api/users/${otherUserId}`)
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'Updated User' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated User');
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .put(`/api/users/${otherUserId}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('returns 404 for non-existent user', async () => {
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(userId), role: 'admin' })
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .put(`/api/users/${otherUserId}`)
        .set('Cookie', `user_id=${userId}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('deletes user when authorized', async () => {
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ _id: new ObjectId(userId), role: 'superuser' })
        .mockResolvedValueOnce({ _id: new ObjectId(otherUserId), role: 'user' });
      getMockCollection('users').countDocuments.mockResolvedValue(2);
      getMockCollection('users').deleteOne.mockResolvedValue({ deletedCount: 1 });

      const res = await request(app)
        .delete(`/api/users/${otherUserId}`)
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).delete(`/api/users/${otherUserId}`);
      expect(res.status).toBe(401);
    });

    it('prevents deleting yourself', async () => {
      getMockCollection('users').findOne.mockResolvedValue({ _id: new ObjectId(userId), role: 'superuser' });

      const res = await request(app)
        .delete(`/api/users/${userId}`)
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot delete your own account');
    });
  });
});
