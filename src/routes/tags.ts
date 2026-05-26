import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';

export const tagsRouter = Router();

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const userId = req.cookies?.user_id;
  if (!userId || !ObjectId.isValid(userId)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { role: 1 } }
  );
  if (!user || !canAccessAdmin(user.role)) {
    res.status(403).json({ error: 'Forbidden: admin access required' });
    return false;
  }
  return true;
}

tagsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { db } = await connectToDatabase();

    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const sortField = (req.query.sort as string) || 'name';
    const sortOrder = (req.query.order as string) === 'desc' ? -1 : 1;

    let query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await db.collection('tags').countDocuments(query);
    const tags = await db
      .collection('tags')
      .find(query)
      .sort({ [sortField]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const tagsWithStringIds = tags.map(tag => ({
      ...tag,
      _id: tag._id.toString(),
      createdAt: tag.createdAt?.toISOString(),
      updatedAt: tag.updatedAt?.toISOString()
    }));

    res.json({
      tags: tagsWithStringIds,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

tagsRouter.post('/', async (req: Request, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { db } = await connectToDatabase();
    const body = req.body;

    if (!body.name || !body.slug) {
      res.status(400).json({ error: 'Name and slug are required' });
      return;
    }

    const existingTag = await db.collection('tags').findOne({ slug: body.slug });
    if (existingTag) {
      res.status(409).json({ error: 'Tag with this slug already exists' });
      return;
    }

    const now = new Date();
    const tag = {
      name: body.name,
      slug: body.slug,
      description: body.description || '',
      relatedTags: body.relatedTags || [],
      articleCount: 0,
      createdAt: now,
      updatedAt: now
    };

    const result = await db.collection('tags').insertOne(tag);

    res.status(201).json({
      ...tag,
      _id: result.insertedId.toString(),
      createdAt: tag.createdAt.toISOString(),
      updatedAt: tag.updatedAt.toISOString()
    });
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Merge source tag into target tag
tagsRouter.post('/merge', async (req: Request, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { sourceId, targetId } = req.body;

    if (!sourceId || !targetId) {
      res.status(400).json({ error: 'sourceId and targetId are required' });
      return;
    }

    if (sourceId === targetId) {
      res.status(400).json({ error: 'Cannot merge a tag into itself' });
      return;
    }

    if (!ObjectId.isValid(sourceId) || !ObjectId.isValid(targetId)) {
      res.status(400).json({ error: 'Invalid tag ID format' });
      return;
    }

    const { db } = await connectToDatabase();

    const sourceTag = await db.collection('tags').findOne({ _id: new ObjectId(sourceId) });
    const targetTag = await db.collection('tags').findOne({ _id: new ObjectId(targetId) });

    if (!sourceTag || !targetTag) {
      res.status(404).json({ error: 'Source or target tag not found' });
      return;
    }

    // Update all articles using the source tag name -> replace with target tag name
    const updateResult = await db.collection('articles').updateMany(
      { tags: sourceTag.name },
      { $set: { 'tags.$[elem]': targetTag.name } },
      { arrayFilters: [{ elem: sourceTag.name }] }
    );

    // Update article count on target tag
    const targetArticleCount = await db.collection('articles').countDocuments({ tags: targetTag.name });
    await db.collection('tags').updateOne(
      { _id: new ObjectId(targetId) },
      { $set: { articleCount: targetArticleCount, updatedAt: new Date() } }
    );

    // Delete source tag
    await db.collection('tags').deleteOne({ _id: new ObjectId(sourceId) });

    res.json({
      success: true,
      sourceTag: sourceTag.name,
      targetTag: targetTag.name,
      articlesUpdated: updateResult.modifiedCount,
    });
  } catch (error) {
    console.error('Error merging tags:', error);
    res.status(500).json({ error: 'Failed to merge tags' });
  }
});

// Cleanup unused tags (articleCount === 0, older than 30 days)
tagsRouter.post('/cleanup', async (req: Request, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { db } = await connectToDatabase();

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const unusedTags = await db.collection('tags').find({
      articleCount: { $lte: 0 },
      createdAt: { $lt: thirtyDaysAgo }
    }).toArray();

    const deletedNames: string[] = [];
    for (const tag of unusedTags) {
      await db.collection('tags').deleteOne({ _id: tag._id });
      deletedNames.push(tag.name);
    }

    // Also recalculate articleCount for all remaining tags
    const allTags = await db.collection('tags').find({}).toArray();
    for (const tag of allTags) {
      const count = await db.collection('articles').countDocuments({ tags: tag.name });
      await db.collection('tags').updateOne(
        { _id: tag._id },
        { $set: { articleCount: count, updatedAt: new Date() } }
      );
    }

    res.json({
      success: true,
      deletedCount: unusedTags.length,
      deletedTags: deletedNames,
    });
  } catch (error) {
    console.error('Error cleaning up tags:', error);
    res.status(500).json({ error: 'Failed to clean up tags' });
  }
});

// Suggest new tags from article content analysis
tagsRouter.get('/suggestions', async (_req: Request, res: Response) => {
  try {
    const { db } = await connectToDatabase();

    const existingTagNames = (await db.collection('tags').find({}).project({ name: 1, _id: 0 }).toArray())
      .map(t => t.name.toLowerCase());

    // Extract words from all published article titles and content
    const articles = await db.collection('articles').find(
      { status: 'published' },
      { projection: { title: 1, tags: 1 } }
    ).toArray();

    const wordFrequency: Record<string, number> = {};

    for (const article of articles) {
      const existingArticleTags = (article.tags || []).map((t: string) => t.toLowerCase());
      const words = (article.title || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 3 && w.length < 25);

      for (const word of words) {
        // Skip if already a tag on this article or already exists
        if (existingArticleTags.includes(word) || existingTagNames.includes(word)) continue;
        // Skip common words
        if (['this', 'that', 'with', 'from', 'your', 'what', 'have', 'been', 'more', 'when', 'which', 'their', 'about', 'should', 'could', 'would'].includes(word)) continue;
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    }

    const suggestions = Object.entries(wordFrequency)
      .filter(([_, count]) => count >= 2)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({
        name: word.charAt(0).toUpperCase() + word.slice(1),
        slug: word,
        articleCount: count,
      }));

    res.json({ suggestions });
  } catch (error) {
    console.error('Error generating tag suggestions:', error);
    res.status(500).json({ error: 'Failed to generate suggestions' });
  }
});

// Recalculate article counts for all tags
tagsRouter.post('/recount', async (req: Request, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const { db } = await connectToDatabase();

    const allTags = await db.collection('tags').find({}).toArray();
    let updated = 0;

    for (const tag of allTags) {
      const count = await db.collection('articles').countDocuments({ tags: tag.name });
      await db.collection('tags').updateOne(
        { _id: tag._id },
        { $set: { articleCount: count, updatedAt: new Date() } }
      );
      updated++;
    }

    res.json({ success: true, tagsUpdated: updated });
  } catch (error) {
    console.error('Error recounting tags:', error);
    res.status(500).json({ error: 'Failed to recount tags' });
  }
});
