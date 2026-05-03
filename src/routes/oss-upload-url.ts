import { Router, Request, Response } from 'express';
import { createUploadTicket } from '../../lib/oss.js';

export const ossUploadUrlRouter = Router();

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

ossUploadUrlRouter.post('/upload-url', async (req: Request, res: Response) => {
  try {
    const { filename, contentType } = req.body;

    if (!filename || !contentType) {
      res.status(400).json({ error: 'filename and contentType are required' });
      return;
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      res.status(400).json({ error: `Invalid content type. Allowed: ${ALLOWED_TYPES.join(', ')}` });
      return;
    }

    const ticket = await createUploadTicket(filename, contentType);

    res.json({
      uploadUrl: ticket.uploadUrl,
      publicUrl: ticket.publicUrl,
      imageId: ticket.imageId,
    });
  } catch (error) {
    console.error('Failed to create upload ticket:', error);
    res.status(500).json({ error: 'Failed to create upload URL' });
  }
});
