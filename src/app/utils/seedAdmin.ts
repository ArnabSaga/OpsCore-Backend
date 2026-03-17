import { SystemRole } from "../../generated/prisma/enums";
import { envVars } from "../config/env";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { fromNodeHeaders } from "better-auth/node";

export const seedSuperAdmin = async () => {
  try {
    const isSuperAdminExist = await prisma.user.findFirst({
      where: {
        systemRole: SystemRole.SUPER_ADMIN,
      },
    });

    if (isSuperAdminExist) {
      console.log("Super admin already exists. Skipping seeding super admin.");
      return;
    }

    const response = await auth.api.signUpEmail({
      body: {
        email: envVars.SUPER_ADMIN_EMAIL,
        password: envVars.SUPER_ADMIN_PASSWORD,
        name: envVars.SUPER_ADMIN_NAME,
        systemRole: SystemRole.SUPER_ADMIN,
        isActive: true,
        isDeleted: false,
      },
      headers: fromNodeHeaders({}),
      asResponse: true,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Failed to sign up super admin");
    }

    const data = await response.json();
    const userId = data.user.id;

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        emailVerified: true,
      },
    });

    const superAdmin = await prisma.user.findUnique({
      where: {
        email: envVars.SUPER_ADMIN_EMAIL,
      },
    });

    console.log("Super Admin Created Successfully", superAdmin);
  } catch (error) {
    console.error("Failed to seed super admin:", error);

    try {
      await prisma.user.delete({
        where: {
          email: envVars.SUPER_ADMIN_EMAIL,
        },
      });
    } catch (deleteError) {
      console.log("Failed to delete super admin.", deleteError);
    }
  }
};
