import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, notFound } from '../lib/errors.js';
import {
  findModule,
  getSiteContent,
  getStats,
  listModules,
  listPresenters,
  listThemes,
} from '../repositories/content.repository.js';
import { moduleListQuerySchema } from '../validators/module.validator.js';
import { idOrSlugSchema } from '../validators/common.js';

const router = Router();

const presenterQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(''),
});

router.get(
  '/content',
  asyncHandler(async (req, res) => {
    const content = await getSiteContent();
    res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    res.json({ data: content });
  }),
);

router.get(
  '/modules',
  asyncHandler(async (req, res) => {
    const query = moduleListQuerySchema.omit({ status: true }).parse(req.query);
    const result = await listModules({
      ...query,
      includeDrafts: false,
    });

    res.json({
      data: result.data,
      meta: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      },
    });
  }),
);

router.get(
  '/modules/:idOrSlug',
  asyncHandler(async (req, res) => {
    const idOrSlug = idOrSlugSchema.parse(req.params.idOrSlug);
    const module = await findModule(idOrSlug, { includeDrafts: false });

    if (!module) throw notFound('That module is not in the published index.');

    res.json({ data: module });
  }),
);

router.get(
  '/themes',
  asyncHandler(async (req, res) => {
    const themes = await listThemes({ includeDrafts: false });
    res.json({ data: themes });
  }),
);

router.get(
  '/presenters',
  asyncHandler(async (req, res) => {
    const { q } = presenterQuerySchema.parse(req.query);
    const presenters = await listPresenters({ q, includeDrafts: false });

    res.json({ data: presenters });
  }),
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await getStats({ includeDrafts: false });
    res.json({ data: stats });
  }),
);

export default router;
