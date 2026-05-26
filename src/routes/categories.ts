import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';

export const categoriesRouter = Router();

categoriesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { db } = await connectToDatabase();

    const featured = req.query.featured as string | undefined;
    const parent = req.query.parent as string | undefined;
    const search = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const sortField = (req.query.sort as string) || 'name';
    const sortOrder = (req.query.order as string) === 'desc' ? -1 : 1;

    let query: any = {};

    if (featured === 'true') {
      query.featured = true;
    }

    if (parent) {
      if (parent === 'null') {
        query.parentCategory = null;
      } else if (ObjectId.isValid(parent)) {
        query.parentCategory = new ObjectId(parent);
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await db.collection('categories').countDocuments(query);
    const categories = await db
      .collection('categories')
      .find(query)
      .sort({ [sortField]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const categoriesWithStringIds = categories.map(category => ({
      ...category,
      _id: category._id.toString(),
      parentCategory: category.parentCategory?.toString() || null,
      createdAt: category.createdAt?.toISOString(),
      updatedAt: category.updatedAt?.toISOString()
    }));

    res.json({
      categories: categoriesWithStringIds,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

categoriesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne(
      { _id: new ObjectId(userId) },
      { projection: { role: 1 } }
    );
    if (!user || !canAccessAdmin(user.role)) {
      res.status(403).json({ error: 'Forbidden: admin access required' });
      return;
    }

    const body = req.body;

    if (!body.name || !body.slug) {
      res.status(400).json({ error: 'Name and slug are required' });
      return;
    }

    const existingCategory = await db.collection('categories').findOne({ slug: body.slug });
    if (existingCategory) {
      res.status(409).json({ error: 'Category with this slug already exists' });
      return;
    }

    const now = new Date();
    const category = {
      ...body,
      parentCategory: body.parentCategory ? new ObjectId(body.parentCategory) : null,
      createdAt: now,
      updatedAt: now
    };

    const result = await db.collection('categories').insertOne(category);

    res.status(201).json({
      ...category,
      _id: result.insertedId.toString(),
      parentCategory: category.parentCategory?.toString() || null,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString()
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
});
