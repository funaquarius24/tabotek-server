import { startMemoryServer, stopMemoryServer, clearCollections, getApp } from '../integration-setup.js';
import { Express } from 'express';
import request from 'supertest';
import { vi } from 'vitest';
import bcrypt from 'bcryptjs';

vi.mock('../../lib/oss.js', () => ({
  signUrl: vi.fn(() => 'https://signed-url.example.com/path'),
  getOssEndpoint: vi.fn(() => 'https://oss.example.com/object'),
  createUploadTicket: vi.fn(() => Promise.resolve({
    uploadUrl: 'https://upload.example.com/file',
    publicUrl: 'https://public.example.com/file',
    imageId: 'mock-image-id',
  })),
  confirmUpload: vi.fn(() => Promise.resolve()),
}));

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

async function createUser(email: string, name: string, role: string, password = 'password123') {
  const { connectToDatabase } = await import('../../lib/mongodb.js');
  const { db } = await connectToDatabase();
  const passwordHash = await bcrypt.hash(password, 4);
  const result = await db.collection('users').insertOne({
    email, name, role, passwordHash, avatar: '',
    createdAt: new Date(), updatedAt: new Date(),
  });
  return result.insertedId.toString();
}

async function signIn(email: string, password = 'password123') {
  const res = await request(app)
    .post('/api/auth/signin')
    .send({ email, password });
  return (res.headers['set-cookie'] || []) as unknown as string[];
}

describe('Tags Integration', () => {
  let adminCookies: string[];
  let categoryId: string;

  beforeEach(async () => {
    await createUser('admin@test.com', 'Admin', 'admin');
    adminCookies = await signIn('admin@test.com');

    const catRes = await request(app)
      .post('/api/categories/')
      .set('Cookie', adminCookies as unknown as string)
      .send({ name: 'Tech', slug: 'tech' });
    categoryId = catRes.body._id;
  });

  describe('Tag CRUD and operations', () => {
    it('creates, lists, gets, updates, suggests, recounts, merges, and deletes tags', async () => {
      // --- Create tags ---
      const createJsRes = await request(app)
        .post('/api/tags/')
        .set('Cookie', adminCookies as unknown as string)
        .send({ name: 'JavaScript', slug: 'javascript', description: 'JS content' });
      expect(createJsRes.status).toBe(201);
      const jsTagId = createJsRes.body._id;

      const createTsRes = await request(app)
        .post('/api/tags/')
        .set('Cookie', adminCookies as unknown as string)
        .send({ name: 'TypeScript', slug: 'typescript' });
      expect(createTsRes.status).toBe(201);
      const tsTagId = createTsRes.body._id;

      // --- List tags ---
      const listRes = await request(app).get('/api/tags/');
      expect(listRes.status).toBe(200);
      expect(listRes.body.tags.length).toBe(2);

      // --- Get tag by ID ---
      const getRes = await request(app).get(`/api/tags/${jsTagId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('JavaScript');

      // --- Get tag by slug ---
      const getBySlugRes = await request(app).get('/api/tags/typescript');
      expect(getBySlugRes.status).toBe(200);
      expect(getBySlugRes.body.name).toBe('TypeScript');

      // --- Create articles with tags ---
      // Upgrade user to author for article creation
      const { db } = (await import('../../lib/mongodb.js')).connectToDatabase;
      // Create author user and sign in
      await createUser('author@test.com', 'Author', 'author');
      const authorCookies = await signIn('author@test.com');

      await request(app)
        .post('/api/articles/')
        .set('Cookie', authorCookies as unknown as string)
        .send({
          title: 'JS Basics', slug: 'js-basics', content: 'Content',
          categoryId, status: 'published', tags: ['JavaScript'],
        });

      await request(app)
        .post('/api/articles/')
        .set('Cookie', authorCookies as unknown as string)
        .send({
          title: 'TS Advanced', slug: 'ts-advanced', content: 'Content',
          categoryId, status: 'published', tags: ['TypeScript'],
        });

      // --- Wait for articles to persist ---
      const { connectToDatabase } = await import('../../lib/mongodb.js');
      const { db: connDb } = await connectToDatabase();
      const articlesCount = await connDb.collection('articles').countDocuments({});
      expect(articlesCount).toBe(2);

      // --- Recount tags ---
      const recountRes = await request(app)
        .post('/api/tags/recount')
        .set('Cookie', adminCookies as unknown as string);
      expect(recountRes.status).toBe(200);
      expect(recountRes.body.tagsUpdated).toBe(2);

      // --- Merge tags: merge JavaScript into TypeScript ---
      const mergeRes = await request(app)
        .post('/api/tags/merge')
        .set('Cookie', adminCookies as unknown as string)
        .send({ sourceId: jsTagId, targetId: tsTagId });
      expect(mergeRes.status).toBe(200);
      expect(mergeRes.body.articlesUpdated).toBeGreaterThanOrEqual(1);

      // --- Verify tag suggestions (from published article titles) ---
      const suggestionsRes = await request(app).get('/api/tags/suggestions');
      expect(suggestionsRes.status).toBe(200);
      expect(suggestionsRes.body.suggestions).toBeDefined();

      // --- Update remaining tag ---
      const updateRes = await request(app)
        .put(`/api/tags/${tsTagId}`)
        .set('Cookie', adminCookies as unknown as string)
        .send({ name: 'TS', slug: 'ts' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('TS');

      // --- Delete remaining tag ---
      const deleteRes = await request(app)
        .delete(`/api/tags/${tsTagId}`)
        .set('Cookie', adminCookies as unknown as string);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // --- Verify deleted ---
      const getDeletedRes = await request(app).get(`/api/tags/${tsTagId}`);
      expect(getDeletedRes.status).toBe(404);
    });

    it('rejects duplicate tag slug', async () => {
      await request(app)
        .post('/api/tags/')
        .set('Cookie', adminCookies as unknown as string)
        .send({ name: 'Node.js', slug: 'nodejs' });

      const res = await request(app)
        .post('/api/tags/')
        .set('Cookie', adminCookies as unknown as string)
        .send({ name: 'Node', slug: 'nodejs' });
      expect(res.status).toBe(409);
    });

    it('rejects unauthorized tag creation', async () => {
      const res = await request(app).post('/api/tags/').send({ name: 'Test', slug: 'test' });
      expect(res.status).toBe(401);
    });
  });
});
