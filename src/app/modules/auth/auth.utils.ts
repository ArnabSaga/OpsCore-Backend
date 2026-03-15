import { Response } from "express";

type HeadersWithGetSetCookie = Headers & {
  getSetCookie?: () => string[];
};

//* Forward Better Auth Set-Cookie headers to Express response
export const forwardAuthCookies = (authResponse: globalThis.Response, res: Response): void => {
  const headers = authResponse.headers as HeadersWithGetSetCookie;

  if (typeof headers.getSetCookie === "function") {
    const cookies = headers.getSetCookie();

    if (cookies.length > 0) {
      res.setHeader("Set-Cookie", cookies);
    }

    return;
  }

  const singleCookie = authResponse.headers.get("set-cookie");

  if (singleCookie) {
    res.append("Set-Cookie", singleCookie);
  }
};
