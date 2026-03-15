import { NextFunction, Request, Response } from "express";
import { ZodObject, ZodRawShape } from "zod";

const validateRequest =
  (schema: ZodObject<ZodRawShape>) => async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      req.body = parsed.body ?? req.body;
      // req.query is a read-only getter on IncomingMessage — mutate in place instead of reassigning
      if (parsed.query) Object.assign(req.query, parsed.query);
      // req.params can be mutated safely via Object.assign
      if (parsed.params) Object.assign(req.params, parsed.params);

      next();
    } catch (error) {
      next(error);
    }
  };

export default validateRequest;
