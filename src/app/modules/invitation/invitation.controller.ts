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

const resendInvitation = catchAsync(async (req: Request, res: Response) => {
  const result = await InvitationService.resendInvitation(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invitation resent successfully",
    data: result,
  });
});

const expireInvitation = catchAsync(async (req: Request, res: Response) => {
  await InvitationService.expireInvitation(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invitation expired successfully",
  });
});

const getMyInvitations = catchAsync(async (req: Request, res: Response) => {
  const result = await InvitationService.getMyInvitations(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Your invitations fetched successfully",
    data: result,
  });
});

const getInvitationByToken = catchAsync(async (req: Request, res: Response) => {
  const result = await InvitationService.getInvitationByToken(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invitation fetched successfully",
    data: result,
  });
});

const deleteInvitation = catchAsync(async (req: Request, res: Response) => {
  await InvitationService.deleteInvitation(req);

  sendResponse(res, {
    statusCode: status.OK,
    success: true,
    message: "Invitation deleted successfully",
  });
});

export const InvitationController = {
  getInvitations,
  getMyInvitations,
  createInvitation,
  cancelInvitation,
  acceptInvitation,
  declineInvitation,
  resendInvitation,
  expireInvitation,
  getInvitationByToken,
  deleteInvitation,
};
