import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';

export const commentsRouter = Router();

commentsRouter.get('/:slug/comments', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { db } = await connectToDatabase();

    const comments = await db
      .collection('comments')
      .find({ articleSlug: slug, deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();

    const commentsWithStringIds = comments.map(c => ({
      ...c,
      _id: c._id.toString(),
      articleId: c.articleId?.toString(),
      createdAt: c.createdAt?.toISOString(),
      updatedAt: c.updatedAt?.toISOString(),
    }));

    res.json({ comments: commentsWithStringIds });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

commentsRouter.post('/:slug/comments', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { author, content } = req.body;

    if (!author || !author.name || !content) {
      res.status(400).json({ error: 'Author name and content are required' });
      return;
    }

    if (!content.trim()) {
      res.status(400).json({ error: 'Comment content cannot be empty' });
      return;
    }

    const { db } = await connectToDatabase();

    const article = await db.collection('articles').findOne({ slug });
    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    if (article.allowComments === false) {
      res.status(403).json({ error: 'Comments are disabled for this article' });
      return;
    }

    const now = new Date();
    const comment = {
      articleSlug: slug,
      articleId: article._id,
      author: {
        name: author.name.trim(),
        email: author.email || '',
        avatar: author.avatar || '',
      },
      content: content.trim(),
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };

    const result = await db.collection('comments').insertOne(comment);

    res.status(201).json({
      ...comment,
      _id: result.insertedId.toString(),
      articleId: comment.articleId.toString(),
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

commentsRouter.delete('/:slug/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });
    if (!user || !canAccessAdmin(user.role)) {
      res.status(403).json({ error: 'Forbidden: admin access required' });
      return;
    }

    const { commentId } = req.params;

    if (!ObjectId.isValid(commentId)) {
      res.status(400).json({ error: 'Invalid comment ID' });
      return;
    }

    const result = await db.collection('comments').deleteOne({ _id: new ObjectId(commentId) });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});
