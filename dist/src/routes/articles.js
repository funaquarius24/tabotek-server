import { Router } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
export const articlesRouter = Router();
articlesRouter.get('/', async (req, res) => {
    try {
        const { db } = await connectToDatabase();
        const limit = parseInt(req.query.limit || '10');
        const page = parseInt(req.query.page || '1');
        const category = req.query.category;
        const status = req.query.status || 'published';
        const search = req.query.search;
        let query = {};
        if (status) {
            query.status = status;
        }
        if (category) {
            if (ObjectId.isValid(category)) {
                query.categoryId = new ObjectId(category);
            }
            else {
                const categoryDoc = await db.collection('categories').findOne({ slug: category });
                if (categoryDoc) {
                    query.categoryId = categoryDoc._id;
                }
            }
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { excerpt: { $regex: search, $options: 'i' } },
                { content: { $regex: search, $options: 'i' } },
                { tags: { $regex: search, $options: 'i' } }
            ];
        }
        const total = await db.collection('articles').countDocuments(query);
        let articles = await db
            .collection('articles')
            .find(query)
            .sort({ publishedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        if (category && articles.length < 5 && limit >= 5) {
            const needed = 5 - articles.length;
            const existingIds = articles.map(a => a._id);
            const randomArticles = await db
                .collection('articles')
                .find({
                status: status,
                _id: { $nin: existingIds }
            })
                .limit(needed)
                .toArray();
            const shuffledRandom = randomArticles.sort(() => Math.random() - 0.5);
            articles = [...articles, ...shuffledRandom].slice(0, limit);
        }
        const articlesWithStringIds = articles.map(article => ({
            ...article,
            _id: article._id.toString(),
            categoryId: article.categoryId?.toString(),
            authorId: article.authorId?.toString(),
            publishedAt: article.publishedAt.toISOString(),
            createdAt: article.createdAt?.toISOString(),
            updatedAt: article.updatedAt?.toISOString()
        }));
        res.json({
            articles: articlesWithStringIds,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('Error fetching articles:', error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});
articlesRouter.post('/', async (req, res) => {
    try {
        const userId = req.cookies?.user_id;
        if (!userId || !ObjectId.isValid(userId)) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });
        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        const body = req.body;
        if (!body.slug || !body.title || !body.content || !body.categoryId) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const existingArticle = await db.collection('articles').findOne({ slug: body.slug });
        if (existingArticle) {
            res.status(409).json({ error: 'Article with this slug already exists' });
            return;
        }
        const allowedRoles = ['author', 'editor', 'admin', 'superuser'];
        if (body.status === 'published' && !allowedRoles.includes(user.role)) {
            res.status(403).json({ error: 'Forbidden: author privileges required to publish' });
            return;
        }
        const now = new Date();
        const article = {
            ...body,
            categoryId: new ObjectId(body.categoryId),
            authorId: new ObjectId(userId),
            publishedAt: body.publishedAt ? new Date(body.publishedAt) : now,
            views: 0,
            likes: 0,
            dislikes: 0,
            createdAt: now,
            updatedAt: now
        };
        const result = await db.collection('articles').insertOne(article);
        res.status(201).json({
            ...article,
            _id: result.insertedId.toString(),
            categoryId: article.categoryId.toString(),
            authorId: article.authorId.toString(),
            publishedAt: article.publishedAt.toISOString(),
            createdAt: article.createdAt.toISOString(),
            updatedAt: article.updatedAt.toISOString()
        });
    }
    catch (error) {
        console.error('Error creating article:', error);
        res.status(500).json({ error: 'Failed to create article' });
    }
});
