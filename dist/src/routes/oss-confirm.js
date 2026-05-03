import { Router } from 'express';
import { confirmUpload } from '../../lib/oss.js';
export const ossConfirmRouter = Router();
ossConfirmRouter.post('/confirm', async (req, res) => {
    try {
        const { imageId } = req.body;
        if (!imageId) {
            res.status(400).json({ error: 'imageId is required' });
            return;
        }
        await confirmUpload(imageId);
        res.json({ success: true });
    }
    catch (error) {
        const message = error?.message ?? 'Failed to confirm upload';
        const status = message.includes('not found') ? 404 : 500;
        res.status(status).json({ error: message });
    }
});
