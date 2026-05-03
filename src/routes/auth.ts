import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import bcrypt from 'bcryptjs';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;

authRouter.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { db } = await connectToDatabase();

    const user = await db.collection('users').findOne({ email: email.toLowerCase() });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    res.cookie('user_id', user._id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 * 1000 // 7 days in ms
    });

    res.json({
      success: true,
      user: {
        _id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Sign in error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

authRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email address' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const { db } = await connectToDatabase();

    const existingUser = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await db.collection('users').insertOne({
      email: email.toLowerCase(),
      passwordHash,
      name: name || email.split('@')[0],
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    res.status(201).json({
      success: true,
      userId: result.insertedId.toString()
    });
  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ error: 'Account creation failed' });
  }
});

authRouter.post('/signout', async (_req: Request, res: Response) => {
  res.clearCookie('user_id', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.json({ success: true });
});
