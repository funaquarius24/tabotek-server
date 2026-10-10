import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export const articlesCountsRouter = Router();

articlesCountsRouter.get('/counts', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { role: 1 } }
    );

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const allowedRoles = ['editor', 'admin', 'superuser'];
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const [total, published, draft, archived] = await Promise.all([
      db.collection('articles').countDocuments(),
      db.collection('articles').countDocuments({ status: 'published' }),
      db.collection('articles').countDocuments({ status: 'draft' }),
      db.collection('articles').countDocuments({ status: 'archived' }),
    ]);

    res.json({ total, published, draft, archived });
  } catch (error) {
    console.error('Error fetching article counts:', error);
    res.status(500).json({ error: 'Failed to fetch article counts' });
  }
});
