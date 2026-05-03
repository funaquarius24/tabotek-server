import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cookieParser from 'cookie-parser';
import { articlesRouter } from './routes/articles.js';
import { articleRouter } from './routes/article.js';
import { articlesSearchRouter } from './routes/articles-search.js';
import { categoriesRouter } from './routes/categories.js';
import { categoryRouter } from './routes/category.js';
import { authRouter } from './routes/auth.js';
import { sessionRouter } from './routes/session.js';
import { checkAvailabilityRouter } from './routes/check-availability.js';
import { requestAuthorRouter } from './routes/request-author.js';
import { adminStatsRouter } from './routes/admin-stats.js';
import { siteSettingsRouter } from './routes/site-settings.js';
import { filesRouter } from './routes/files.js';
import { filesUploadRouter } from './routes/files-upload.js';
import { ossUploadUrlRouter } from './routes/oss-upload-url.js';
import { ossConfirmRouter } from './routes/oss-confirm.js';
import { ossImageProxyRouter } from './routes/oss-image-proxy.js';
import { userSettingsRouter } from './routes/user-settings.js';

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map(s => s.trim());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || allowedOrigins.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use('/api/articles', articlesRouter);
app.use('/api/articles', articleRouter);
app.use('/api/articles', articlesSearchRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/auth', authRouter);
app.use('/api/auth', sessionRouter);
app.use('/api/auth', checkAvailabilityRouter);
app.use('/api/auth', requestAuthorRouter);
app.use('/api/admin', adminStatsRouter);
app.use('/api/admin', siteSettingsRouter);
app.use('/api/files', filesRouter);
app.use('/api/files', filesUploadRouter);
app.use('/api/oss', ossUploadUrlRouter);
app.use('/api/oss', ossConfirmRouter);
app.use('/api/oss', ossImageProxyRouter);
app.use('/api/user', userSettingsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
