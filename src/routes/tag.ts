import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export const tagRouter = Router();

tagRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { db } = await connectToDatabase();

    let query: any;

    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { slug: id };
    }

    const tag = await db.collection('tags').findOne(query);

    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    const tagWithStringIds = {
      ...tag,
      _id: tag._id.toString(),
      createdAt: tag.createdAt?.toISOString(),
      updatedAt: tag.updatedAt?.toISOString()
    };

    res.json(tagWithStringIds);
  } catch (error) {
    console.error('Error fetching tag:', error);
    res.status(500).json({ error: 'Failed to fetch tag' });
  }
});

tagRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { db } = await connectToDatabase();
    const body = req.body;

    let query: any;
    let isObjectId = false;

    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
      isObjectId = true;
    } else {
      query = { slug: id };
    }

    const existingTag = await db.collection('tags').findOne(query);
    if (!existingTag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    if (body.slug && body.slug !== existingTag.slug) {
      const slugConflict = await db.collection('tags').findOne({ slug: body.slug });
      if (slugConflict) {
        res.status(409).json({ error: 'Tag with this slug already exists' });
        return;
      }
    }

    const updateData: any = {
      ...body,
      updatedAt: new Date()
    };

    const result = await db.collection('tags').updateOne(query, { $set: updateData });

    if (result.modifiedCount === 0) {
      res.status(400).json({ error: 'Tag not updated' });
      return;
    }

    const updatedQuery = isObjectId ? { _id: new ObjectId(id) } : { slug: body.slug || id };
    const updatedTag = await db.collection('tags').findOne(updatedQuery);

    const tagWithStringIds = {
      ...updatedTag,
      _id: updatedTag!._id.toString(),
      createdAt: updatedTag!.createdAt?.toISOString(),
      updatedAt: updatedTag!.updatedAt?.toISOString()
    };

    res.json(tagWithStringIds);
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

tagRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { db } = await connectToDatabase();

    let query: any;

    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { slug: id };
    }

    const result = await db.collection('tags').deleteOne(query);

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});
