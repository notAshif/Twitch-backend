import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middleware/errorHandler.ts';
import authRoutes from './routes/auth.ts';
import usersRoutes from './routes/users.ts';
import followingRoutes from './routes/following.ts';
import categoriesRoutes from './routes/categories.ts';
import historyRoutes from './routes/history.ts';
import adminRoutes from './routes/admin.ts';
import issuesRoutes from './routes/issues.ts';
import adblockRoutes from './routes/adblock.ts';

export function createApp(): Express {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.APP_URL || 'http://localhost:5173');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/following', followingRoutes);
  app.use('/api/categories', categoriesRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/issues', issuesRoutes);
  app.use('/api/adblock', adblockRoutes);

  app.use(errorHandler);

  return app;
}
