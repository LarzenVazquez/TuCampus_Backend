import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    res
      .status(401)
      .json({ error: "Acceso denegado: No se proporcionó un token" });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET as string;
    const decoded = jwt.verify(token, secret) as {
      id: string;
      rol: string;
      email: string;
      nombre: string;
    };

    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: "Token inválido o expirado" });
  }
};

// Función privada de utilidad para validar roles
const checkRole = (
  role: string,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const rol = req.user?.rol?.trim();
  if (req.user && rol === role) {
    next();
  } else {
    res.status(403).json({
      error: `Acceso denegado: Se requiere rol ${role}`,
    });
  }
};

export const isAdmin = (req: Request, res: Response, next: NextFunction) =>
  checkRole("A", req, res, next);
export const isAdminC = (req: Request, res: Response, next: NextFunction) =>
  checkRole("A_C", req, res, next);
export const isSeller = (req: Request, res: Response, next: NextFunction) =>
  checkRole("A_V", req, res, next);
export const isAlumno = (req: Request, res: Response, next: NextFunction) =>
  checkRole("AL", req, res, next);
