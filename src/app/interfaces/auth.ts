export interface TAuthenticatedUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  systemRole: string;
  isActive: boolean;
}

export interface TWorkspaceMembershipContext {
  id: string;
  workspaceId: string;
  userId: string;
  role: string;
  status: string;
}
