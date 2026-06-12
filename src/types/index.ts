import * as express from "express";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        rol: string;
        email: string;
        nombre: string;
      };
    }
  }
}
