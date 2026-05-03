import { Router } from 'express';
import { signUrl } from '../../lib/oss.js';
export const ossImageProxyRouter = Router();
ossImageProxyRouter.get('/image-proxy', async (req, res) => {
    try {
        const path = req.query.path;
        if (!path) {
            res.status(400).json({ error: 'path query parameter is required' });
            return;
        }
        if (!path.startsWith('uploads/')) {
            res.status(400).json({ error: 'invalid path' });
            return;
        }
        const expires = Math.floor(Date.now() / 1000) + 86400;
        const signedUrl = await signUrl('GET', path, expires);
        res.redirect(302, signedUrl);
    }
    catch (error) {
        const message = error?.message ?? 'Failed to generate image URL';
        res.status(500).json({ error: message });
    }
});
