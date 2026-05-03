import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export const userSettingsRouter = Router();

const DEFAULT_USER_SETTINGS: Record<string, unknown> = {
  editorFontFamily: 'Geist Mono',
  editorFontSize: 14,
  editorShowToc: true,
  darkMode: false,
};

userSettingsRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { db } = await connectToDatabase();
    const doc = await db.collection('user_settings').findOne({ userId: new ObjectId(userId) });

    res.json({
      settings: doc?.settings ?? DEFAULT_USER_SETTINGS,
    });
  } catch (error) {
    console.error('Error loading user settings:', error);
    res.status(500).json({ error: 'Failed to load user settings' });
  }
});

userSettingsRouter.put('/settings', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'Settings object is required' });
      return;
    }

    const { db } = await connectToDatabase();
    const now = new Date();

    await db.collection('user_settings').updateOne(
      { userId: new ObjectId(userId) },
      {
        $set: {
          settings,
          updatedAt: now,
        },
        $setOnInsert: {
          userId: new ObjectId(userId),
          createdAt: now,
        },
      },
      { upsert: true }
    );

    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error saving user settings:', error);
    res.status(500).json({ error: 'Failed to save user settings' });
  }
});