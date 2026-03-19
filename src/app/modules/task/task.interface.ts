import { ProjectStatus, TaskPriority, TaskStatus } from "../../../generated/prisma/enums";
import { WorkspacePlan } from "../../config/planFeatures";

export interface ICreateTaskPayload {
  projectId: string;
  title: string;
  description?: string;
  assignedToUserId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface IUpdateTaskPayload {
  projectId?: string;
  title?: string;
  description?: string | null;
  assignedToUserId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
}

export interface ITaskQuery {
  searchTerm?: string;
  projectId?: string;
  assignedToUserId?: string;
  assignedToMe?: "true" | "false";
  status?: TaskStatus;
  priority?: TaskPriority;
  overdue?: "true" | "false";
  dueFrom?: string;
  dueTo?: string;
  page?: string | number;
  limit?: string | number;
  sortBy?: "createdAt" | "updatedAt" | "dueDate" | "title" | "status" | "priority";
  sortOrder?: "asc" | "desc";
}

export interface ITaskPlanMeta {
  workspacePlan: WorkspacePlan;
  isTrialActive: boolean;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
}

export interface ITaskListItem {
  id: string;
  workspaceId: string;
  projectId: string;
  assignedToUserId: string | null;
  createdByUserId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
  };
  assignedToUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  createdByUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  _count: {
    comments: number;
    attachments: number;
  };
}

export interface ITaskResponse {
  id: string;
  workspaceId: string;
  projectId: string;
  assignedToUserId: string | null;
  createdByUserId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  project: {
    id: string;
    name: string;
    status: ProjectStatus;
    archivedAt: Date | null;
  };
  assignedToUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
  createdByUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  _count: {
    comments: number;
    attachments: number;
  };
  planMeta?: ITaskPlanMeta;
}

export interface ITaskCommentQuery {
  page?: string | number;
  limit?: string | number;
}

export interface ICreateTaskCommentPayload {
  body: string;
}

export interface IUpdateTaskCommentPayload {
  body: string;
}

export interface ITaskCommentResponse {
  id: string;
  workspaceId: string;
  taskId: string;
  userId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface ITaskAttachmentQuery {
  page?: string | number;
  limit?: string | number;
}

export interface ITaskAttachmentResponse {
  id: string;
  workspaceId: string;
  taskId: string;
  uploadedById: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: Date;
  uploadedBy: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface IPaginatedTaskCommentResponse {
  data: ITaskCommentResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IPaginatedTaskAttachmentResponse {
  data: ITaskAttachmentResponse[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
