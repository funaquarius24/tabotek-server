import { Router, Request, Response } from 'express';
import { getFileRecord, resolveStorage } from '../../lib/storage.js';
import { signUrl } from '../../lib/oss.js';

export const storageRouter = Router();

storageRouter.get('/file/:id', async (req: Request, res: Response) => {
  try {
    const file = await getFileRecord(req.params.id);

    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const storage = resolveStorage(file);

    if (storage === 'database') {
      const data = file.data as Buffer | undefined;

      if (!data) {
        res.status(404).json({ error: 'File data not found' });
        return;
      }

      const contentType = (file.type as string) || 'application/octet-stream';
      const range = req.headers.range;

      if (range) {
        const match = /bytes=(\d*)-(\d*)/.exec(range);
        let start = 0;
        let end = data.length - 1;

        if (match) {
          if (match[1]) start = parseInt(match[1], 10);
          if (match[2]) end = parseInt(match[2], 10);
          if (Number.isNaN(start)) start = 0;
          if (Number.isNaN(end) || end >= data.length) end = data.length - 1;
        }

        if (start > end || start >= data.length) {
          res.status(416).setHeader('Content-Range', `bytes */${data.length}`);
          res.end();
          return;
        }

        const chunk = data.subarray(start, end + 1);
        res.status(206);
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', chunk.length);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.send(chunk);
        return;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', data.length);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.send(data);
      return;
    }

    if (storage === 'oss') {
      const objectName = file.filename as string;
      const expires = Math.floor(Date.now() / 1000) + 86400;
      const signedUrl = signUrl('GET', objectName, expires);
      res.redirect(302, signedUrl);
      return;
    }

    res.redirect(302, (file.url as string) || `/uploads/${file.filename}`);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});
