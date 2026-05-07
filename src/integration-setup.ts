import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { Express } from 'express';

let mongoServer: MongoMemoryServer;

export async function startMemoryServer() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB = 'test_comments';
  return uri;
}

export async function stopMemoryServer() {
  if (mongoServer) {
    await mongoServer.stop();
  }
}

export async function clearCollections() {
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'test');
  await db.dropDatabase();
  await client.close();
}

export async function getApp(): Promise<Express> {
  const mod = await import('./app.js');
  return mod.app;
}

export async function resetApp() {
}
