import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import { ObjectId } from 'mongodb';
import { canAccessAdmin, ROLE_LEVELS, UserRole } from '../../lib/roles.js';
import bcrypt from 'bcryptjs';
import { log } from '../../lib/debug-log.js';

export const usersRouter = Router();

async function getAuthUser(req: Request): Promise<{ _id: ObjectId; role: UserRole; userId: string } | null> {
  const rawCookie = req.headers.cookie;
  const userId = req.cookies?.user_id;
  log(`[getAuthUser] raw cookie header: ${rawCookie?.substring(0, 60)}`);
  log(`[getAuthUser] parsed user_id: ${userId}, valid ObjectId: ${userId ? ObjectId.isValid(userId) : 'N/A'}`);
  if (!userId || !ObjectId.isValid(userId)) {
    log(`[getAuthUser] FAIL: userId missing or invalid (exists=${!!userId}, valid=${userId ? ObjectId.isValid(userId) : 'N/A'})`);
    return null;
  }
  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { role: 1, _id: 1 } }
  );
  log(`[getAuthUser] DB user lookup: found=${!!user}, role=${user?.role}`);
  if (!user) {
    log(`[getAuthUser] FAIL: user not found in DB for _id=${userId}`);
    return null;
  }
  const adminAccess = canAccessAdmin(user.role);
  log(`[getAuthUser] canAccessAdmin(${user.role}) => ${adminAccess}`);
  if (!adminAccess) {
    log(`[getAuthUser] FAIL: user role ${user.role} does not have admin access`);
    return null;
  }
  log(`[getAuthUser] SUCCESS: userId=${user._id.toString()}, role=${user.role}`);
  return { _id: user._id, role: user.role, userId: user._id.toString() };
}

usersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { db } = await connectToDatabase();

    const search = req.query.search as string | undefined;
    const role = req.query.role as string | undefined;
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const sortField = (req.query.sort as string) || 'createdAt';
    const sortOrder = (req.query.order as string) === 'asc' ? 1 : -1;

    let query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      query.role = role;
    }

    const total = await db.collection('users').countDocuments(query);
    const users = await db
      .collection('users')
      .find(query, { projection: { passwordHash: 0 } })
      .sort({ [sortField]: sortOrder })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const usersWithStringIds = users.map(user => ({
      ...user,
      _id: user._id.toString(),
      createdAt: user.createdAt?.toISOString(),
      updatedAt: user.updatedAt?.toISOString(),
    }));

    res.json({
      users: usersWithStringIds,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

async function getTargetUserRole(id: string): Promise<UserRole | null> {
  if (!ObjectId.isValid(id)) return null;
  const { db } = await connectToDatabase();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(id) },
    { projection: { role: 1 } }
  );
  return user?.role || null;
}

function canModify(authRole: UserRole, targetRole: UserRole): boolean {
  // Can modify self or any user with strictly lower role level
  return ROLE_LEVELS[authRole] > ROLE_LEVELS[targetRole];
}

usersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: 'Unauthorized' }); return; }

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
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { id } = req.params;
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const targetRole = await getTargetUserRole(id);
    if (!targetRole) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Self-edit is always allowed; otherwise must have strictly higher role
    if (id !== authUser.userId && !canModify(authUser.role, targetRole)) {
      res.status(403).json({ error: 'Forbidden: cannot modify users with equal or higher role' });
      return;
    }

    const body = req.body;
    const updateData: any = { updatedAt: new Date() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email.toLowerCase();
    if (body.role !== undefined) updateData.role = body.role;
    if (body.bio !== undefined) updateData.bio = body.bio;
    if (body.avatar !== undefined) updateData.avatar = body.avatar;

    // Prevent elevating role to match or exceed own role
    if (body.role && ROLE_LEVELS[body.role as UserRole] >= ROLE_LEVELS[authUser.role]) {
      res.status(403).json({ error: 'Forbidden: cannot assign a role equal to or higher than your own' });
      return;
    }

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
    const authUser = await getAuthUser(req);
    if (!authUser) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { id } = req.params;
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Cannot delete yourself
    if (id === authUser.userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const targetUser = await db.collection('users').findOne(
      { _id: new ObjectId(id) },
      { projection: { role: 1 } }
    );

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Must have strictly higher role to delete
    if (!canModify(authUser.role, targetUser.role)) {
      res.status(403).json({ error: 'Forbidden: cannot delete users with equal or higher role' });
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
