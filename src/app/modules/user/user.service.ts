import { Request } from "express";
import status from "http-status";
import AppError from "../../errors/AppError";
import { WorkspaceMemberStatus } from "../../../generated/prisma/enums";
import { prisma } from "../../lib/prisma";
import { IProfileResponse, IUpdateProfilePayload } from "./user.interface";
import { destroyCloudinaryAssetByUrl } from "../../config/cloudinary.config";

const profileSelect = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  image: true,
  systemRole: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  workspaceMembers: {
    where: {
      status: WorkspaceMemberStatus.ACTIVE,
      workspace: { deletedAt: null },
    },
    select: {
      role: true,
      status: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
    orderBy: {
      joinedAt: "asc" as const,
    },
  },
};

const getProfile = async (req: Request): Promise<IProfileResponse> => {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: profileSelect,
    });

    if (!user) {
      throw new AppError(status.NOT_FOUND, "User not found");
    }

    return user;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to fetch profile");
  }
};

const updateProfile = async (req: Request): Promise<IProfileResponse> => {
  try {
    const userId = req.user!.id;
    const { name, removeImage } = req.body as IUpdateProfilePayload;
    const file = req.file;

    if (name === undefined && !file && removeImage === undefined) {
      throw new AppError(status.BAD_REQUEST, "No profile changes provided");
    }

    if (file && removeImage === "true") {
      throw new AppError(
        status.BAD_REQUEST,
        "You cannot upload a new image and remove the current image in the same request"
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    });

    if (!existingUser) {
      throw new AppError(status.NOT_FOUND, "User not found");
    }

    let imageUrl: string | null | undefined = undefined;

    if (file && file.path) {
      imageUrl = file.path;
    } else if (removeImage === "true") {
      imageUrl = null;
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        ...(imageUrl !== undefined && { image: imageUrl }),
      },
      select: profileSelect,
    });

    if (imageUrl !== undefined && existingUser.image && existingUser.image !== imageUrl) {
      destroyCloudinaryAssetByUrl(existingUser.image).catch(console.error);
    }

    return user;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(status.INTERNAL_SERVER_ERROR, "Failed to update profile");
  }
};

export const UserService = {
  getProfile,
  updateProfile,
};
