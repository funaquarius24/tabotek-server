import { Router } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
export const sessionRouter = Router();
sessionRouter.get('/session', async (req, res) => {
    try {
        const userId = req.cookies?.user_id;
        if (!userId) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        res.json({
            user: {
                _id: user._id.toString(),
                email: user.email,
                name: user.name,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error('Session error:', error);
        res.status(500).json({ error: 'Session error' });
    }
});
