import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';

export const adminAuthorRequestsRouter = Router();

adminAuthorRequestsRouter.get('/author-requests', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });

    if (!user || !canAccessAdmin(user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const search = req.query.search as string | undefined;
    const statusFilter = req.query.status as string | undefined;
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');

    let query: any = {};

    if (statusFilter) {
      query.status = statusFilter;
    }

    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await db.collection('authorRequests').countDocuments(query);
    const requests = await db.collection('authorRequests')
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    res.json({
      requests,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching author requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

adminAuthorRequestsRouter.put('/author-requests/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.cookies?.user_id;
    if (!userId || !ObjectId.isValid(userId)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { db } = await connectToDatabase();
    const adminUser = await db.collection('users').findOne({ _id: new ObjectId(userId) }, { projection: { role: 1 } });

    if (!adminUser || !canAccessAdmin(adminUser.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { id } = req.params;
    const { action } = req.body;

    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid request ID' });
      return;
    }

    if (action !== 'approve' && action !== 'reject') {
      res.status(400).json({ error: 'Action must be "approve" or "reject"' });
      return;
    }

    const requestDoc = await db.collection('authorRequests').findOne({ _id: new ObjectId(id) });
    if (!requestDoc) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (action === 'approve') {
      const now = new Date();

      await db.collection('users').updateOne(
        { _id: requestDoc.userId },
        { $set: { role: 'author', updatedAt: now, authorApprovedAt: now } }
      );

      await db.collection('authorRequests').updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'approved', approvedAt: now, approvedBy: new ObjectId(userId), updatedAt: now } }
      );

      res.json({ success: true, status: 'approved' });
    } else {
      await db.collection('authorRequests').updateOne(
        { _id: new ObjectId(id) },
        { $set: { status: 'rejected', updatedAt: new Date() } }
      );

      res.json({ success: true, status: 'rejected' });
    }
  } catch (error) {
    console.error('Error updating author request:', error);
    res.status(500).json({ error: 'Failed to update request' });
  }
});
