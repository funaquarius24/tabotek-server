import { Router } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';
export const categoryRouter = Router();
async function requireAdmin(req, res) {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });
    if (!user || !canAccessAdmin(user.role)) {
        res.status(403).json({ error: 'Forbidden: admin access required' });
        return false;
    }
    return true;
}
async function resolveCategoryQuery(id) {
    if (ObjectId.isValid(id)) {
        const oid = new ObjectId(id);
        return { query: { _id: oid }, isObjectId: true, categoryId: oid };
    }
    const { db } = await connectToDatabase();
    const cat = await db.collection('categories').findOne({ slug: id }, { projection: { _id: 1 } });
    if (!cat)
        return { query: { slug: id }, isObjectId: false };
    return { query: { slug: id }, isObjectId: false, categoryId: cat._id };
}
categoryRouter.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { db } = await connectToDatabase();
        const { query } = await resolveCategoryQuery(id);
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
    }
    catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});
categoryRouter.put('/:id', async (req, res) => {
    try {
        if (!(await requireAdmin(req, res)))
            return;
        const { id } = req.params;
        const { db } = await connectToDatabase();
        const body = req.body;
        const { query, isObjectId, categoryId } = await resolveCategoryQuery(id);
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
            await db.collection('redirects').insertOne({
                from: `/category/${existingCategory.slug}`,
                to: `/category/${body.slug}`,
                statusCode: 301,
                createdAt: new Date(),
            });
        }
        const updateData = { ...body };
        if (body.parentCategory !== undefined) {
            updateData.parentCategory = body.parentCategory ? new ObjectId(body.parentCategory) : null;
        }
        updateData.updatedAt = new Date();
        await db.collection('categories').updateOne(query, { $set: updateData });
        const updatedQuery = isObjectId ? { _id: new ObjectId(id) } : { slug: body.slug || id };
        const updatedCategory = await db.collection('categories').findOne(updatedQuery);
        const categoryWithStringIds = {
            ...updatedCategory,
            _id: updatedCategory._id.toString(),
            parentCategory: updatedCategory.parentCategory?.toString() || null,
            createdAt: updatedCategory.createdAt?.toISOString(),
            updatedAt: updatedCategory.updatedAt?.toISOString()
        };
        res.json(categoryWithStringIds);
    }
    catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ error: 'Failed to update category' });
    }
});
categoryRouter.delete('/:id', async (req, res) => {
    try {
        if (!(await requireAdmin(req, res)))
            return;
        const { id } = req.params;
        const { db } = await connectToDatabase();
        const { query, categoryId } = await resolveCategoryQuery(id);
        if (!categoryId && !ObjectId.isValid(id)) {
            res.status(404).json({ error: 'Category not found' });
            return;
        }
        const resolvedId = categoryId || new ObjectId(id);
        const childCategories = await db.collection('categories').countDocuments({ parentCategory: resolvedId });
        if (childCategories > 0) {
            res.status(400).json({ error: 'Cannot delete category with child categories' });
            return;
        }
        const articlesCount = await db.collection('articles').countDocuments({ categoryId: resolvedId });
        if (articlesCount > 0) {
            res.status(400).json({ error: 'Cannot delete category with associated articles' });
            return;
        }
        const result = await db.collection('categories').deleteOne({ _id: resolvedId });
        if (result.deletedCount === 0) {
            res.status(404).json({ error: 'Category not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
});
