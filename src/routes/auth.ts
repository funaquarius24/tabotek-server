import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { signUrl, getOssEndpoint } from '../../lib/oss.js';
import { sendMail, buildVerifyEmailHtml } from '../../lib/mail.js';

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;

const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2MB

authRouter.post('/upload-avatar', async (req: Request, res: Response) => {
  try {
    const { filename, contentType, size } = req.body;

    if (!filename || !contentType) {
      res.status(400).json({ error: 'filename and contentType are required' });
      return;
    }

    if (!AVATAR_ALLOWED_TYPES.includes(contentType)) {
      res.status(400).json({ error: `Invalid file type. Allowed: ${AVATAR_ALLOWED_TYPES.join(', ')}` });
      return;
    }

    if (size && size > AVATAR_MAX_SIZE) {
      res.status(400).json({ error: 'File too large. Maximum 2MB' });
      return;
    }

    const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
    const imageId = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const objectName = `avatars/${imageId}${ext}`;

    const publicUrl = getOssEndpoint(objectName);
    const expires = Math.floor(Date.now() / 1000) + 300;
    const uploadUrl = signUrl('PUT', objectName, expires, contentType);

    res.json({
      uploadUrl,
      publicUrl,
    });
  } catch (error) {
    console.error('Failed to create avatar upload URL:', error);
    res.status(500).json({ error: 'Failed to create upload URL' });
  }
});

authRouter.post('/signin', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const { db } = await connectToDatabase();

    const user = await db.collection('users').findOne({
      $or: [
        { email: email.toLowerCase() },
        { name: email }
      ]
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email/username or password' });
      return;
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      res.status(401).json({ error: 'Invalid email/username or password' });
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
    const { email, password, name, avatarUrl } = req.body;

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

    const verifyToken = randomBytes(32).toString('hex');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user: Record<string, unknown> = {
      email: email.toLowerCase(),
      passwordHash,
      name: name || email.split('@')[0],
      role: 'user',
      avatar: avatarUrl || '',
      emailVerified: false,
      verifyToken,
      verifyExpires,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection('users').insertOne(user);

    sendMail(email, 'Verify your email', buildVerifyEmailHtml(verifyToken));

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

authRouter.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({ error: 'Verification token is required' });
      return;
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ verifyToken: token, verifyExpires: { $gt: new Date() } });

    if (!user) {
      res.status(400).json({ error: 'Invalid or expired verification token' });
      return;
    }

    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { emailVerified: true }, $unset: { verifyToken: '', verifyExpires: '' } }
    );

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});
