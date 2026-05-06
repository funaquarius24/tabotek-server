import { startMemoryServer, stopMemoryServer, clearCollections, getApp } from '../integration-setup.js';
import { Express } from 'express';
import request from 'supertest';
import { vi } from 'vitest';

vi.mock('../../lib/roles.js', () => ({
  canAccessAdmin: vi.fn(() => true),
  ROLE_LEVELS: { user: 0, author: 1, editor: 2, admin: 3, superuser: 4 },
  hasRole: vi.fn(() => true),
  ROLES: ['user', 'author', 'editor', 'admin', 'superuser'],
}));

let app: Express;
let adminCookies: string[];

beforeAll(async () => {
  await startMemoryServer();
  app = await getApp();
});

afterAll(async () => {
  await stopMemoryServer();
});

beforeEach(async () => {
  await clearCollections();
  await request(app).post('/api/auth/signup').send({ email: 'admin@example.com', password: 'password123', name: 'Admin' });
  const signinRes = await request(app).post('/api/auth/signin').send({ email: 'admin@example.com', password: 'password123' });
  adminCookies = (signinRes.headers['set-cookie'] || []) as unknown as string[];
});

describe('Categories Integration', () => {
  describe('Category CRUD', () => {
    it('creates, lists, gets, updates, and deletes a category', async () => {
      // --- Create category ---
      const createRes = await request(app)
        .post('/api/categories/')
        .set('Cookie', adminCookies as unknown as string)
        .send({ name: 'Technology', slug: 'technology', description: 'Tech articles' });
      expect(createRes.status).toBe(201);
      expect(createRes.body.name).toBe('Technology');
      const categoryId = createRes.body._id;

      // --- Create subcategory ---
      const subRes = await request(app)
        .post('/api/categories/')
        .set('Cookie', adminCookies as unknown as string)
        .send({ name: 'Web Development', slug: 'web-dev', parentCategory: categoryId });
      expect(subRes.status).toBe(201);

      // --- List categories ---
      const listRes = await request(app).get('/api/categories/');
      expect(listRes.status).toBe(200);
      expect(listRes.body.categories.length).toBe(2);

      // --- Get category by ID ---
      const getRes = await request(app).get(`/api/categories/${categoryId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('Technology');

      // --- Get category by slug ---
      const getBySlugRes = await request(app).get('/api/categories/technology');
      expect(getBySlugRes.status).toBe(200);
      expect(getBySlugRes.body.name).toBe('Technology');

      // --- Update category ---
      const updateRes = await request(app)
        .put(`/api/categories/${categoryId}`)
        .set('Cookie', adminCookies as unknown as string)
        .send({ name: 'Tech', slug: 'tech' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('Tech');

      // --- Delete subcategory (no children) ---
      const deleteSubRes = await request(app)
        .delete(`/api/categories/${subRes.body._id}`)
        .set('Cookie', adminCookies as unknown as string);
      expect(deleteSubRes.status).toBe(200);

      // --- Cannot delete parent with children (subcategory still exists in test, we already deleted it)
      // Actually let's test: delete parent category
      const deleteRes = await request(app)
        .delete(`/api/categories/${categoryId}`)
        .set('Cookie', adminCookies as unknown as string);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // --- Verify deleted ---
      const getDeletedRes = await request(app).get(`/api/categories/${categoryId}`);
      expect(getDeletedRes.status).toBe(404);
    });

    it('refuses to delete category with child categories', async () => {
      const parentRes = await request(app)
        .post('/api/categories/')
        .set('Cookie', adminCookies as unknown as string)
        .send({ name: 'Parent', slug: 'parent' });

      await request(app)
        .post('/api/categories/')
        .set('Cookie', adminCookies as unknown as string)
        .send({ name: 'Child', slug: 'child', parentCategory: parentRes.body._id });

      const deleteRes = await request(app)
        .delete(`/api/categories/${parentRes.body._id}`)
        .set('Cookie', adminCookies as unknown as string);
      expect(deleteRes.status).toBe(400);
      expect(deleteRes.body.error).toContain('child categories');
    });

    it('rejects unauthorized category creation', async () => {
      const res = await request(app)
        .post('/api/categories/')
        .send({ name: 'Test', slug: 'test' });
      expect(res.status).toBe(401);
    });
  });
});
