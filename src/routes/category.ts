import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';

export const categoryRouter = Router();

categoryRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { db } = await connectToDatabase();

    let query: any;

    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { slug: id };
    }

    const category = await db.collection('categories').findOne(query);

    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const categoryWithStringIds = {
      ...category,
      _id: category._id.toString(),
      parentCategory: category.parentCategory?.toString() || null,
      createdAt: category.createdAt?.toISOString(),
      updatedAt: category.updatedAt?.toISOString()
    };

    res.json(categoryWithStringIds);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

categoryRouter.put('/:id', async (req: Request, res: Response) => {
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

    const existingCategory = await db.collection('categories').findOne(query);
    if (!existingCategory) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    if (body.slug && body.slug !== existingCategory.slug) {
      const slugConflict = await db.collection('categories').findOne({ slug: body.slug });
      if (slugConflict) {
        res.status(409).json({ error: 'Category with this slug already exists' });
        return;
      }
      // Set up 301 redirect for SEO
      await db.collection('redirects').insertOne({
        from: `/categories/${existingCategory.slug}`,
        to: `/categories/${body.slug}`,
        statusCode: 301,
        createdAt: new Date(),
      });
      // Also update article category references if using slug-based references
      await db.collection('articles').updateMany(
        { categorySlug: existingCategory.slug },
        { $set: { categorySlug: body.slug } }
      );
    }

    const updateData: any = { ...body };

    if (body.parentCategory !== undefined) {
      updateData.parentCategory = body.parentCategory ? new ObjectId(body.parentCategory) : null;
    }

    updateData.updatedAt = new Date();

    const result = await db.collection('categories').updateOne(
      query,
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      res.status(400).json({ error: 'Category not updated' });
      return;
    }

    const updatedQuery = isObjectId ? { _id: new ObjectId(id) } : { slug: body.slug || id };
    const updatedCategory = await db.collection('categories').findOne(updatedQuery);

    const categoryWithStringIds = {
      ...updatedCategory,
      _id: updatedCategory!._id.toString(),
      parentCategory: updatedCategory!.parentCategory?.toString() || null,
      createdAt: updatedCategory!.createdAt?.toISOString(),
      updatedAt: updatedCategory!.updatedAt?.toISOString()
    };

    res.json(categoryWithStringIds);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

categoryRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { db } = await connectToDatabase();

    let query: any;

    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { slug: id };
    }

    const childCategories = await db.collection('categories').countDocuments({ parentCategory: query._id || new ObjectId(id) });
    if (childCategories > 0) {
      res.status(400).json({ error: 'Cannot delete category with child categories' });
      return;
    }

    const articlesCount = await db.collection('articles').countDocuments({ categoryId: query._id || new ObjectId(id) });
    if (articlesCount > 0) {
      res.status(400).json({ error: 'Cannot delete category with associated articles' });
      return;
    }

    const result = await db.collection('categories').deleteOne(query);

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});
