import { Router } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
export const categoriesRouter = Router();
categoriesRouter.get('/', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
        const featured = req.query.featured;
        const parent = req.query.parent;
        let query = {};
        if (featured === 'true') {
            query.featured = true;
        }
        if (parent) {
            if (parent === 'null') {
                query.parentCategory = null;
            }
            else if (ObjectId.isValid(parent)) {
                query.parentCategory = new ObjectId(parent);
            }
        }
        const categories = await db
            .collection('categories')
            .find(query)
            .sort({ name: 1 })
            .toArray();
        const categoriesWithStringIds = categories.map(category => ({
            ...category,
            _id: category._id.toString(),
            parentCategory: category.parentCategory?.toString() || null,
            createdAt: category.createdAt?.toISOString(),
            updatedAt: category.updatedAt?.toISOString()
        }));
        res.json({ categories: categoriesWithStringIds });
    }
    catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});
categoriesRouter.post('/', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
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
    }
    catch (error) {
        console.error('Error creating category:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
});
