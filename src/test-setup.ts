import { vi } from 'vitest';

vi.mock('../../lib/mongodb.js', () => ({
  connectToDatabase: vi.fn(),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(() => Promise.resolve('$2a$12$hashedpassword')),
    compare: vi.fn(() => Promise.resolve(true)),
  },
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

vi.mock('../../lib/upload.js', () => ({
  saveFile: vi.fn(() => ({
    filename: '2026-05-06/test-file.jpg',
    url: '/uploads/2026-05-06/test-file.jpg',
    originalname: 'test.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
  })),
  deleteFile: vi.fn(),
}));

vi.mock('../../lib/roles.js', () => ({
  canAccessAdmin: vi.fn(() => true),
  ROLE_LEVELS: { user: 0, author: 1, editor: 2, admin: 3, superuser: 4 },
  hasRole: vi.fn(() => true),
  ROLES: ['user', 'author', 'editor', 'admin', 'superuser'],
}));
