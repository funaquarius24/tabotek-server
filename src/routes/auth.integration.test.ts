import { startMemoryServer, stopMemoryServer, clearCollections, getApp } from '../integration-setup.js';
import { Express } from 'express';
import request from 'supertest';

let app: Express;

beforeAll(async () => {
  await startMemoryServer();
  app = await getApp();
});

afterAll(async () => {
  await stopMemoryServer();
});

beforeEach(async () => {
  await clearCollections();
});

describe('Auth Integration', () => {
  const testUser = { email: 'testuser@example.com', password: 'password123', name: 'Test User' };

  describe('Full auth flow', () => {
    it('signup, signin, session, check-availability, request-author, signout', async () => {
      // --- Check-availability: email and username are free ---
      let res = await request(app)
        .post('/api/auth/check-availability')
        .send({ email: testUser.email, username: 'testuser' });
      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);

      // --- Signup ---
      res = await request(app)
        .post('/api/auth/signup')
        .send(testUser);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // --- Signup with duplicate email ---
      res = await request(app)
        .post('/api/auth/signup')
        .send(testUser);
      expect(res.status).toBe(409);
      expect(res.body.error).toContain('already registered');

      // --- Check-availability: email now taken ---
      res = await request(app)
        .post('/api/auth/check-availability')
        .send({ email: testUser.email, username: 'newuser' });
      expect(res.status).toBe(409);
      expect(res.body.errors.email).toBeDefined();

      // --- Signin ---
      res = await request(app)
        .post('/api/auth/signin')
        .send({ email: testUser.email, password: testUser.password });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(testUser.email);

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // --- Session ---
      res = await request(app)
        .get('/api/auth/session')
        .set('Cookie', cookies as unknown as string);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.user.name).toBe(testUser.name);

      // --- Request author (initially not requested) ---
      res = await request(app)
        .get('/api/auth/request-author')
        .set('Cookie', cookies as unknown as string);
      expect(res.status).toBe(200);
      expect(res.body.requested).toBe(false);

      // --- Submit author request ---
      res = await request(app)
        .post('/api/auth/request-author')
        .set('Cookie', cookies as unknown as string);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // --- Duplicate author request ---
      res = await request(app)
        .post('/api/auth/request-author')
        .set('Cookie', cookies as unknown as string);
      expect(res.status).toBe(409);

      // --- Check request status ---
      res = await request(app)
        .get('/api/auth/request-author')
        .set('Cookie', cookies as unknown as string);
      expect(res.status).toBe(200);
      expect(res.body.requested).toBe(true);

      // --- Signout ---
      res = await request(app)
        .post('/api/auth/signout')
        .set('Cookie', cookies as unknown as string);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // --- Session after signout ---
      res = await request(app).get('/api/auth/session');
      expect(res.status).toBe(401);
    });
  });

  describe('Auth validation', () => {
    it('rejects invalid signin credentials', async () => {
      const res = await request(app)
        .post('/api/auth/signin')
        .send({ email: 'wrong@example.com', password: 'wrongpass' });
      expect(res.status).toBe(401);
    });

    it('rejects signup with weak password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'weak@example.com', password: '1234567' });
      expect(res.status).toBe(400);
    });

    it('rejects signup with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'notanemail', password: 'password123' });
      expect(res.status).toBe(400);
    });
  });
});
