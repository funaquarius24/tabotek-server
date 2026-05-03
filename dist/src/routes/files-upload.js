import { Router } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { saveFile } from '../../lib/upload.js';
export const filesUploadRouter = Router();
filesUploadRouter.post('/upload', async (req, res) => {
    try {
        const { file: base64Data, filename, type: mimeType, unique } = req.body;
        if (!base64Data || !filename) {
            res.status(400).json({ error: 'No file provided' });
            return;
        }
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
            'video/mp4', 'video/webm', 'video/ogg',
            'application/pdf', 'application/zip', 'application/gzip',
            'text/plain', 'text/csv',
        ];
        let buffer;
        let detectedMimeType;
        if (base64Data.startsWith('data:')) {
            const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) {
                res.status(400).json({ error: 'Invalid data URL format' });
                return;
            }
            detectedMimeType = matches[1];
            buffer = Buffer.from(matches[2], 'base64');
        }
        else {
            buffer = Buffer.from(base64Data, 'base64');
            detectedMimeType = mimeType || 'application/octet-stream';
        }
        const effectiveMimeType = mimeType || detectedMimeType;
        if (!allowedTypes.includes(effectiveMimeType)) {
            res.status(400).json({ error: 'File type not allowed' });
            return;
        }
        if (buffer.length > 10 * 1024 * 1024) {
            res.status(400).json({ error: 'File too large (max 10MB)' });
            return;
        }
        const result = saveFile(buffer, filename, effectiveMimeType, buffer.length, unique || 0);
        const { db } = await connectToDatabase();
        const doc = {
            originalname: result.originalname,
            filename: result.filename,
            url: result.url,
            type: result.mimetype,
            size: result.size,
            createdAt: new Date(),
        };
        const insertResult = await db.collection('files').insertOne(doc);
        res.status(201).json({
            _id: insertResult.insertedId.toString(),
            ...doc,
            createdAt: doc.createdAt.toISOString(),
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});
