import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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
import { tagsRouter } from './routes/tags.js';
import { tagRouter } from './routes/tag.js';
import { userSettingsRouter } from './routes/user-settings.js';
import { usersRouter } from './routes/users.js';
import { redirectsRouter } from './routes/redirects.js';
import { commentsRouter } from './routes/comments.js';
import { log, getLog } from '../lib/debug-log.js';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.CLIENT_URL || 'http://localhost:3000,https://www.techteg.com').split(',').map(s => s.trim().toLowerCase());
app.use(cors({
  origin(origin, callback) {
    const allowed = !origin || allowedOrigins.includes(origin.toLowerCase()) || allowedOrigins.includes('*');
    log(`[CORS] origin=${origin} allowed=${allowed} | allowedOrigins=${allowedOrigins.join(',')}`);
    if (allowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use((req, _res, next) => {
  log(`[REQUEST] ${req.method} ${req.path} | origin=${req.headers.origin} | cookieHeader=${(req.headers.cookie || '').substring(0, 80)} | parsedCookies=${JSON.stringify(req.cookies)}`);
  next();
});

app.use((_req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    if (res.statusCode >= 400) {
      body = { ...body, _debug: getLog() };
    }
    return originalJson(body);
  } as any;
  next();
});

app.use('/api/redirect', redirectsRouter);

app.use('/api/articles', commentsRouter);

app.use('/api/articles', articlesRouter);
app.use('/api/articles', articlesSearchRouter);
app.use('/api/articles', articleRouter);
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
app.use('/api/tags', tagsRouter);
app.use('/api/tags', tagRouter);
app.use('/api/users', usersRouter);
app.use('/api/user', userSettingsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export { app };
