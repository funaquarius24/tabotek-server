import { Router } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
export const requestAuthorRouter = Router();
requestAuthorRouter.get('/request-author', async (req, res) => {
    try {
        const userId = req.cookies?.user_id;
        if (!userId || !ObjectId.isValid(userId)) {
            res.json({ requested: false });
            return;
        }
        const { db } = await connectToDatabase();
        const existing = await db.collection('authorRequests').findOne({
            userId: new ObjectId(userId),
        });
        res.json({
            requested: !!existing,
            status: existing?.status || null,
        });
    }
    catch {
        res.json({ requested: false });
    }
});
requestAuthorRouter.post('/request-author', async (req, res) => {
    try {
        const userId = req.cookies?.user_id;
        if (!userId || !ObjectId.isValid(userId)) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        if (user.role !== 'user') {
            res.status(400).json({ error: 'You are already an author or staff member' });
            return;
        }
        const existing = await db.collection('authorRequests').findOne({
            userId: new ObjectId(userId),
        });
        if (existing) {
            res.status(409).json({ error: 'You have already submitted a request', status: existing.status });
            return;
        }
        await db.collection('authorRequests').insertOne({
            userId: new ObjectId(userId),
            userEmail: user.email,
            userName: user.name,
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        res.status(201).json({ success: true, status: 'pending' });
    }
    catch (error) {
        console.error('Error requesting author role:', error);
        res.status(500).json({ error: 'Failed to submit request' });
    }
});
