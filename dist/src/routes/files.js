import { Router } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { deleteObject } from '../../lib/storage.js';
export const filesRouter = Router();
filesRouter.get('/', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
        const page = parseInt(req.query.page || '1');
        const limit = parseInt(req.query.limit || '20');
        const type = req.query.type;
        const search = req.query.search;
        let query = {};
        if (type) {
            if (type === 'image') {
                query.type = { $regex: '^image/' };
            }
            else if (type === 'video') {
                query.type = { $regex: '^video/' };
            }
            else if (type === 'document') {
                query.type = { $regex: '^(application|text)/' };
            }
        }
        if (search) {
            query.originalname = { $regex: search, $options: 'i' };
        }
        const total = await db.collection('files').countDocuments(query);
        const files = await db
            .collection('files')
            .find(query, { projection: { data: 0 } })
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
    }
    catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ error: 'Failed to fetch files' });
    }
});
filesRouter.delete('/', async (req, res) => {
    try {
        const id = req.query.id;
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
        await deleteObject(file);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});
