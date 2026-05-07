import { startMemoryServer, stopMemoryServer, clearCollections, getApp } from '../integration-setup.js';
import { Express } from 'express';
import request from 'supertest';
import { vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { resetRateLimits } from './comments.js';
import { randomUUID } from 'crypto';

vi.mock('../../lib/oss.js', () => ({
  signUrl: vi.fn(() => 'https://signed-url.example.com/path'),
  getOssEndpoint: vi.fn(() => 'https://oss.example.com/object'),
  createUploadTicket: vi.fn(() => Promise.resolve({ uploadUrl: '', publicUrl: '', imageId: '' })),
  confirmUpload: vi.fn(() => Promise.resolve()),
}));

let app: Express;

function uniqueSlug(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

beforeAll(async () => {
  await startMemoryServer();
  app = await getApp();
});

afterAll(async () => {
  await stopMemoryServer();
});

async function createUser(email: string, name: string, role: string, password = 'password123') {
  const { connectToDatabase } = await import('../../lib/mongodb.js');
  const { db } = await connectToDatabase();
  const passwordHash = await bcrypt.hash(password, 4);
  const result = await db.collection('users').insertOne({ email, name, role, passwordHash, avatar: '', createdAt: new Date(), updatedAt: new Date() });
  return result.insertedId.toString();
}

async function signIn(email: string, password = 'password123') {
  const res = await request(app).post('/api/auth/signin').send({ email, password });
  return (res.headers['set-cookie'] || []) as unknown as string[];
}

async function setupArticle(uniqueSlug: string) {
  await clearCollections();
  resetRateLimits();
  await createUser('admin@test.com', 'Admin', 'admin');
  await createUser('author@test.com', 'Author', 'author');
  await createUser('commenter@test.com', 'Commenter', 'user');
  const ac = await signIn('admin@test.com');
  const auc = await signIn('author@test.com');
  const cc = await signIn('commenter@test.com');
  const catRes = await request(app).post('/api/categories/').set('Cookie', ac as unknown as string).send({ name: 'Test', slug: `test-cat-${uniqueSlug}` });
  await request(app).post('/api/articles/').set('Cookie', auc as unknown as string).send({
    title: 'Test', slug: uniqueSlug, content: 'Content', categoryId: catRes.body._id, status: 'draft', allowComments: true,
  });
  return { adminCookies: ac, authorCookies: auc, commenterCookies: cc };
}

describe('Comments Integration', () => {
  describe('Threaded replies', () => {
    it('creates a threaded reply chain up to depth 3', async () => {
      const slug = uniqueSlug('threaded');
      const { adminCookies, commenterCookies } = await setupArticle(slug);

      const cc = commenterCookies as unknown as string;
      const c1 = await request(app).post(`/api/articles/${slug}/comments`).set('Cookie', cc).send({ content: 'Level 0' });
      expect(c1.status).toBe(201);
      const c2 = await request(app).post(`/api/articles/${slug}/comments`).set('Cookie', cc).send({ content: 'Level 1', parentId: c1.body._id });
      expect(c2.status).toBe(201); expect(c2.body.depth).toBe(1);
      const c3 = await request(app).post(`/api/articles/${slug}/comments`).set('Cookie', cc).send({ content: 'Level 2', parentId: c2.body._id });
      expect(c3.status).toBe(201); expect(c3.body.depth).toBe(2);
      const c4 = await request(app).post(`/api/articles/${slug}/comments`).set('Cookie', cc).send({ content: 'Level 3', parentId: c3.body._id });
      expect(c4.status).toBe(201); expect(c4.body.depth).toBe(3);
      const c5 = await request(app).post(`/api/articles/${slug}/comments`).set('Cookie', cc).send({ content: 'Too deep', parentId: c4.body._id });
      expect(c5.status).toBe(400); expect(c5.body.error).toContain('Maximum reply depth');

      const list = await request(app).get(`/api/articles/${slug}/comments`);
      expect(list.status).toBe(200);
      expect(list.body.comments.length).toBe(4);
    });
  });

  describe('Comment likes', () => {
    it('likes and displays like count', async () => {
      const slug = uniqueSlug('likes');
      const { commenterCookies } = await setupArticle(slug);
      const cc = commenterCookies as unknown as string;

      const c1 = await request(app).post(`/api/articles/${slug}/comments`).set('Cookie', cc).send({ content: 'Nice!' });
      expect(c1.status).toBe(201);

      const likeRes = await request(app).post(`/api/articles/${slug}/comments/${c1.body._id}/like`).send({ vote: 'like' });
      expect(likeRes.status).toBe(200);
      expect(likeRes.body.likes).toBe(1);

      const list = await request(app).get(`/api/articles/${slug}/comments`);
      expect(list.body.comments[0].likes).toBe(1);
    });

    it('returns 404 for non-existent comment like', async () => {
      const slug = uniqueSlug('like404');
      await setupArticle(slug);
      const res = await request(app).post(`/api/articles/${slug}/comments/${new ObjectId()}/like`).send({ vote: 'like' });
      expect(res.status).toBe(404);
    });
  });

  describe('Admin delete', () => {
    it('admin can delete a comment', async () => {
      const slug = uniqueSlug('delete');
      const { adminCookies, commenterCookies } = await setupArticle(slug);
      const cc = commenterCookies as unknown as string;

      const c1 = await request(app).post(`/api/articles/${slug}/comments`).set('Cookie', cc).send({ content: 'Delete me' });
      expect(c1.status).toBe(201);

      const delRes = await request(app).delete(`/api/articles/${slug}/comments/${c1.body._id}`).set('Cookie', adminCookies as unknown as string);
      expect(delRes.status).toBe(200);

      const list = await request(app).get(`/api/articles/${slug}/comments`);
      expect(list.body.comments.length).toBe(0);
    });
  });
});
