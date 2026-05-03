import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export const articleRouter = Router();

async function getAuthUser(req: Request) {
  const userId = req.cookies?.user_id;
  if (!userId || !ObjectId.isValid(userId)) return null;
  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1, _id: 1 } });
  if (!user) return null;
  const allowedRoles = ['author', 'editor', 'admin', 'superuser'];
  return { userId: user._id.toString(), isAuthor: allowedRoles.includes(user.role) };
}

articleRouter.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { db } = await connectToDatabase();

    const article = await db.collection('articles').findOne({ slug });

    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    await db.collection('articles').updateOne(
      { _id: article._id },
      { $inc: { views: 1 } }
    );

    const articleWithStringIds = {
      ...article,
      _id: article._id.toString(),
      categoryId: article.categoryId?.toString(),
      authorId: article.authorId?.toString(),
      publishedAt: article.publishedAt.toISOString(),
      createdAt: article.createdAt?.toISOString(),
      updatedAt: article.updatedAt?.toISOString()
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

    const existingArticle = await db.collection('articles').findOne({ slug });
    if (!existingArticle) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    if (body.slug && body.slug !== slug) {
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
      updateData.authorId = new ObjectId(body.authorId);
    }

    if (body.publishedAt) {
      updateData.publishedAt = new Date(body.publishedAt);
    }

    updateData.updatedAt = new Date();

    const result = await db.collection('articles').updateOne(
      { slug },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      res.status(400).json({ error: 'Article not updated' });
      return;
    }

    const updatedArticle = await db.collection('articles').findOne({ slug: body.slug || slug });

    const articleWithStringIds = {
      ...updatedArticle,
      _id: updatedArticle!._id.toString(),
      categoryId: updatedArticle!.categoryId?.toString(),
      authorId: updatedArticle!.authorId?.toString(),
      publishedAt: updatedArticle!.publishedAt.toISOString(),
      createdAt: updatedArticle!.createdAt?.toISOString(),
      updatedAt: updatedArticle!.updatedAt?.toISOString()
    };

    res.json(articleWithStringIds);
  } catch (error) {
    console.error('Error updating article:', error);
    res.status(500).json({ error: 'Failed to update article' });
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

    const result = await db.collection('articles').deleteOne({ slug });

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
