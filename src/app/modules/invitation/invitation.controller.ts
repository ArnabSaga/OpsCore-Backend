import { Request, Response } from "express";
import status from "http-status";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { InvitationService } from "./invitation.service";

const getInvitations = catchAsync(async (req: Request, res: Response) => {
  const result = await InvitationService.getInvitations(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invitations fetched successfully",
    data: result,
  });
});

const createInvitation = catchAsync(async (req: Request, res: Response) => {
  const result = await InvitationService.createInvitation(req);

  sendResponse(res, {
    statusCode: status.CREATED,
    success: true,
    message: "Invitation sent successfully",
    data: result,
  });
});

const cancelInvitation = catchAsync(async (req: Request, res: Response) => {
  await InvitationService.cancelInvitation(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invitation cancelled successfully",
  });
});

const acceptInvitation = catchAsync(async (req: Request, res: Response) => {
  const result = await InvitationService.acceptInvitation(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invitation accepted successfully",
    data: result,
  });
});

const declineInvitation = catchAsync(async (req: Request, res: Response) => {
  await InvitationService.declineInvitation(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invitation declined successfully",
  });
});

export const InvitationController = {
  getInvitations,
  createInvitation,
  cancelInvitation,
  acceptInvitation,
  declineInvitation,
};
