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
export const hasRole =
  (...roles: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const rol = req.user?.rol?.trim();
    if (req.user && rol && roles.includes(rol)) {
      next();
      return;
    }
    res.status(403).json({
      error: `Acceso denegado: Se requiere rol ${roles.join(" o ")}`,
    });
  };

export const isAdmin = hasRole("A");
export const isAdminC = hasRole("A_C");
export const isStaff = hasRole("A", "A_C");
export const isSeller = hasRole("A_V", "A");
export const isAlumno = hasRole("Al");
