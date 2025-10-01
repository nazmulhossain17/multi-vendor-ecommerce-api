import "express";

declare global {
  namespace Express {
    // match your JWT payload shape
    interface UserPayload {
      id: number;
      email: string;
      role: string;
    }

    // extend Request
    interface Request {
      user?: UserPayload;
    }
  }
}
