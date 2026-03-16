import { ProjectStatus, TaskStatus } from "../../../generated/prisma/enums";

export interface ICreateProjectPayload {
  name: string;
  description?: string;
  clientName?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
}

export interface IUpdateProjectPayload {
  name?: string;
  description?: string | null;
  clientName?: string | null;
  status?: ProjectStatus;
  startDate?: string | null;
  endDate?: string | null;
  archived?: boolean;
}

export interface IAssignProjectMembersPayload {
  userIds: string[];
}

export interface IProjectQuery {
  searchTerm?: string;
  status?: ProjectStatus;
  clientName?: string;
  archived?: "true" | "false";
  page?: string;
  limit?: string;
  sortBy?: "name" | "status" | "createdAt" | "updatedAt" | "startDate" | "endDate";
  sortOrder?: "asc" | "desc";
}

export interface IProjectTaskQuery {
  status?: TaskStatus;
  assignedToUserId?: string;
  page?: string;
  limit?: string;
  sortBy?: "createdAt" | "updatedAt" | "dueDate" | "title" | "status";
  sortOrder?: "asc" | "desc";
}

export interface IProjectListItem {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  clientName: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  endDate: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  _count: {
    tasks: number;
    members: number;
  };
}

export interface IProjectResponse {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  name: string;
  description: string | null;
  clientName: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  endDate: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdByUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  members: {
    id: string;
    createdAt: Date;
    user: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
  }[];
  _count: {
    tasks: number;
    members: number;
  };
}

export interface IProjectMemberResponse {
  id: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

export interface IProjectTaskListItem {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignedToUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
}

export interface IAssignProjectMembersResponse {
  projectId: string;
  addedCount: number;
  totalMembers: number;
}
