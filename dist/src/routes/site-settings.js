import { Router } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';
export const siteSettingsRouter = Router();
const DEFAULT_SITE_SETTINGS = {
    siteTitle: 'Tech Hub & Life Skills Academy',
    siteDescription: '',
    siteUrl: '',
    contactEmail: '',
    maintenanceMode: false,
    primaryColor: 'blue',
};
async function requireAdmin(req, res) {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });
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
siteSettingsRouter.get('/site-settings', async (req, res) => {
    try {
        const authorized = await requireAdmin(req, res);
        if (!authorized)
            return;
        const { db } = await connectToDatabase();
        const doc = await db.collection('site_settings').findOne({ _id: 'global' });
        res.json({
            settings: doc?.settings ?? DEFAULT_SITE_SETTINGS,
        });
    }
    catch (error) {
        console.error('Error loading site settings:', error);
        res.status(500).json({ error: 'Failed to load site settings' });
    }
});
siteSettingsRouter.put('/site-settings', async (req, res) => {
    try {
        const authorized = await requireAdmin(req, res);
        if (!authorized)
            return;
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            res.status(400).json({ error: 'Settings object is required' });
            return;
        }
        const { db } = await connectToDatabase();
        const now = new Date();
        await db.collection('site_settings').updateOne({ _id: 'global' }, {
            $set: {
                settings,
                updatedAt: now,
            },
            $setOnInsert: {
                _id: 'global',
                createdAt: now,
            },
        }, { upsert: true });
        res.json({ success: true, settings });
    }
    catch (error) {
        console.error('Error saving site settings:', error);
        res.status(500).json({ error: 'Failed to save site settings' });
    }
});
