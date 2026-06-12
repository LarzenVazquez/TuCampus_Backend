import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";

export const getMisNotificaciones = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const notifs = await prisma.notificacion.findMany({
      where: { userId: req.user.id },
      orderBy: { fecha: "desc" },
    });

    res.json(notifs);
  } catch (error: any) {
    res.status(500).json({
      message: "Error al obtener notificaciones",
      error: error.message,
    });
  }
};

export const marcarLeidas = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    await prisma.notificacion.updateMany({
      where: {
        userId: req.user.id,
        leida: false,
      },
      data: {
        leida: true,
      },
    });

    res.json({ message: "Notificaciones actualizadas" });
  } catch (error: any) {
    res.status(500).json({
      message: "Error al actualizar notificaciones",
      error: error.message,
    });
  }
};

export const notificationController = {
  getMisNotificaciones,
  marcarLeidas,
};
