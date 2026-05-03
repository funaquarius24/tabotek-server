import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';

export const articlesSearchRouter = Router();

articlesSearchRouter.get('/search', async (req: Request, res: Response) => {
  try {
    const { db } = await connectToDatabase();

    const query = (req.query.q as string) || '';
    const limit = parseInt(req.query.limit as string || '10');
    const page = parseInt(req.query.page as string || '1');

    if (!query.trim()) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    const searchQuery = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { excerpt: { $regex: query, $options: 'i' } },
        { content: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } },
        { 'seo.title': { $regex: query, $options: 'i' } },
        { 'seo.description': { $regex: query, $options: 'i' } },
        { 'seo.keywords': { $regex: query, $options: 'i' } }
      ],
      status: 'published'
    };

    const total = await db.collection('articles').countDocuments(searchQuery);
    const articles = await db
      .collection('articles')
      .find(searchQuery)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const articlesWithStringIds = articles.map(article => ({
      ...article,
      _id: article._id.toString(),
      categoryId: article.categoryId?.toString(),
      authorId: article.authorId?.toString(),
      publishedAt: article.publishedAt.toISOString(),
      createdAt: article.createdAt?.toISOString(),
      updatedAt: article.updatedAt?.toISOString()
    }));

    res.json({
      articles: articlesWithStringIds,
      query,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error searching articles:', error);
    res.status(500).json({ error: 'Failed to search articles' });
  }
});
