import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export const authorRouter = Router();

authorRouter.get('/articles', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 15));
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const sortBy = (req.query.sortBy as string) || 'publishedAt';
    const sortOrder = parseInt(req.query.sortOrder as string) || -1;

    const { db } = await connectToDatabase();

    const query: any = { authorId: new ObjectId(userId) };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const sortField = ['title', 'status', 'publishedAt'].includes(sortBy) ? sortBy : 'publishedAt';
    const sortDir = sortOrder === 1 ? 1 : -1;

    const authorBaseQuery = { authorId: new ObjectId(userId) };

    const [total, articles, totalAll, totalPublished, totalDraft, totalArchived] = await Promise.all([
      db.collection('articles').countDocuments(query),
      db.collection('articles')
        .find(query)
        .sort({ [sortField]: sortDir })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      db.collection('articles').countDocuments({ ...authorBaseQuery }),
      db.collection('articles').countDocuments({ ...authorBaseQuery, status: 'published' }),
      db.collection('articles').countDocuments({ ...authorBaseQuery, status: 'draft' }),
      db.collection('articles').countDocuments({ ...authorBaseQuery, status: 'archived' }),
    ]);

    const authorIds = [...new Set(articles.filter(a => a.authorId).map(a => a.authorId.toString()))];
    const authors = authorIds.length
      ? await db.collection('users').find(
          { _id: { $in: authorIds.map(id => new ObjectId(id)) } },
          { projection: { _id: 1, name: 1 } }
        ).toArray()
      : [];
    const authorMap = new Map(authors.map(a => [a._id.toString(), { _id: a._id.toString(), name: a.name }]));

    res.json({
      articles: articles.map(article => ({
        ...article,
        _id: article._id.toString(),
        categoryId: article.categoryId?.toString(),
        authorId: article.authorId?.toString(),
        author: authorMap.get(article.authorId?.toString()) || null,
        publishedAt: article.publishedAt?.toISOString?.() ?? article.publishedAt,
        createdAt: article.createdAt?.toISOString?.() ?? article.createdAt,
        updatedAt: article.updatedAt?.toISOString?.() ?? article.updatedAt,
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      counts: {
        '': totalAll,
        published: totalPublished,
        draft: totalDraft,
        archived: totalArchived,
      },
    });
  } catch (error) {
    console.error('Error fetching author articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

authorRouter.get('/comments', async (req: Request, res: Response) => {
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
