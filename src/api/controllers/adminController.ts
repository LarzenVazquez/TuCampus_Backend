import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../../lib/prismaClient";
import { sanitizeUser } from "../../lib/sanitize";
import { notificarUsuario } from "../../services/notificationService";

export const adminController = {
  getUsers: async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { created_at: "desc" },
        include: {
          _count: { select: { archivos: true, userFiles: true } },
        },
      });

      res.json(users.map((u) => sanitizeUser(u)));
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al obtener usuarios", error: error.message });
    }
  },

  updateUserStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { rol, verificado } = req.body;
      const targetId = typeof id === "string" ? id : id[0];

      const rolesPermitidos = ["A", "A_C", "Al", "A_V"];
      if (!rolesPermitidos.includes(rol)) {
        res.status(400).json({ message: "Rol no válido" });
        return;
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: targetId },
        select: { nombre: true },
      });
      const nombreObjetivo = targetUser?.nombre || targetId;

      if (targetId === req.user!.id && rol !== "A") {
        res.status(400).json({
          message: "No puedes quitarte a ti mismo el rol de administrador.",
        });
        return;
      }

      const [actualizado] = await prisma.$transaction([
        prisma.user.update({
          where: { id: targetId },
          data: {
            rol,
            vendedor_verificado: rol === "A_V" ? true : !!verificado,
          },
        }),
        prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            accion: "ADMIN_UPDATE",
            descripcion: `Actualizó a ${nombreObjetivo}: Rol=${rol}, Verif=${verificado}`,
            ip_address: req.ip,
          },
        }),
      ]);

      res.json({
        message: "Usuario actualizado exitosamente",
        user: sanitizeUser(actualizado),
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al actualizar", error: error.message });
    }
  },

  verifySeller: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const targetId = typeof id === "string" ? id : id[0];

      const targetUser = await prisma.user.findUnique({
        where: { id: targetId },
        select: { nombre: true },
      });
      const nombreObjetivo = targetUser?.nombre || targetId;

      const [actualizado] = await prisma.$transaction([
        prisma.user.update({
          where: { id: targetId },
          data: { vendedor_verificado: true, rol: "A_V" },
        }),
        prisma.activityLog.create({
          data: {
            userId: req.user!.id,
            accion: "ADMIN_VERIFY",
            descripcion: `Verificó a ${nombreObjetivo} como vendedor. Rol cambiado a A_V`,
            ip_address: req.ip,
          },
        }),
      ]);

      notificarUsuario(
        req.app.get("io"),
        targetId,
        "Tu cuenta fue verificada como vendedor. Ya puedes publicar en el Marketplace.",
      );

      res.json({
        message: "Vendedor verificado y rol actualizado a A_V",
        user: sanitizeUser(actualizado),
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al verificar vendedor", error: error.message });
    }
  },

  toggleBeca: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = Array.isArray(id) ? id[0] : id;
      const { esBecado } = req.body as { esBecado: boolean };

      const usuario = await prisma.$transaction(async (tx) => {
        const actualizado = await tx.user.update({
          where: { id: userId },
          data: { es_becado: !!esBecado },
        });
        await tx.activityLog.create({
          data: {
            userId: req.user!.id,
            accion: esBecado ? "BECA_ASIGNADA" : "BECA_REVOCADA",
            descripcion: `${esBecado ? "Asignó" : "Revocó"} la beca alimenticia a ${actualizado.nombre}`,
            ip_address: req.ip,
          },
        });
        return actualizado;
      });

      if (usuario.es_becado) {
        notificarUsuario(
          req.app.get("io"),
          usuario.id,
          "🎓 Se te asignó la beca alimenticia. Ya puedes reclamar tu menú del día.",
        );
      }

      res.json({
        message: `Beca ${esBecado ? "asignada" : "revocada"} correctamente`,
        es_becado: usuario.es_becado,
        user: sanitizeUser(usuario),
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al actualizar la beca", error: error.message });
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

  toggleActive: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = Array.isArray(id) ? id[0] : id;
      const { activo } = req.body as { activo: boolean };

      if (userId === req.user!.id && !activo) {
        res
          .status(400)
          .json({ message: "No puedes desactivar tu propia cuenta." });
        return;
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { nombre: true },
      });
      const nombreObjetivo = targetUser?.nombre || userId;

      const usuario = await prisma.$transaction(async (tx) => {
        const actualizado = await tx.user.update({
          where: { id: userId },
          data: { activo: !!activo },
        });
        await tx.activityLog.create({
          data: {
            userId: req.user!.id,
            accion: activo ? "USUARIO_ACTIVADO" : "USUARIO_DESACTIVADO",
            descripcion: `${activo ? "Activó" : "Desactivó"} la cuenta de ${nombreObjetivo}`,
            ip_address: req.ip,
          },
        });
        return actualizado;
      });

      res.json({
        message: `Usuario ${activo ? "activado" : "desactivado"} correctamente`,
        activo: usuario.activo,
        user: sanitizeUser(usuario),
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error al actualizar el estado del usuario",
        error: error.message,
      });
    }
  },

  createUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const { nombre, email, password, rol } = req.body as {
        nombre?: string;
        email?: string;
        password?: string;
        rol?: string;
      };

      if (!nombre || !email || !password || !rol) {
        res.status(400).json({ message: "Todos los campos son obligatorios." });
        return;
      }

      const rolesPermitidos = ["A", "A_C", "A_V"];
      if (!rolesPermitidos.includes(rol)) {
        res.status(400).json({
          message: "Ese rol no puede asignarse desde este formulario.",
        });
        return;
      }

      const existente = await prisma.user.findUnique({ where: { email } });
      if (existente) {
        res
          .status(409)
          .json({ message: "Ya existe un usuario con ese correo." });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const nuevoUsuario = await prisma.$transaction(async (tx) => {
        const creado = await tx.user.create({
          data: {
            nombre,
            email,
            password: hashedPassword,
            rol,
            email_verificado: true,
            activo: true,
          },
        });
        await tx.activityLog.create({
          data: {
            userId: req.user!.id,
            accion: "ADMIN_CREATE",
            descripcion: `Creó la cuenta de ${creado.nombre} con rol ${rol}`,
            ip_address: req.ip,
          },
        });
        return creado;
      });

      res.status(201).json({
        message: "Usuario creado correctamente",
        user: {
          id: nuevoUsuario.id,
          nombre: nuevoUsuario.nombre,
          email: nuevoUsuario.email,
          rol: nuevoUsuario.rol,
        },
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al crear usuario", error: error.message });
    }
  },

  getStats: async (_req: Request, res: Response): Promise<void> => {
    try {
      const [
        usuariosTotal,
        porRol,
        becados,
        inactivos,
        marketPendientes,
        marketActivos,
        contactosPendientes,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.groupBy({ by: ["rol"], _count: { _all: true } }),
        prisma.user.count({ where: { es_becado: true } }),
        prisma.user.count({ where: { activo: false } }),
        prisma.market.count({ where: { estatus: "pendiente" } }),
        prisma.market.count({ where: { estatus: "activo" } }),
        prisma.contactoMensaje.count({ where: { respondido: false } }),
      ]);

      const roles = Object.fromEntries(
        porRol.map((r) => [r.rol, r._count._all]),
      );

      res.json({
        usuariosTotal,
        administradores: roles["A"] || 0,
        cocina: roles["A_C"] || 0,
        alumnos: roles["Al"] || 0,
        vendedores: roles["A_V"] || 0,
        becados,
        inactivos,
        marketPendientes,
        marketActivos,
        contactosPendientes,
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error al obtener estadísticas",
        error: error.message,
      });
    }
  },
};
