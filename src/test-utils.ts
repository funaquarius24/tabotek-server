import { vi } from 'vitest';
import { ObjectId } from 'mongodb';

type MockCollection = {
  findOne: ReturnType<typeof vi.fn>;
  find: ReturnType<typeof vi.fn>;
  insertOne: ReturnType<typeof vi.fn>;
  updateOne: ReturnType<typeof vi.fn>;
  deleteOne: ReturnType<typeof vi.fn>;
  countDocuments: ReturnType<typeof vi.fn>;
  updateMany: ReturnType<typeof vi.fn>;
  aggregate: ReturnType<typeof vi.fn>;
  toArray: ReturnType<typeof vi.fn>;
  project: ReturnType<typeof vi.fn>;
  sort: ReturnType<typeof vi.fn>;
  skip: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

const createMockCollection = (): MockCollection => {
  const mockToArray = vi.fn();
  const mockProject = vi.fn(() => ({ toArray: mockToArray }));
  const mockSort = vi.fn(() => ({ skip: mockSkip, limit: mockLimit, toArray: mockToArray, project: mockProject }));
  const mockSkip = vi.fn(() => ({ limit: mockLimit, toArray: mockToArray, project: mockProject }));
  const mockLimit = vi.fn(() => ({ toArray: mockToArray, project: mockProject }));

  return {
    findOne: vi.fn(),
    find: vi.fn(() => ({ sort: mockSort, skip: mockSkip, limit: mockLimit, toArray: mockToArray, project: mockProject })),
    insertOne: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
    countDocuments: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(() => ({ toArray: mockToArray })),
    toArray: mockToArray,
    project: mockProject,
    sort: mockSort,
    skip: mockSkip,
    limit: mockLimit,
  };
};

const collections = new Map<string, MockCollection>();

const mockDb = {
  collection: vi.fn((name: string) => {
    if (!collections.has(name)) {
      collections.set(name, createMockCollection());
    }
    return collections.get(name)!;
  }),
};

export function setupMockDb(connectToDatabaseMock: any) {
  collections.clear();
  connectToDatabaseMock.mockResolvedValue({ db: mockDb, client: {} });
  return mockDb;
}

export function getMockCollection(name: string): MockCollection {
  return mockDb.collection(name) as unknown as MockCollection;
}

export function createId(): string {
  return new ObjectId().toString();
}
