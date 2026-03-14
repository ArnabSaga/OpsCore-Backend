import { Response } from "express";

export interface IMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface IResponseData<T> {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
  meta?: IMeta;
}

export const sendResponse = <T>(res: Response, responseData: IResponseData<T>) => {
  const { statusCode, success, message, data, meta } = responseData;

  res.status(statusCode).json({
    success,
    message,
    ...(data !== undefined && { data }),
    ...(meta && { meta }),
  });
};
