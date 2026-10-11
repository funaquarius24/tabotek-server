import { randomUUID } from 'crypto';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from './mongodb.js';
import { signUrl } from './oss.js';
import { deleteFile as removeFileFromDisk } from './upload.js';

export type StorageBackend = 'database' | 'oss';
export type ResolvedStorage = 'database' | 'oss' | 'local';

export interface StoredObject {
  _id: string;
  originalname: string;
  filename: string;
  url: string;
  type: string;
  size: number;
  storage: StorageBackend;
  createdAt: string;
}

export function isOssConfigured(): boolean {
  return Boolean(
    process.env.OSS_REGION &&
    process.env.OSS_ACCESS_KEY_ID &&
    process.env.OSS_ACCESS_KEY_SECRET &&
    process.env.OSS_BUCKET
  );
}

export async function getStorageBackend(): Promise<StorageBackend> {
  const { db } = await connectToDatabase();
  const doc = await db.collection('site_settings').findOne({ _id: 'global' } as any);
  const configured = doc?.settings?.storageBackend as string | undefined;

  if (configured === 'oss' && isOssConfigured()) {
    return 'oss';
  }

  return 'database';
}

function fileExtension(originalname: string): string {
  if (!originalname || !originalname.includes('.')) return '';
  return originalname.substring(originalname.lastIndexOf('.'));
}

export function toNodeBuffer(value: unknown): Buffer | null {
  if (value == null) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);

  const candidate = value as { buffer?: unknown; position?: unknown };
  if (candidate.buffer instanceof Uint8Array) {
    const end =
      typeof candidate.position === 'number' ? candidate.position : candidate.buffer.length;
    return Buffer.from(candidate.buffer.subarray(0, end));
  }

  return null;
}

async function storeInDatabase(
  buffer: Buffer,
  originalname: string,
  mimetype: string,
  size: number
): Promise<StoredObject> {
  const { db } = await connectToDatabase();
  const id = new ObjectId();
  const now = new Date();

  const doc = {
    _id: id,
    originalname,
    filename: `${randomUUID()}${fileExtension(originalname)}`,
    url: `/api/storage/file/${id.toHexString()}`,
    type: mimetype,
    size,
    storage: 'database',
    data: buffer,
    createdAt: now,
  };

  await db.collection('files').insertOne(doc);

  return {
    _id: id.toHexString(),
    originalname,
    filename: doc.filename,
    url: doc.url,
    type: mimetype,
    size,
    storage: 'database',
    createdAt: now.toISOString(),
  };
}

async function storeInOss(
  buffer: Buffer,
  originalname: string,
  mimetype: string,
  size: number
): Promise<StoredObject> {
  const objectName = `uploads/${randomUUID()}${fileExtension(originalname)}`;
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const putUrl = signUrl('PUT', objectName, expires, mimetype);

  const putRes = await fetch(putUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimetype },
    body: buffer as unknown as BodyInit,
  });

  if (!putRes.ok) {
    throw new Error(`OSS upload failed: HTTP ${putRes.status}`);
  }

  const { db } = await connectToDatabase();
  const id = new ObjectId();
  const now = new Date();

  const doc = {
    _id: id,
    originalname,
    filename: objectName,
    objectName,
    url: `/api/storage/file/${id.toHexString()}`,
    type: mimetype,
    size,
    storage: 'oss',
    createdAt: now,
  };

  await db.collection('files').insertOne(doc);

  return {
    _id: id.toHexString(),
    originalname,
    filename: objectName,
    url: doc.url,
    type: mimetype,
    size,
    storage: 'oss',
    createdAt: now.toISOString(),
  };
}

export async function storeObject(
  buffer: Buffer,
  originalname: string,
  mimetype: string,
  size: number
): Promise<StoredObject> {
  const backend = await getStorageBackend();

  if (backend === 'oss' && isOssConfigured()) {
    return storeInOss(buffer, originalname, mimetype, size);
  }

  return storeInDatabase(buffer, originalname, mimetype, size);
}

export function resolveStorage(file: any): ResolvedStorage {
  if (file?.storage === 'database' || file?.storage === 'oss' || file?.storage === 'local') {
    return file.storage;
  }
  if (file?.data) return 'database';
  if (typeof file?.filename === 'string' && file.filename.startsWith('uploads/')) return 'oss';
  return 'local';
}

export async function getFileRecord(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  return db.collection('files').findOne({ _id: new ObjectId(id) });
}

export async function deleteObject(file: any): Promise<void> {
  const storage = resolveStorage(file);

  if (storage === 'oss') {
    const objectName = file.filename as string;
    try {
      const expires = Math.floor(Date.now() / 1000) + 60;
      const deleteUrl = signUrl('DELETE', objectName, expires);
      await fetch(deleteUrl, { method: 'DELETE' });
    } catch {
      // best-effort removal from OSS; the metadata record is removed below
    }
  } else if (storage === 'local') {
    removeFileFromDisk(file.filename);
  }
  // database objects are removed with the document itself

  const { db } = await connectToDatabase();
  await db.collection('files').deleteOne({ _id: file._id });
}

export async function migrateDatabaseToOss(): Promise<{ moved: number; failed: string[] }> {
  if (!isOssConfigured()) {
    throw new Error('OSS is not configured. Set OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET first.');
  }

  const { db } = await connectToDatabase();
  const files = await db.collection('files').find({ storage: 'database' }).toArray();

  let moved = 0;
  const failed: string[] = [];

  for (const file of files) {
    try {
      const data = toNodeBuffer(file.data);
      if (!data) {
        throw new Error('missing binary data');
      }

      const contentType = (file.type as string) || 'application/octet-stream';
      const objectName = `uploads/${randomUUID()}${fileExtension(file.originalname)}`;
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const putUrl = signUrl('PUT', objectName, expires, contentType);

      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: data as unknown as BodyInit,
      });

      if (!putRes.ok) {
        throw new Error(`OSS PUT failed: HTTP ${putRes.status}`);
      }

      await db.collection('files').updateOne(
        { _id: file._id },
        {
          $set: {
            storage: 'oss',
            filename: objectName,
            objectName,
            url: `/api/storage/file/${file._id.toString()}`,
          },
          $unset: { data: '' },
        }
      );

      moved += 1;
    } catch {
      failed.push(file._id.toString());
    }
  }

  return { moved, failed };
}
