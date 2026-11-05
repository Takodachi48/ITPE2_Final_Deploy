import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import facultyRoutes from './faculty.routes.js';
import publicRoutes from './public.routes.js';
import studentRoutes from './student.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/', publicRoutes);
router.use(
  '/admin',
  requireAuth,
  requireRole('admin', 'faculty'),
  adminRoutes,
);
router.use('/faculty', facultyRoutes);
router.use('/student', studentRoutes);

export default router;
