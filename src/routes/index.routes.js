import { Router } from 'express';

import authRouter from './auth.routes.js';
import userRoutes from './user.routes.js';
import orgRouter from './organization.routes.js';
import departmentRoutes from './department.routes.js';
import teamRoutes from './team.routes.js';
import projectRoutes from './project.routes.js';
import sprintRoutes from './sprint.routes.js';
import taskRoutes from './task.routes.js';
import activitylogRoutes from './activitylog.routes.js';
// import chatRoutes from './chat.routes.js';
import videoConferenceRoutes from './videoConference.routes.js';
import permissionRoutes from './permission.routes.js';

const router = Router();

router.use(authRouter);
router.use(orgRouter);
router.use(userRoutes);
router.use(departmentRoutes);
router.use(teamRoutes);
router.use(projectRoutes);
router.use(sprintRoutes);
router.use(taskRoutes);
router.use(activitylogRoutes);
// router.use(chatRoutes);
router.use(videoConferenceRoutes);
router.use(permissionRoutes);

export default router;
