import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { execSync } from 'child_process';
import { mkdirSync, unlinkSync, rmSync, statSync } from 'fs';

export const backupRouter = Router();

const ALL_COLLECTIONS = ['articles', 'categories', 'users', 'tags', 'authorRequests', 'comments', 'siteSettings', 'userSettings'] as const;

function isFullBackup(sections: string[] | undefined | null): boolean {
  if (!sections || sections.length === 0) return true;
  if (sections.includes('*')) return true;
  return sections.length === ALL_COLLECTIONS.length && ALL_COLLECTIONS.every(c => sections.includes(c));
}

backupRouter.post('/backup', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });

    if (!user || user.role !== 'superuser') {
      res.status(403).json({ error: 'Only superusers can perform backups' });
      return;
    }

    const { sections, format } = req.body;

    if (isFullBackup(sections) && format === 'mongodump') {
      const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
      const dbName = process.env.MONGODB_DB || 'tech_hub_cms';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dumpDir = `/tmp/backup-${timestamp}`;
      const archivePath = `/tmp/backup-${timestamp}.tar.gz`;

      try {
        mkdirSync(dumpDir, { recursive: true });
        execSync(`mongodump --uri="${uri}" --db=${dbName} --out="${dumpDir}"`, { stdio: 'pipe', timeout: 120000 });
        execSync(`tar -czf "${archivePath}" -C "${dumpDir}" .`, { stdio: 'pipe', timeout: 60000 });

        const stats = statSync(archivePath);

        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename="tech-hub-full-backup-${new Date().toISOString().split('T')[0]}.tar.gz"`);
        res.setHeader('Content-Length', stats.size);
        res.sendFile(archivePath, (err) => {
          if (err) console.error('Error sending backup file:', err);
          try { unlinkSync(archivePath); } catch {}
          try { rmSync(dumpDir, { recursive: true, force: true }); } catch {}
        });
      } catch (execError) {
        try { unlinkSync(archivePath); } catch {}
        try { rmSync(dumpDir, { recursive: true, force: true }); } catch {}
        console.error('mongodump failed:', execError);
        res.status(500).json({ error: 'Failed to create full database backup via mongodump' });
      }
    } else {
      let collectionsToExport: string[];
      if (!sections || sections.length === 0) {
        collectionsToExport = [...ALL_COLLECTIONS];
      } else {
        collectionsToExport = sections.filter((s: string) => ALL_COLLECTIONS.includes(s as any));
      }

      if (collectionsToExport.length === 0) {
        res.status(400).json({ error: 'No valid sections specified' });
        return;
      }

      const backup: Record<string, any[]> = {};
      for (const collection of collectionsToExport) {
        backup[collection] = await db.collection(collection).find({}).toArray();
      }

      const backupPackage = {
        version: 1,
        createdAt: new Date().toISOString(),
        database: process.env.MONGODB_DB || 'tech_hub_cms',
        collections: backup,
        stats: Object.fromEntries(
          Object.entries(backup).map(([key, docs]) => [key, docs.length])
        ),
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="tech-hub-backup-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(backupPackage);
    }
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

backupRouter.post('/restore', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });

    if (!user || user.role !== 'superuser') {
      res.status(403).json({ error: 'Only superusers can restore backups' });
      return;
    }

    const { collections } = req.body;
    if (!collections || typeof collections !== 'object') {
      res.status(400).json({ error: 'Invalid backup data' });
      return;
    }

    const results: Record<string, { inserted: number; replaced: number }> = {};
    for (const [collectionName, docs] of Object.entries(collections)) {
      if (!Array.isArray(docs) || docs.length === 0) continue;

      await db.collection(collectionName).deleteMany({});
      let inserted = 0;
      for (const doc of docs) {
        if (doc._id) doc._id = new ObjectId(doc._id);
        await db.collection(collectionName).insertOne(doc);
        inserted++;
      }
      results[collectionName] = { inserted, replaced: 0 };
    }

    res.json({
      success: true,
      restored: results,
      totalCollections: Object.keys(results).length,
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    res.status(500).json({ error: 'Failed to restore backup' });
  }
});
