import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin } from '../../lib/roles.js';
import bcrypt from 'bcryptjs';

export const usersRouter = Router();

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const userId = req.cookies?.user_id;
  if (!userId || !ObjectId.isValid(userId)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { role: 1 } }
  );
  if (!user || !canAccessAdmin(user.role)) {
    res.status(403).json({ error: 'Forbidden: admin access required' });
    return false;
  }
  return true;
}

usersRouter.get('/', async (req: Request, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { db } = await connectToDatabase();

    const users = await db
      .collection('users')
      .find({}, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .toArray();

    const usersWithStringIds = users.map(user => ({
      ...user,
      _id: user._id.toString(),
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString(),
    }));

    res.json({ users: usersWithStringIds });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

usersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { id } = req.params;
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const user = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { passwordHash: 0 } }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      ...user,
      _id: user._id.toString(),
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

usersRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { id } = req.params;
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const body = req.body;
    const updateData: any = { updatedAt: new Date() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email.toLowerCase();
    if (body.role !== undefined) updateData.role = body.role;
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.avatar !== undefined) updateData.avatar = body.avatar;

    if (body.password && body.password.length >= 8) {
      updateData.passwordHash = await bcrypt.hash(body.password, 12);
    }

    const result = await db.collection('users').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updatedUser = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { passwordHash: 0 } }
    );

    res.json({
      ...updatedUser,
      _id: updatedUser!._id.toString(),
      createdAt: updatedUser!.createdAt?.toISOString(),
      updatedAt: updatedUser!.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

usersRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { id } = req.params;
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Prevent deleting the last superuser
    const targetUser = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { role: 1 } }
    );

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (targetUser.role === 'superuser') {
      const superuserCount = await db.collection('users').countDocuments({ role: 'superuser' });
      if (superuserCount <= 1) {
        res.status(400).json({ error: 'Cannot delete the last superuser' });
        return;
      }
    }

    const result = await db.collection('users').deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});
