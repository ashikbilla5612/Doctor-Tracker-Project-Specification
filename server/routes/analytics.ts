import { Router, type Response } from 'express';
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware';
import { store } from '../db/store';

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  const rangeParam = req.query.range;
  const range =
    rangeParam === '7d' || rangeParam === '30d' || rangeParam === '90d' || rangeParam === 'all'
      ? rangeParam
      : '30d';

  const summary = store.getAnalytics(range);
  res.json(summary);
});
