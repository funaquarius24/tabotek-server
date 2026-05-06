import { Router, Request, Response } from 'express';
import { connectToDatabase } from '../../lib/mongodb.js';

export const redirectsRouter = Router();

redirectsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const from = req.query.from as string;
    if (!from) {
      res.status(400).json({ error: 'Query parameter "from" is required' });
      return;
    }
    const { db } = await connectToDatabase();
    const redirect = await db.collection('redirects').findOne({ from });
    if (!redirect) {
      res.status(404).json({ error: 'No redirect found' });
      return;
    }
    res.json({
      from: redirect.from,
      to: redirect.to,
      statusCode: redirect.statusCode || 301,
    });
  } catch (error) {
    console.error('Error looking up redirect:', error);
    res.status(500).json({ error: 'Failed to look up redirect' });
  }
});
