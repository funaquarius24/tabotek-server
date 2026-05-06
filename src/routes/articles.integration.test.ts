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

describe('Articles Integration', () => {
  let authorCookies: string[];
  let adminCookies: string[];
  let categoryId: string;

  beforeEach(async () => {
    const authorId = await createUser('author@test.com', 'Author', 'author');
    const adminId = await createUser('admin@test.com', 'Admin', 'admin');
    authorCookies = await signIn('author@test.com');
    adminCookies = await signIn('admin@test.com');

    const catRes = await request(app)
      .post('/api/categories/')
      .set('Cookie', adminCookies as unknown as string)
      .send({ name: 'Tech', slug: 'tech' });
    categoryId = catRes.body._id;
  });

  describe('Article CRUD', () => {
    let articleSlug: string;

    it('creates, reads, searches, votes, updates, and deletes an article', async () => {
      // --- Create article ---
      const createRes = await request(app)
        .post('/api/articles/')
        .set('Cookie', authorCookies as unknown as string)
        .send({
          title: 'Getting Started with TypeScript',
          slug: 'getting-started-typescript',
          content: 'TypeScript is a typed superset of JavaScript...',
          excerpt: 'Learn TypeScript basics',
          categoryId,
          status: 'published',
          tags: ['typescript', 'javascript'],
        });
      expect(createRes.status).toBe(201);
      expect(createRes.body.title).toBe('Getting Started with TypeScript');
      articleSlug = createRes.body.slug;

      // --- Create another article ---
      await request(app)
        .post('/api/articles/')
        .set('Cookie', authorCookies as unknown as string)
        .send({
          title: 'Advanced TypeScript Patterns',
          slug: 'advanced-typescript',
          content: 'Advanced patterns...',
          categoryId,
          status: 'published',
        });
      expect(createRes.status).toBe(201);

      // --- List articles ---
      const listRes = await request(app).get('/api/articles/');
      expect(listRes.status).toBe(200);
      expect(listRes.body.articles.length).toBeGreaterThanOrEqual(2);
      expect(listRes.body.pagination.total).toBeGreaterThanOrEqual(2);

      // --- Search articles ---
      const searchRes = await request(app).get('/api/articles/search?q=TypeScript');
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.articles.length).toBeGreaterThanOrEqual(1);

      // --- Get single article ---
      const getRes = await request(app).get(`/api/articles/${articleSlug}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.title).toBe('Getting Started with TypeScript');
      const initialViews = getRes.body.views;

      // --- Views increment on read ---
      const getRes2 = await request(app).get(`/api/articles/${articleSlug}`);
      expect(getRes2.status).toBe(200);
      expect(getRes2.body.views).toBe(initialViews + 1);

      // --- Vote on article ---
      const voteRes = await request(app)
        .post(`/api/articles/${articleSlug}/vote`)
        .send({ vote: 'like' });
      expect(voteRes.status).toBe(200);
      expect(voteRes.body.likes).toBe(1);

      // --- Change vote ---
      const voteRes2 = await request(app)
        .post(`/api/articles/${articleSlug}/vote`)
        .send({ vote: 'dislike', previousVote: 'like' });
      expect(voteRes2.status).toBe(200);
      expect(voteRes2.body.likes).toBe(0);
      expect(voteRes2.body.dislikes).toBe(1);

      // --- Clear vote ---
      const voteRes3 = await request(app)
        .post(`/api/articles/${articleSlug}/vote`)
        .send({ vote: null, previousVote: 'dislike' });
      expect(voteRes3.status).toBe(200);
      expect(voteRes3.body.dislikes).toBe(0);

      // --- Update article ---
      const updateRes = await request(app)
        .put(`/api/articles/${articleSlug}`)
        .set('Cookie', authorCookies as unknown as string)
        .send({ title: 'Getting Started with TypeScript (Updated)' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.title).toBe('Getting Started with TypeScript (Updated)');

      // --- Delete article ---
      const deleteRes = await request(app)
        .delete(`/api/articles/${articleSlug}`)
        .set('Cookie', authorCookies as unknown as string);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // --- Verify deleted ---
      const getDeleted = await request(app).get(`/api/articles/${articleSlug}`);
      expect(getDeleted.status).toBe(404);
    });

    it('rejects unauthorized article creation', async () => {
      const res = await request(app)
        .post('/api/articles/')
        .send({ title: 'Test', slug: 'test', content: 'Content', categoryId });
      expect(res.status).toBe(401);
    });

    it('rejects duplicate slug', async () => {
      await request(app)
        .post('/api/articles/')
        .set('Cookie', authorCookies as unknown as string)
        .send({ title: 'First', slug: 'duplicate-slug', content: 'Content', categoryId });

      const res = await request(app)
        .post('/api/articles/')
        .set('Cookie', authorCookies as unknown as string)
        .send({ title: 'Second', slug: 'duplicate-slug', content: 'Content', categoryId });
      expect(res.status).toBe(409);
    });
  });
});
