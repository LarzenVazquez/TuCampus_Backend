import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";

export const adminController = {
  getUsers: async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { created_at: "desc" },
        include: { _count: { select: { archivos: true } } },
      });
      res.json(users);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al obtener usuarios", error: error.message });
    }
  },

  updateUserStatus: async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const { rol, verificado } = req.body;
    const rolesPermitidos = ["A", "A_C", "Al", "A_V"];

    if (!rolesPermitidos.includes(rol)) {
      res.status(400).json({ message: "Rol no válido" });
      return;
    }

    try {
      await prisma.$transaction([
        prisma.user.update({
          where: { id: Array.isArray(id) ? id[0] : id },
          data: { rol, vendedor_verificado: !!verificado },
        }),
        prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            accion: "ADMIN_UPDATE",
            descripcion: `Update User ${id}: Rol=${rol}, Verif=${verificado}`,
            ip_address: req.ip as string,
          },
        }),
      ]);
      res.json({ message: "Usuario actualizado exitosamente" });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al actualizar", error: error.message });
    }
  },

  verifySeller: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      await prisma.$transaction([
        prisma.user.update({
          where: { id: Array.isArray(id) ? id[0] : id },
          data: { vendedor_verificado: true, rol: "A_V" },
        }),
        prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            accion: "ADMIN_VERIFY",
            descripcion: `Vendedor verificado ID: ${id}. Rol cambiado a A_V`,
            ip_address: req.ip as string,
          },
        }),
      ]);
      res.json({ message: "Vendedor verificado y rol actualizado a A_V" });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al verificar vendedor", error: error.message });
    }
  },

  getLogs: async (_req: Request, res: Response): Promise<void> => {
    try {
      const logs = await prisma.activityLog.findMany({
        orderBy: { fecha: "desc" },
        include: { user: { select: { nombre: true } } },
      });
      res.json(logs);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al obtener logs", error: error.message });
    }
  },

  deleteUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = Array.isArray(id) ? id[0] : id;
      await prisma.$transaction([
        prisma.user.delete({ where: { id: userId } }),
        prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            accion: "ADMIN_DELETE",
            descripcion: `Eliminó al usuario ID: ${userId}`,
            ip_address: req.ip as string,
          },
        }),
      ]);
      res.json({ message: "Usuario eliminado del sistema" });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al eliminar usuario", error: error.message });
    }
  },

  getStats: async (_req: Request, res: Response): Promise<void> => {
    try {
      const count = await prisma.user.count();
      res.json({ usuariosTotal: count });
    } catch (error: any) {
      res.status(500).json({
        message: "Error al obtener estadísticas",
        error: error.message,
      });
    }
  },
};
