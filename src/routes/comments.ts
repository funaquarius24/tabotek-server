import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';

export const commentsRouter = Router();

function serializeComment(c: any) {
  return {
    ...c,
    _id: c._id.toString(),
    articleId: c.articleId?.toString(),
    parentId: c.parentId?.toString() || null,
    createdAt: c.createdAt?.toISOString(),
    updatedAt: c.updatedAt?.toISOString(),
  };
}

commentsRouter.get('/:slug/comments', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { db } = await connectToDatabase();

    const comments = await db
      .collection('comments')
      .find({ articleSlug: slug, deleted: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ comments: comments.map(serializeComment) });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

commentsRouter.post('/:slug/comments', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { author, content, parentId } = req.body;

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

    let depth = 0;
    if (parentId) {
      if (!ObjectId.isValid(parentId)) {
        res.status(400).json({ error: 'Invalid parent comment ID' });
        return;
      }

      const parent = await db.collection('comments').findOne({ _id: new ObjectId(parentId), deleted: { $ne: true } });
      if (!parent) {
        res.status(404).json({ error: 'Parent comment not found' });
        return;
      }

      depth = (parent.depth || 0) + 1;
      if (depth > 3) {
        res.status(400).json({ error: 'Maximum reply depth reached (4 levels)' });
        return;
      }
    }

    const now = new Date();
    const comment = {
      articleSlug: slug,
      articleId: article._id,
      parentId: parentId ? new ObjectId(parentId) : null,
      depth,
      author: {
        name: author.name.trim(),
        email: author.email || '',
        avatar: author.avatar || '',
      },
      content: content.trim(),
      likes: 0,
      dislikes: 0,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };

    const result = await db.collection('comments').insertOne(comment);

    res.status(201).json(serializeComment({ ...comment, _id: result.insertedId }));
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

commentsRouter.post('/:slug/comments/:commentId/like', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { vote } = req.body;

    if (!ObjectId.isValid(commentId)) {
      res.status(400).json({ error: 'Invalid comment ID' });
      return;
    }

    if (!['like', 'dislike', null].includes(vote)) {
      res.status(400).json({ error: 'vote must be "like", "dislike", or null' });
      return;
    }

    const { db } = await connectToDatabase();
    const comment = await db.collection('comments').findOne({ _id: new ObjectId(commentId), deleted: { $ne: true } });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    const inc: Record<string, number> = {};
    if (vote === 'like') inc.likes = 1;
    else if (vote === 'dislike') inc.dislikes = 1;

    await db.collection('comments').updateOne(
      { _id: new ObjectId(commentId) },
      { $inc: inc, $set: { updatedAt: new Date() } }
    );

    const updated = await db.collection('comments').findOne({ _id: new ObjectId(commentId) });
    res.json(serializeComment(updated));
  } catch (error) {
    console.error('Error voting on comment:', error);
    res.status(500).json({ error: 'Failed to record vote' });
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
