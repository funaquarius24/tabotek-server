import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';

export const checkAvailabilityRouter = Router();

checkAvailabilityRouter.post('/check-availability', async (req: Request, res: Response) => {
  try {
    const { email, username } = req.body;

    if (!email || !username) {
      res.status(400).json({ error: 'Email and username are required' });
      return;
    }

    const { db } = await connectToDatabase();

    const errors: { email?: string; username?: string } = {};

    const existingEmail = await db.collection('users').findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      errors.email = 'This email address is already registered';
    }

    const existingUsername = await db.collection('users').findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      errors.username = 'This username is already taken';
    }

    if (Object.keys(errors).length > 0) {
      res.status(409).json({ errors });
      return;
    }

    res.json({ available: true });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
