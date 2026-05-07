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

async function createArticle(adminCookies: string[], authorCookies: string[], slug: string, allowComments = true) {
  const catRes = await request(app)
    .post('/api/categories/')
    .set('Cookie', adminCookies as unknown as string)
    .send({ name: 'Test', slug: 'test-cat' });

  return request(app)
    .post('/api/articles/')
    .set('Cookie', authorCookies as unknown as string)
    .send({
      title: 'Test Article',
      slug,
      content: 'Content',
      categoryId: catRes.body._id,
      status: 'draft',
      allowComments,
    });
}

describe('Comments Integration', () => {
  describe('Full comment flow', () => {
    it('creates, lists, and deletes comments', async () => {
      const authorId = await createUser('author@test.com', 'Author', 'author');
      const adminId = await createUser('admin@test.com', 'Admin', 'admin');
      const adminCookies = await signIn('admin@test.com');
      const authorCookies = await signIn('author@test.com');

      const articleSlug = 'test-article-comments';
      const articleRes = await createArticle(adminCookies, authorCookies, articleSlug);
      expect(articleRes.status).toBe(201);

      // List comments (should be empty)
      let res = await request(app).get(`/api/articles/${articleSlug}/comments`);
      expect(res.status).toBe(200);
      expect(res.body.comments).toEqual([]);

      // Create a comment
      res = await request(app)
        .post(`/api/articles/${articleSlug}/comments`)
        .send({ author: { name: 'Alice' }, content: 'First comment!' });
      expect(res.status).toBe(201);
      expect(res.body.author.name).toBe('Alice');

      // Create another comment
      res = await request(app)
        .post(`/api/articles/${articleSlug}/comments`)
        .send({ author: { name: 'Bob' }, content: 'Second comment!' });
      expect(res.status).toBe(201);

      // List comments (should have 2, newest first)
      res = await request(app).get(`/api/articles/${articleSlug}/comments`);
      expect(res.status).toBe(200);
      expect(res.body.comments.length).toBe(2);
      expect(res.body.comments[0].author.name).toBe('Bob');

      const commentId = res.body.comments[1]._id;

      // Delete a comment (admin only)
      res = await request(app)
        .delete(`/api/articles/${articleSlug}/comments/${commentId}`)
        .set('Cookie', adminCookies as unknown as string);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // List after delete (should have 1)
      res = await request(app).get(`/api/articles/${articleSlug}/comments`);
      expect(res.status).toBe(200);
      expect(res.body.comments.length).toBe(1);
    });
  });

  describe('Comment validation', () => {
    it('rejects comment when article does not exist', async () => {
      const res = await request(app)
        .post('/api/articles/non-existent/comments')
        .send({ author: { name: 'Alice' }, content: 'Content' });
      expect(res.status).toBe(404);
    });

    it('rejects comment when comments are disabled', async () => {
      const authorId = await createUser('author@test.com', 'Author', 'author');
      const adminId = await createUser('admin@test.com', 'Admin', 'admin');
      const adminCookies = await signIn('admin@test.com');
      const authorCookies = await signIn('author@test.com');
      const articleRes = await createArticle(adminCookies, authorCookies, 'disabled-comments', false);
      expect(articleRes.status).toBe(201);

      const res = await request(app)
        .post('/api/articles/disabled-comments/comments')
        .send({ author: { name: 'Alice' }, content: 'Content' });
      expect(res.status).toBe(403);
      expect(res.body.error).toContain('disabled');
    });

    it('rejects delete without auth', async () => {
      const res = await request(app)
        .delete(`/api/articles/test/comments/${new (await import('mongodb')).ObjectId()}`);
      expect(res.status).toBe(401);
    });

    it('rejects delete with invalid comment id', async () => {
      const adminId = await createUser('admin@test.com', 'Admin', 'admin');
      const adminCookies = await signIn('admin@test.com');

      const res = await request(app)
        .delete('/api/articles/test/comments/invalid-id')
        .set('Cookie', adminCookies as unknown as string);
      expect(res.status).toBe(400);
    });
  });
});
