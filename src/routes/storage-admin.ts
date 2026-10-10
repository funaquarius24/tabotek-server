import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';
import { isOssConfigured, getStorageBackend, migrateDatabaseToOss } from '../../lib/storage.js';

export const storageAdminRouter = Router();

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const userId = req.cookies?.user_id;
  if (!userId || !ObjectId.isValid(userId)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { role: 1 } }
  );

  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  if (!canAccessAdmin(user.role)) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }

  return true;
}

storageAdminRouter.get('/storage/status', async (req: Request, res: Response) => {
  try {
    const authorized = await requireAdmin(req, res);
    if (!authorized) return;

    const { db } = await connectToDatabase();

    const [backend, databaseObjectCount, ossObjectCount, localObjectCount] = await Promise.all([
      getStorageBackend(),
      db.collection('files').countDocuments({ storage: 'database' }),
      db.collection('files').countDocuments({ storage: 'oss' }),
      db.collection('files').countDocuments({ storage: 'local' }),
    ]);

    res.json({
      storageBackend: backend,
      ossConfigured: isOssConfigured(),
      databaseObjectCount,
      ossObjectCount,
      localObjectCount,
    });
  } catch (error) {
    console.error('Error fetching storage status:', error);
    res.status(500).json({ error: 'Failed to fetch storage status' });
  }
});

storageAdminRouter.post('/storage/migrate-to-oss', async (req: Request, res: Response) => {
  try {
    const authorized = await requireAdmin(req, res);
    if (!authorized) return;

    if (!isOssConfigured()) {
      res.status(400).json({ error: 'OSS is not configured. Add OSS_REGION, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET first.' });
      return;
    }

    const result = await migrateDatabaseToOss();
    res.json(result);
  } catch (error: any) {
    console.error('Error migrating to OSS:', error);
    res.status(500).json({ error: error?.message ?? 'Failed to migrate to OSS' });
  }
});
