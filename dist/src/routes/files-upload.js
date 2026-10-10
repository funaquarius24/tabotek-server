import { Router } from 'express';
import { storeObject } from '../../lib/storage.js';
export const filesUploadRouter = Router();
filesUploadRouter.post('/upload', async (req, res) => {
    try {
        const { file: base64Data, filename, type: mimeType } = req.body;
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
        const result = await storeObject(buffer, filename, effectiveMimeType, buffer.length);
        res.status(201).json(result);
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});
