import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';
import showdown from 'showdown';
import { sendMail, buildCommentReplyHtml, buildNewCommentHtml } from '../../lib/mail.js';

const mdConverter = new showdown.Converter({ simpleLineBreaks: true, openLinksInNewWindow: true });

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 30000;

function checkRateLimit(key: string): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  const now = Date.now();
  const last = rateLimitMap.get(key);
  if (last && now - last < RATE_LIMIT_MS) return false;
  rateLimitMap.set(key, now);
  return true;
}

export function resetRateLimits() {
  rateLimitMap.clear();
}

export const commentsRouter = Router();

function serializeComment(c: any) {
  return {
    ...c,
    _id: c._id.toString(),
    articleId: c.articleId?.toString(),
    parentId: c.parentId?.toString() || null,
    authorUserId: c.author?.userId?.toString() || null,
    createdAt: c.createdAt?.toISOString(),
    updatedAt: c.updatedAt?.toISOString(),
    contentHtml: mdConverter.makeHtml(c.content || ''),
  };
}

function getUserId(req: Request): string | null {
  const uid = req.cookies?.user_id;
  return uid && ObjectId.isValid(uid) ? uid : null;
}

async function getUser(req: Request, db: any) {
  const uid = getUserId(req);
  if (!uid) return null;
  const user = await db.collection('users').findOne({ _id: new ObjectId(uid) }, { projection: { role: 1, _id: 1 } });
  return user ? { _id: user._id.toString(), role: user.role } : null;
}

async function getArticleAuthor(db: any, articleSlug: string) {
  const article = await db.collection('articles').findOne({ slug: articleSlug }, { projection: { authorId: 1, allowCommenterEdit: 1, allowCommenterDelete: 1 } });
  return article;
}

async function isArticleAuthorOrAdmin(db: any, articleSlug: string, userId: string, userRole: string): Promise<boolean> {
  if (canAccessAdmin(userRole)) return true;
  const article = await db.collection('articles').findOne({ slug: articleSlug }, { projection: { authorId: 1 } });
  return article?.authorId?.toString() === userId;
}

commentsRouter.get('/:slug/comments', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const sort = req.query.sort === 'newest' ? -1 : 1;

    const { db } = await connectToDatabase();

    const query: any = { articleSlug: slug, deleted: { $ne: true }, hidden: { $ne: true } };

    const [total, comments] = await Promise.all([
      db.collection('comments').countDocuments(query),
      db.collection('comments')
        .find(query)
        .sort({ createdAt: sort })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
    ]);

    res.json({
      comments: comments.map(serializeComment),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

commentsRouter.post('/:slug/comments', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { content, parentId } = req.body;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';

    if (!checkRateLimit(ip)) {
      res.status(429).json({ error: 'Please wait before posting another comment' });
      return;
    }

    const uid = getUserId(req);
    if (!uid) {
      res.status(401).json({ error: 'You must be signed in to comment' });
      return;
    }

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Comment content cannot be empty' });
      return;
    }

    const { db } = await connectToDatabase();

    const [user, article] = await Promise.all([
      db.collection('users').findOne({ _id: new ObjectId(uid) }, { projection: { name: 1, email: 1, avatar: 1 } }),
      db.collection('articles').findOne({ slug }),
    ]);

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    if (!article) {
      res.status(404).json({ error: 'Article not found' });
      return;
    }

    if (article.allowComments === false) {
      res.status(403).json({ error: 'Comments are disabled for this article' });
      return;
    }

    let depth = 0;
    let parentEmail: string | null = null;
    let parentName: string | null = null;
    let parentSlug: string | null = null;

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

      parentEmail = parent.author?.email || null;
      parentName = parent.author?.name || null;
      parentSlug = parent.articleSlug || null;
    }

    const now = new Date();
    const comment = {
      articleSlug: slug,
      articleId: article._id,
      parentId: parentId ? new ObjectId(parentId) : null,
      depth,
      author: {
        userId: new ObjectId(uid),
        name: user.name,
        email: user.email || '',
        avatar: user.avatar || '',
      },
      content: content.trim(),
      likes: 0,
      dislikes: 0,
      hidden: false,
      flagged: false,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };

    const result = await db.collection('comments').insertOne(comment);

    // Email: notify parent comment author
    if (parentEmail && parentSlug) {
      sendMail(parentEmail, 'New reply to your comment', buildCommentReplyHtml(user.name, parentSlug, content.trim().slice(0, 200)));
    }

    // Email: notify article author
    const articleAuthor = await db.collection('users').findOne({ _id: article.authorId }, { projection: { email: 1 } });
    if (articleAuthor?.email && (!parentEmail || articleAuthor.email !== parentEmail)) {
      sendMail(articleAuthor.email, `New comment on "${article.title || slug}"`, buildNewCommentHtml(user.name, slug, article.title || slug));
    }

    res.status(201).json(serializeComment({ ...comment, _id: result.insertedId }));
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
});

