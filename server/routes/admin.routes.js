import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, notFound } from '../lib/errors.js';
import { requireAdmin } from '../middleware/auth.js';
import {
  findModule,
  getStats,
  listModules,
  listPresenters,
} from '../repositories/content.repository.js';
import { listProfiles } from '../repositories/profiles.repository.js';
import {
  addPresenter,
  appendVideo,
  changeProfileRole,
  createModule,
  editVideo,
  removeModule,
  removePresenter,
  removeVideo,
  renamePresenter,
  setModulePresenters,
  updateModule,
} from '../services/admin.service.js';
import { updateProfileAdminSchema } from '../validators/auth.validator.js';
import {
  moduleIdSchema,
  presenterIdsSchema,
  uuidSchema,
  videoInputSchema,
  videoUpdateSchema,
} from '../validators/common.js';
import {
  createModuleSchema,
  moduleListQuerySchema,
  updateModuleSchema,
} from '../validators/module.validator.js';
import {
  createPresenterSchema,
  updatePresenterSchema,
} from '../validators/presenter.validator.js';

const router = Router();

const paramsId = (req) => moduleIdSchema.parse(req.params.id);
const paramsUuid = (req, name = 'videoId') => uuidSchema.parse(req.params[name]);

const getAdminModule = async (id) => {
  const module = await findModule(id, { includeDrafts: true });
  if (!module) throw notFound(`Module ${id} was not found.`);
  return module;
};

router.get(
  '/modules',
  asyncHandler(async (req, res) => {
    const query = moduleListQuerySchema.parse(req.query);
    const result = await listModules({
      ...query,
      includeDrafts: true,
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
  '/modules/:id',
  asyncHandler(async (req, res) => {
    const module = await getAdminModule(paramsId(req));
    res.json({ data: module });
  }),
);

router.post(
  '/modules',
  asyncHandler(async (req, res) => {
    const input = createModuleSchema.parse(req.body);
    const module = await createModule(input);

    res.status(201).json({ data: module });
  }),
);

router.patch(
  '/modules/:id',
  asyncHandler(async (req, res) => {
    const id = paramsId(req);
    const input = updateModuleSchema.parse(req.body);
    const module = await updateModule(id, input);

    res.json({ data: module });
  }),
);

router.delete(
  '/modules/:id',
  asyncHandler(async (req, res) => {
    const id = paramsId(req);
    const hard = req.query.hard === 'true';
    const result = await removeModule(id, { hard, actor: req.auth });

    res.json({ data: result });
  }),
);

router.put(
  '/modules/:id/presenters',
  asyncHandler(async (req, res) => {
    const id = paramsId(req);
    const presenterIds = presenterIdsSchema.parse(req.body?.presenterIds);
    const module = await setModulePresenters(id, presenterIds);

    res.json({ data: module });
  }),
);

router.post(
  '/modules/:id/videos',
  asyncHandler(async (req, res) => {
    const id = paramsId(req);
    const input = videoInputSchema.parse(req.body);
    const video = await appendVideo(id, input);

    res.status(201).json({ data: video });
  }),
);

router.patch(
  '/modules/:id/videos/:videoId',
  asyncHandler(async (req, res) => {
    const id = paramsId(req);
    const videoId = paramsUuid(req);
    const input = videoUpdateSchema.parse(req.body);
    const video = await editVideo(id, videoId, input);

    res.json({ data: video });
  }),
);

router.delete(
  '/modules/:id/videos/:videoId',
  asyncHandler(async (req, res) => {
    const id = paramsId(req);
    const videoId = paramsUuid(req);
    const video = await removeVideo(id, videoId);

    res.json({ data: video });
  }),
);

router.get(
  '/presenters',
  asyncHandler(async (req, res) => {
    const q = z.string().trim().max(120).optional().default('').parse(req.query.q);
    const presenters = await listPresenters({ q, includeDrafts: true });

    res.json({ data: presenters });
  }),
);

router.post(
  '/presenters',
  asyncHandler(async (req, res) => {
    const input = createPresenterSchema.parse(req.body);
    const presenter = await addPresenter(input.name);

    res.status(201).json({ data: presenter });
  }),
);

router.patch(
  '/presenters/:id',
  asyncHandler(async (req, res) => {
    const id = paramsUuid(req, 'id');
    const input = updatePresenterSchema.parse(req.body);
    const presenter = await renamePresenter(id, input.name);

    res.json({ data: presenter });
  }),
);

router.delete(
  '/presenters/:id',
  asyncHandler(async (req, res) => {
    const id = paramsUuid(req, 'id');
    const presenter = await removePresenter(id);

    res.json({ data: presenter });
  }),
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const stats = await getStats({ includeDrafts: true });
    res.json({ data: stats });
  }),
);

router.get(
  '/profiles',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const approvalStatus = req.query.approvalStatus
      ? z.enum(['pending', 'approved', 'rejected']).parse(req.query.approvalStatus)
      : undefined;
    const role = req.query.role
      ? z.enum(['admin', 'faculty', 'student']).parse(req.query.role)
      : undefined;
    const profiles = await listProfiles({ approvalStatus, role });
    res.json({ data: profiles });
  }),
);

router.patch(
  '/profiles/:id',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = paramsUuid(req, 'id');
    const input = updateProfileAdminSchema.parse(req.body);
    const profile = await changeProfileRole(req.auth, id, input);

    res.json({ data: profile });
  }),
);

export default router;
