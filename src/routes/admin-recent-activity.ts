import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';

export const adminRecentActivityRouter = Router();

adminRecentActivityRouter.get('/recent-activity', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });

    if (!user || !canAccessAdmin(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const [recentArticles, recentCategories, recentUsers, pendingRequests, recentComments] = await Promise.all([
      db.collection('articles').find({}, {
        projection: { title: 1, slug: 1, status: 1, publishedAt: 1, updatedAt: 1, createdAt: 1 },
        sort: { updatedAt: -1, createdAt: -1, publishedAt: -1 },
        limit: 5,
      }).toArray(),

      db.collection('categories').find({}, {
        projection: { name: 1, slug: 1, updatedAt: 1, createdAt: 1 },
        sort: { updatedAt: -1, createdAt: -1 },
        limit: 3,
      }).toArray(),

      db.collection('users').find({}, {
        projection: { name: 1, email: 1, role: 1, createdAt: 1 },
        sort: { createdAt: -1 },
        limit: 3,
      }).toArray(),

      db.collection('authorRequests').find({ status: 'pending' }, {
        projection: { userName: 1, userEmail: 1, createdAt: 1 },
        sort: { createdAt: -1 },
        limit: 3,
      }).toArray(),

      db.collection('comments').find({}, {
        projection: { authorName: 1, content: 1, createdAt: 1 },
        sort: { createdAt: -1 },
        limit: 3,
      }).toArray(),
    ]);

    const activity: Array<{
      type: string;
      icon: string;
      color: string;
      title: string;
      description: string;
      timestamp: string;
      link?: string;
    }> = [];

    for (const article of recentArticles) {
      const ts = article.publishedAt || article.updatedAt || article.createdAt;
      const action = article.status === 'published' ? 'published' : 'updated';
      activity.push({
        type: 'article',
        icon: '📝',
        color: 'bg-blue-100',
        title: `Article ${action}`,
        description: `"${article.title}" was ${action}`,
        timestamp: ts?.toISOString?.() || new Date(ts).toISOString(),
        link: `/admin/articles`,
      });
    }

    for (const category of recentCategories) {
      activity.push({
        type: 'category',
        icon: '📂',
        color: 'bg-green-100',
        title: 'Category created',
        description: `"${category.name}" category was added`,
        timestamp: (category.createdAt || category.updatedAt)?.toISOString(),
        link: `/admin/categories`,
      });
    }

    for (const u of recentUsers) {
      const roleLabel = u.role.charAt(0).toUpperCase() + u.role.slice(1);
      activity.push({
        type: 'user',
        icon: '👤',
        color: 'bg-purple-100',
        title: `New ${roleLabel} registered`,
        description: `"${u.name}" (${u.email}) joined as ${u.role}`,
        timestamp: u.createdAt?.toISOString(),
        link: `/admin/users`,
      });
    }

    for (const req of pendingRequests) {
      activity.push({
        type: 'request',
        icon: '📨',
        color: 'bg-amber-100',
        title: 'Author request pending',
        description: `"${req.userName}" (${req.userEmail}) requested author access`,
        timestamp: req.createdAt?.toISOString(),
        link: `/admin/requests`,
      });
    }

    for (const comment of recentComments) {
      activity.push({
        type: 'comment',
        icon: '💬',
        color: 'bg-teal-100',
        title: 'New comment',
        description: `${comment.authorName || 'Someone'} commented`,
        timestamp: comment.createdAt?.toISOString(),
      });
    }

    activity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const top = activity.slice(0, 10);

    res.json({ activity: top });
  } catch (error) {
    console.error('Error fetching recent activity:', error);
    res.status(500).json({ error: 'Failed to fetch recent activity' });
  }
});
