export interface IActivityLogQuery {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  userId?: string;
  from?: Date;
  to?: Date;
}

export interface IActivityLogActor {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

export interface IActivityLogItem {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  entityTitle: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  user: IActivityLogActor;
}

export interface IActivityLogListResponse {
  data: IActivityLogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface IPlatformActivityLogItem extends IActivityLogItem {
  workspace: {
    id: string;
    name: string;
  } | null;
}

export interface IPlatformActivityLogListResponse {
  items: IPlatformActivityLogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}


