import { vi, beforeEach } from 'vitest';
vi.mock('../../lib/mongodb.js', () => ({ connectToDatabase: vi.fn() }));
import request from 'supertest';
import { app } from '../app.js';
import { connectToDatabase } from '../../lib/mongodb.js';
import { setupMockDb, getMockCollection } from '../test-utils.js';

describe('GET /api/redirect', () => {
  beforeEach(() => {
    setupMockDb(connectToDatabase);
  });

  it('returns redirect mapping', async () => {
    getMockCollection('redirects').findOne.mockResolvedValue({
      from: '/old-path',
      to: '/new-path',
      statusCode: 301,
    });

    const res = await request(app).get('/api/redirect?from=/old-path');
    expect(res.status).toBe(200);
    expect(res.body.from).toBe('/old-path');
    expect(res.body.to).toBe('/new-path');
    expect(res.body.statusCode).toBe(301);
  });

  it('rejects missing from parameter', async () => {
    const res = await request(app).get('/api/redirect');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('from');
  });

  it('returns 404 for non-existent redirect', async () => {
    getMockCollection('redirects').findOne.mockResolvedValue(null);

    const res = await request(app).get('/api/redirect?from=/nonexistent');
    expect(res.status).toBe(404);
  });
});
