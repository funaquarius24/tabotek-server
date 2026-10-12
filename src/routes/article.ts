import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { ROLE_LEVELS, UserRole } from '../../lib/roles.js';

export const articleRouter = Router();

async function getAuthorInfo(db: any, authorId: any): Promise<{ _id: string; name: string } | null> {
  if (!authorId || !ObjectId.isValid(authorId)) return null;
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(authorId) },
    { projection: { name: 1, username: 1 } }
  );
  if (!user) return null;
  return { _id: user._id.toString(), name: user.name || user.username || '' };
}

async function getAuthUser(req: Request) {
  const userId = req.cookies?.user_id;
  if (!userId || !ObjectId.isValid(userId)) return null;
  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1, _id: 1 } });
  if (!user) return null;
  const role = user.role as UserRole;
  const isAuthor = role in ROLE_LEVELS && role !== 'user';
  return { userId: user._id.toString(), role, isAuthor };
}

articleRouter.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { db } = await connectToDatabase();

    let query: any;
    if (ObjectId.isValid(slug)) {
      query = { $or: [{ _id: new ObjectId(slug) }, { slug }] };
    } else {
      query = { slug };
    }

    const article = await db.collection('articles').findOne(query);

    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    await db.collection('articles').updateOne(
      { _id: article._id },
      { $inc: { views: 1 } }
    );

    const author = await getAuthorInfo(db, article.authorId);

    const articleWithStringIds = {
      ...article,
      _id: article._id.toString(),
      categoryId: article.categoryId?.toString(),
      authorId: article.authorId?.toString(),
      authorName: article.authorName ?? author?.name ?? '',
      author,
      publishedAt: article.publishedAt?.toISOString?.() ?? article.publishedAt,
      createdAt: article.createdAt?.toISOString?.() ?? article.createdAt,
      updatedAt: article.updatedAt?.toISOString?.() ?? article.updatedAt
    };

    res.json(articleWithStringIds);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
});

articleRouter.put('/:slug', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUser(req);
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { slug } = req.params;
    const { db } = await connectToDatabase();
    const body = req.body;

    const slugQuery = ObjectId.isValid(slug)
      ? { $or: [{ _id: new ObjectId(slug) }, { slug }] }
      : { slug };
    const existingArticle = await db.collection('articles').findOne(slugQuery);
    if (!existingArticle) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    if (body.slug && body.slug !== existingArticle.slug) {
      const slugConflict = await db.collection('articles').findOne({ slug: body.slug });
      if (slugConflict) {
        res.status(409).json({ error: 'Article with this slug already exists' });
        return;
      }
    }

    if (body.status === 'published' && !auth.isAuthor) {
      res.status(403).json({ error: 'Forbidden: author privileges required to publish' });
      return;
    }

    const updateData: any = { ...body };

    if (body.categoryId) {
      updateData.categoryId = new ObjectId(body.categoryId);
    }

    if (body.authorId) {
      const newAuthorId = new ObjectId(body.authorId);
      updateData.authorId = newAuthorId;
      const authorInfo = await getAuthorInfo(db, newAuthorId);
      updateData.authorName = authorInfo?.name ?? '';
    } else {
      const authorInfo = await getAuthorInfo(db, existingArticle.authorId);
      updateData.authorName = authorInfo?.name ?? '';
    }

    if (body.status === 'published' && !existingArticle.publishedAt) {
      updateData.publishedAt = new Date();
    } else if (body.publishedAt) {
      updateData.publishedAt = new Date(body.publishedAt);
    }

    updateData.updatedAt = new Date();

    const result = await db.collection('articles').updateOne(
      { _id: existingArticle._id },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      res.status(400).json({ error: 'Article not updated' });
      return;
    }

    const updatedArticle = await db.collection('articles').findOne({ _id: existingArticle._id });
    const author = await getAuthorInfo(db, updatedArticle!.authorId);

    const articleWithStringIds = {
      ...updatedArticle,
      _id: updatedArticle!._id.toString(),
      categoryId: updatedArticle!.categoryId?.toString(),
      authorId: updatedArticle!.authorId?.toString(),
      authorName: updatedArticle!.authorName ?? author?.name ?? '',
      author,
      publishedAt: updatedArticle!.publishedAt?.toISOString?.() ?? updatedArticle!.publishedAt,
      createdAt: updatedArticle!.createdAt?.toISOString?.() ?? updatedArticle!.createdAt,
      updatedAt: updatedArticle!.updatedAt?.toISOString?.() ?? updatedArticle!.updatedAt
    };

    res.json(articleWithStringIds);
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ error: 'Failed to update article' });
  }
});

