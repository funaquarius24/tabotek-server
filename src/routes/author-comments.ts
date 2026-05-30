import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export const authorCommentsRouter = Router();

authorCommentsRouter.get('/comments', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const { db } = await connectToDatabase();

    const userArticles = await db.collection('articles')
      .find({ authorId: new ObjectId(userId) })
      .project({ slug: 1, title: 1 })
      .toArray();

    const articleSlugs = userArticles.map(a => a.slug);
    if (articleSlugs.length === 0) {
      res.json({ comments: [], pagination: { total: 0, page, limit, totalPages: 0 } });
      return;
    }

    const query = { articleSlug: { $in: articleSlugs }, deleted: { $ne: true } };
    const [total, comments] = await Promise.all([
      db.collection('comments').countDocuments(query),
      db.collection('comments')
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    const articleTitleMap = Object.fromEntries(userArticles.map(a => [a.slug, a.title]));

    res.json({
      comments: comments.map(c => ({
        _id: c._id.toString(),
        articleSlug: c.articleSlug,
        articleTitle: articleTitleMap[c.articleSlug] || c.articleSlug,
        content: c.content,
        author: c.author,
        contentHtml: c.content,
        createdAt: c.createdAt?.toISOString(),
        updatedAt: c.updatedAt?.toISOString(),
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching author comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});
