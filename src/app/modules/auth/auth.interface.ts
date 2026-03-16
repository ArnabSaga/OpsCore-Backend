export interface IRegisterPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  workspaceName: string;
}

export interface ILoginPayload {
  email: string;
  password: string;
}

export interface IForgotPasswordPayload {
  email: string;
}

export interface IResetPasswordPayload {
  email: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}

export interface IChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface IVerifyEmailPayload {
  email: string;
  otp: string;
}

export interface IResendVerificationPayload {
  email: string;
}

export interface ISwitchWorkspacePayload {
  workspaceId: string;
}

export interface IAuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  emailVerified?: boolean;
  systemRole?: string;
  isActive?: boolean;
  isDeleted?: boolean;
}

export interface IWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRegisterServiceResponse {
  authResponse: globalThis.Response;
  user: IAuthUser;
  workspace: IWorkspaceSummary;
}

export interface ILoginServiceResponse {
  authResponse: globalThis.Response;
  user: IAuthUser;
}

export interface ILogoutServiceResponse {
  authResponse: globalThis.Response;
}

export interface IMeResponse {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  systemRole: string;
  isActive: boolean;
  createdAt: Date;
  workspaceMembers: {
    role: string;
    status: string;
    workspace: {
      id: string;
      name: string;
      slug: string;
    };
  }[];
}
