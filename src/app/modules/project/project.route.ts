import { Router } from "express";
import { WorkspaceMemberRole } from "../../constants/role";
import { requireAuth } from "../../middlewares/requireAuth";
import { requireFeature } from "../../middlewares/requireFeature";
import { requireRole } from "../../middlewares/requireRole";
import validateRequest from "../../middlewares/validateRequest";
import { workspaceContext } from "../../middlewares/workspaceContext";
import { ProjectController } from "./project.controller";
import { ProjectValidation } from "./project.validation";

const router = Router();

router.use(requireAuth);
router.use(workspaceContext);

router.get(
  "/",
  validateRequest(ProjectValidation.getProjectsQuerySchema),
  ProjectController.getProjects
);

router.post(
  "/",
  requireFeature("projects.create"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(ProjectValidation.createProjectSchema),
  ProjectController.createProject
);

router.get(
  "/:projectId",
  validateRequest(ProjectValidation.projectIdParamSchema),
  ProjectController.getProject
);

router.patch(
  "/:projectId",
  validateRequest(ProjectValidation.projectIdParamSchema),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(ProjectValidation.updateProjectSchema),
  ProjectController.updateProject
);

router.delete(
  "/:projectId",
  validateRequest(ProjectValidation.projectIdParamSchema),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  ProjectController.deleteProject
);

router.get(
  "/:projectId/tasks",
  validateRequest(ProjectValidation.projectIdParamSchema),
  validateRequest(ProjectValidation.getProjectTasksQuerySchema),
  ProjectController.getProjectTasks
);

router.get(
  "/:projectId/members",
  validateRequest(ProjectValidation.projectIdParamSchema),
  ProjectController.getProjectMembers
);

router.get(
  "/:projectId/summary",
  validateRequest(ProjectValidation.projectIdParamSchema),
  ProjectController.getProjectSummary
);

router.post(
  "/:projectId/members",
  validateRequest(ProjectValidation.projectIdParamSchema),
  requireFeature("projects.assignMembers"),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  validateRequest(ProjectValidation.assignProjectMembersSchema),
  ProjectController.assignProjectMembers
);

router.delete(
  "/:projectId/members/:memberId",
  validateRequest(ProjectValidation.removeProjectMemberParamSchema),
  requireRole(WorkspaceMemberRole.OWNER, WorkspaceMemberRole.ADMIN),
  ProjectController.removeProjectMember
);


export const ProjectRoutes = router;