articleRouter.post('/:slug/vote', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { vote, previousVote } = req.body;

    if (!['like', 'dislike', null].includes(vote)) {
      res.status(400).json({ error: 'vote must be "like", "dislike", or null' });
      return;
    }

    const { db } = await connectToDatabase();
    const article = await db.collection('articles').findOne({ slug });
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    const articleInc: Record<string, number> = {};
    const userInc: Record<string, number> = {};

    if (previousVote === 'like') {
      articleInc.likes = -1;
      userInc.totalLikes = -1;
    } else if (previousVote === 'dislike') {
      articleInc.dislikes = -1;
      userInc.totalDislikes = -1;
    }

    if (vote === 'like') {
      articleInc.likes = (articleInc.likes || 0) + 1;
      userInc.totalLikes = (userInc.totalLikes || 0) + 1;
    } else if (vote === 'dislike') {
      articleInc.dislikes = (articleInc.dislikes || 0) + 1;
      userInc.totalDislikes = (userInc.totalDislikes || 0) + 1;
    }

    await Promise.all([
      db.collection('articles').updateOne({ slug }, { $inc: articleInc }),
      db.collection('users').updateOne({ _id: article.authorId }, { $inc: userInc }),
    ]);

    const updatedArticle = await db.collection('articles').findOne({ slug });
    const author = await getAuthorInfo(db, updatedArticle!.authorId);
    res.json({
      ...updatedArticle,
      _id: updatedArticle!._id.toString(),
      categoryId: updatedArticle!.categoryId?.toString(),
      authorId: updatedArticle!.authorId?.toString(),
      authorName: updatedArticle!.authorName ?? author?.name ?? '',
      author,
      publishedAt: updatedArticle!.publishedAt?.toISOString?.() ?? updatedArticle!.publishedAt,
      createdAt: updatedArticle!.createdAt?.toISOString?.() ?? updatedArticle!.createdAt,
      updatedAt: updatedArticle!.updatedAt?.toISOString?.() ?? updatedArticle!.updatedAt,
    });
  } catch (error) {
    console.error('Error voting on article:', error);
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

articleRouter.delete('/:slug', async (req: Request, res: Response) => {
  try {
    const auth = await getAuthUser(req);
    if (!auth || !auth.isAuthor) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { slug } = req.params;
    const { db } = await connectToDatabase();

    const slugQuery = ObjectId.isValid(slug)
      ? { $or: [{ _id: new ObjectId(slug) }, { slug }] }
      : { slug };
    const article = await db.collection('articles').findOne(slugQuery);

    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    const isOwner = article.authorId?.toString() === auth.userId;
    if (!isOwner) {
      if (!article.authorId || !ObjectId.isValid(article.authorId)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      const targetAuthor = await db.collection('users').findOne(
        { _id: new ObjectId(article.authorId) },
        { projection: { role: 1 } }
      );
      const targetRole = targetAuthor?.role as UserRole | undefined;
      const canDeleteLowerRole = auth.role !== 'author'
        && targetRole !== undefined
        && targetRole in ROLE_LEVELS
        && ROLE_LEVELS[auth.role] > ROLE_LEVELS[targetRole];

      if (!canDeleteLowerRole) {
        res.status(403).json({ error: 'Forbidden: you can only delete your own article or an article owned by a lower role' });
        return;
      }
    }

    const result = await db.collection('articles').deleteOne({ _id: article._id });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});
