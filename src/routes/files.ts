import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { deleteFile as removeFileFromDisk } from '../../lib/upload.js';

export const filesRouter = Router();

filesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { db } = await connectToDatabase();

    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const type = req.query.type as string | undefined;
    const search = req.query.search as string | undefined;

    let query: any = {};

    if (type) {
      if (type === 'image') {
        query.type = { $regex: '^image/' };
      } else if (type === 'video') {
        query.type = { $regex: '^video/' };
      } else if (type === 'document') {
        query.type = { $regex: '^(application|text)/' };
      }
    }

    if (search) {
      query.originalname = { $regex: search, $options: 'i' };
    }

    const total = await db.collection('files').countDocuments(query);
    const files = await db
      .collection('files')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const filesWithStringIds = files.map(f => ({
      ...f,
      _id: f._id.toString(),
      createdAt: f.createdAt?.toISOString?.() ?? f.createdAt,
    }));

    res.json({
      files: filesWithStringIds,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

filesRouter.delete('/', async (req: Request, res: Response) => {
  try {
    const id = req.query.id as string;

    if (!id) {
      res.status(400).json({ error: 'File ID is required' });
      return;
    }

    const { db } = await connectToDatabase();
    const file = await db.collection('files').findOne({ _id: new ObjectId(id) });

    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    removeFileFromDisk(file.filename);
    await db.collection('files').deleteOne({ _id: new ObjectId(id) });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});
