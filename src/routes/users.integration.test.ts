import { startMemoryServer, stopMemoryServer, clearCollections, getApp } from '../integration-setup.js';
import { Express } from 'express';
import request from 'supertest';
import { vi } from 'vitest';

vi.mock('../../lib/roles.js', () => ({
  canAccessAdmin: vi.fn(() => true),
  ROLE_LEVELS: { user: 0, author: 1, editor: 2, admin: 3, superuser: 4 },
  hasRole: vi.fn(() => true),
  ROLES: ['user', 'author', 'editor', 'admin', 'superuser'],
  getRolesAtOrAbove: vi.fn(),
  getRolesBelow: vi.fn(),
  getRoleDisplayName: vi.fn(),
  getRoleColorClass: vi.fn(),
  canManageUsers: vi.fn(() => true),
  canManageSettings: vi.fn(() => true),
}));

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

describe('Users Integration', () => {
  let superuserCookies: string[];
  let userCookies: string[];
  let userId: string;

  beforeEach(async () => {
    // Sign up a regular user
    await request(app).post('/api/auth/signup').send({ email: 'user@example.com', password: 'password123', name: 'Regular User' });
    const userSigninRes = await request(app).post('/api/auth/signin').send({ email: 'user@example.com', password: 'password123' });
    userCookies = (userSigninRes.headers['set-cookie'] || []) as unknown as string[];
    userId = userSigninRes.body.user._id;
  });

  describe('User management', () => {
    it('lists users and retrieves user details', async () => {
      // List users
      const listRes = await request(app)
        .get('/api/users/')
        .set('Cookie', userCookies as unknown as string);
      expect(listRes.status).toBe(200);
      expect(listRes.body.users.length).toBe(1);
      expect(listRes.body.users[0].email).toBe('user@example.com');

      // Get user by ID
      const getRes = await request(app)
        .get(`/api/users/${userId}`)
        .set('Cookie', userCookies as unknown as string);
      expect(getRes.status).toBe(200);
      expect(getRes.body.name).toBe('Regular User');
    });

    it('updates own profile', async () => {
      const updateRes = await request(app)
        .put(`/api/users/${userId}`)
        .set('Cookie', userCookies as unknown as string)
        .send({ name: 'Updated Name', bio: 'A regular user' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('Updated Name');
      expect(updateRes.body.bio).toBe('A regular user');
    });

    it('returns 401 for unauthenticated user list', async () => {
      const res = await request(app).get('/api/users/');
      expect(res.status).toBe(401);
    });
  });

  describe('User settings', () => {
    it('saves and retrieves user settings', async () => {
      // Get default settings
      const getDefaultRes = await request(app).get('/api/user/settings');
      expect(getDefaultRes.status).toBe(200);
      expect(getDefaultRes.body.settings.editorFontFamily).toBe('Geist Mono');

      // Update settings
      const updateRes = await request(app)
        .put('/api/user/settings')
        .set('Cookie', userCookies as unknown as string)
        .send({ settings: { editorFontSize: 18, darkMode: true } });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.settings.editorFontSize).toBe(18);
      expect(updateRes.body.settings.darkMode).toBe(true);

      // Verify persisted
      const getRes = await request(app)
        .get('/api/user/settings')
        .set('Cookie', userCookies as unknown as string);
      expect(getRes.status).toBe(200);
      expect(getRes.body.settings.editorFontSize).toBe(18);
      expect(getRes.body.settings.darkMode).toBe(true);
    });

    it('rejects unauthenticated settings update', async () => {
      const res = await request(app)
        .put('/api/user/settings')
        .send({ settings: { editorFontSize: 18 } });
      expect(res.status).toBe(401);
    });
  });

  describe('Redirect', () => {
    it('creates and resolves a redirect via slug change', async () => {
      // Create a category
      const catRes = await request(app)
        .post('/api/categories/')
        .set('Cookie', userCookies as unknown as string)
        .send({ name: 'Test', slug: 'old-slug' });
      expect(catRes.status).toBe(201);

      // Update category slug (creates redirect)
      await request(app)
        .put(`/api/categories/${catRes.body._id}`)
        .set('Cookie', userCookies as unknown as string)
        .send({ slug: 'new-slug' });

      // Look up redirect
      const redirectRes = await request(app).get('/api/redirect?from=/category/old-slug');
      expect(redirectRes.status).toBe(200);
      expect(redirectRes.body.from).toBe('/category/old-slug');
      expect(redirectRes.body.to).toBe('/category/new-slug');
      expect(redirectRes.body.statusCode).toBe(301);
    });

    it('returns 404 for missing redirect', async () => {
      const res = await request(app).get('/api/redirect?from=/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
