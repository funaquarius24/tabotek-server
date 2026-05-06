import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(() => Promise.resolve('$2a$12$hash')), compare: vi.fn(() => Promise.resolve(true)) } }));
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection, createId } from '../test-utils.js';
import { ObjectId } from 'mongodb';

const userId = createId();

function setupAuthUser(role = 'user') {
  const users = getMockCollection('users');
  users.findOne.mockResolvedValue({
    _id: new ObjectId(userId),
    email: 'test@example.com',
    name: 'Test User',
    role,
    passwordHash: '$2a$12$hashedpassword',
  });
  return users;
}

describe('Auth Routes', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  describe('POST /api/auth/signup', () => {
    it('creates a user with valid data', async () => {
      getMockCollection('users').findOne.mockResolvedValue(null);
      getMockCollection('users').insertOne.mockResolvedValue({ insertedId: new ObjectId(userId) });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'new@example.com', password: 'password123', name: 'New User' });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({ success: true, userId });
    });

    it('rejects invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'invalid', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid email');
    });

    it('rejects short password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: '1234567' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least 8 characters');
    });

    it('rejects duplicate email', async () => {
      setupAuthUser();

      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already registered');
    });
  });

  describe('POST /api/auth/signin', () => {
    it('signs in with valid credentials', async () => {
      setupAuthUser();

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('rejects invalid password', async () => {
      setupAuthUser();
      (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });

    it('rejects non-existent user', async () => {
      getMockCollection('users').findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'nobody@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/signout', () => {
    it('clears cookie and returns success', async () => {
      const res = await request(app).post('/api/auth/signout');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true });
    });
  });

  describe('POST /api/auth/upload-avatar', () => {
    it('returns upload URL with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/upload-avatar')
        .send({ filename: 'avatar.jpg', contentType: 'image/jpeg' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('uploadUrl');
      expect(res.body).toHaveProperty('publicUrl');
    });

    it('rejects invalid content type', async () => {
      const res = await request(app)
        .post('/api/auth/upload-avatar')
        .send({ filename: 'file.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(400);
    });

    it('rejects missing filename', async () => {
      const res = await request(app)
        .post('/api/auth/upload-avatar')
        .send({ contentType: 'image/jpeg' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/session', () => {
    it('returns user session when authenticated', async () => {
      setupAuthUser();

      const res = await request(app)
        .get('/api/auth/session')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/auth/session');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Not authenticated');
    });

    it('returns 401 when user not found', async () => {
      getMockCollection('users').findOne.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/auth/session')
        .set('Cookie', `user_id=${createId()}`);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/check-availability', () => {
    it('returns available when email and username are free', async () => {
      getMockCollection('users').findOne.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/check-availability')
        .send({ email: 'new@example.com', username: 'newuser' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ available: true });
    });

    it('returns errors when email or username are taken', async () => {
      getMockCollection('users').findOne
        .mockResolvedValueOnce({ email: 'taken@example.com' })
        .mockResolvedValueOnce({ username: 'takenuser' });

      const res = await request(app)
        .post('/api/auth/check-availability')
        .send({ email: 'taken@example.com', username: 'takenuser' });

      expect(res.status).toBe(409);
      expect(res.body.errors).toBeDefined();
    });

    it('rejects missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/check-availability')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/auth/request-author', () => {
    it('returns not requested when not authenticated', async () => {
      const res = await request(app).get('/api/auth/request-author');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ requested: false });
    });

    it('returns request status when authenticated', async () => {
      getMockCollection('authorRequests').findOne.mockResolvedValue({
        userId: new ObjectId(userId),
        status: 'pending',
      });

      const res = await request(app)
        .get('/api/auth/request-author')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(200);
      expect(res.body.requested).toBe(true);
      expect(res.body.status).toBe('pending');
    });
  });

  describe('POST /api/auth/request-author', () => {
    it('submits author request', async () => {
      setupAuthUser();
      getMockCollection('authorRequests').findOne.mockResolvedValue(null);
      getMockCollection('authorRequests').insertOne.mockResolvedValue({ insertedId: new ObjectId(createId()) });

      const res = await request(app)
        .post('/api/auth/request-author')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rejects when not authenticated', async () => {
      const res = await request(app).post('/api/auth/request-author');
      expect(res.status).toBe(401);
    });

    it('rejects duplicate request', async () => {
      setupAuthUser();
      getMockCollection('authorRequests').findOne.mockResolvedValue({ userId: new ObjectId(userId), status: 'pending' });

      const res = await request(app)
        .post('/api/auth/request-author')
        .set('Cookie', `user_id=${userId}`);

      expect(res.status).toBe(409);
    });
  });
});