commentsRouter.put('/:slug/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { slug, commentId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    if (!ObjectId.isValid(commentId)) {
      res.status(400).json({ error: 'Invalid comment ID' });
      return;
    }

    const { db } = await connectToDatabase();
    const auth = await getUser(req, db);
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const comment = await db.collection('comments').findOne({ _id: new ObjectId(commentId), deleted: { $ne: true } });
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    const article = await getArticleAuthor(db, slug);
    const isAdmin = canAccessAdmin(auth.role);
    const isOwn = comment.author?.userId?.toString() === auth._id;
    const canEdit = article?.allowCommenterEdit !== false;

    if (!isAdmin && !(isOwn && canEdit)) {
      res.status(403).json({ error: 'Forbidden: cannot edit this comment' });
      return;
    }

    await db.collection('comments').updateOne(
      { _id: new ObjectId(commentId) },
      { $set: { content: content.trim(), updatedAt: new Date() } }
    );

    const updated = await db.collection('comments').findOne({ _id: new ObjectId(commentId) });
    res.json(serializeComment(updated));
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

commentsRouter.patch('/:slug/comments/:commentId/hide', async (req: Request, res: Response) => {
  try {
    const { slug, commentId } = req.params;

    if (!ObjectId.isValid(commentId)) {
      res.status(400).json({ error: 'Invalid comment ID' });
      return;
    }

    const { db } = await connectToDatabase();
    const auth = await getUser(req, db);
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!(await isArticleAuthorOrAdmin(db, slug, auth._id, auth.role))) {
      res.status(403).json({ error: 'Forbidden: only article author or admin can hide comments' });
      return;
    }

    const comment = await db.collection('comments').findOne({ _id: new ObjectId(commentId), deleted: { $ne: true } });
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    const newHidden = !comment.hidden;
    await db.collection('comments').updateOne(
      { _id: new ObjectId(commentId) },
      { $set: { hidden: newHidden, updatedAt: new Date() } }
    );

    res.json({ success: true, hidden: newHidden });
  } catch (error) {
    console.error('Error hiding comment:', error);
    res.status(500).json({ error: 'Failed to hide comment' });
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

commentsRouter.post('/:slug/comments/:commentId/flag', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;

    if (!ObjectId.isValid(commentId)) {
      res.status(400).json({ error: 'Invalid comment ID' });
      return;
    }

    const { db } = await connectToDatabase();
    const comment = await db.collection('comments').findOne({ _id: new ObjectId(commentId), deleted: { $ne: true } });

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    await db.collection('comments').updateOne(
      { _id: new ObjectId(commentId) },
      { $set: { flagged: true, updatedAt: new Date() } }
    );

    res.json({ success: true, flagged: true });
  } catch (error) {
    console.error('Error flagging comment:', error);
    res.status(500).json({ error: 'Failed to flag comment' });
  }
});

commentsRouter.post('/:slug/comments/:commentId/unflag', async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;

    if (!ObjectId.isValid(commentId)) {
      res.status(400).json({ error: 'Invalid comment ID' });
      return;
    }

    const { db } = await connectToDatabase();
    const auth = await getUser(req, db);
    if (!auth || !canAccessAdmin(auth.role)) {
      res.status(403).json({ error: 'Forbidden: admin access required' });
      return;
    }

    const comment = await db.collection('comments').findOne({ _id: new ObjectId(commentId), deleted: { $ne: true } });
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    await db.collection('comments').updateOne(
      { _id: new ObjectId(commentId) },
      { $set: { flagged: false, updatedAt: new Date() } }
    );

    res.json({ success: true, flagged: false });
  } catch (error) {
    console.error('Error unflagging comment:', error);
    res.status(500).json({ error: 'Failed to unflag comment' });
  }
});

commentsRouter.delete('/:slug/comments/:commentId', async (req: Request, res: Response) => {
  try {
    const { slug, commentId } = req.params;

    if (!ObjectId.isValid(commentId)) {
      res.status(400).json({ error: 'Invalid comment ID' });
      return;
    }

    const { db } = await connectToDatabase();
    const auth = await getUser(req, db);
    if (!auth) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const comment = await db.collection('comments').findOne({ _id: new ObjectId(commentId), deleted: { $ne: true } });
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    const article = await getArticleAuthor(db, slug);
    const isAdmin = canAccessAdmin(auth.role);
    const isOwn = comment.author?.userId?.toString() === auth._id;
    const canDelete = article?.allowCommenterDelete !== false;

    if (!isAdmin && !(isOwn && canDelete)) {
      res.status(403).json({ error: 'Forbidden: cannot delete this comment' });
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
