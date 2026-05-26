import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';

export const adminStatsRouter = Router();

adminStatsRouter.get('/stats', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!canAccessAdmin(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const [
      totalArticles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      totalCategories,
      totalUsers,
      totalTags,
      superusers,
      admins,
      editors,
      authors,
      users
    ] = await Promise.all([
      db.collection('articles').countDocuments(),
      db.collection('articles').countDocuments({ status: 'published' }),
      db.collection('articles').countDocuments({ status: 'draft' }),
      db.collection('articles').countDocuments({ status: 'archived' }),
      db.collection('categories').countDocuments(),
      db.collection('users').countDocuments(),
      db.collection('tags').countDocuments(),
      db.collection('users').countDocuments({ role: 'superuser' }),
      db.collection('users').countDocuments({ role: 'admin' }),
      db.collection('users').countDocuments({ role: 'editor' }),
      db.collection('users').countDocuments({ role: 'author' }),
      db.collection('users').countDocuments({ role: 'user' }),
    ]);

    res.json({
      totalArticles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      totalCategories,
      totalUsers,
      totalTags,
      roleCounts: { superuser: superusers, admin: admins, editor: editors, author: authors, user: users },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
