import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';

export const tagsRouter = Router();

tagsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const { db } = await connectToDatabase();

    const tags = await db
      .collection('tags')
      .find({})
      .sort({ name: 1 })
      .toArray();

    const tagsWithStringIds = tags.map(tag => ({
      ...tag,
      _id: tag._id.toString(),
      createdAt: tag.createdAt?.toISOString(),
      updatedAt: tag.updatedAt?.toISOString()
    }));

    res.json({ tags: tagsWithStringIds });
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

tagsRouter.post('/', async (req: Request, res: Response) => {
  try {
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
