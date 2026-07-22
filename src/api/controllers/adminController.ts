import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../../lib/prismaClient";

export const adminController = {
  // 1. Obtener usuarios con conteo de archivos mediante Prisma
  getUsers: async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await prisma.user.findMany({
        orderBy: { created_at: "desc" },
        include: {
          _count: { select: { archivos: true } },
        },
      });
      res.json(users);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al obtener usuarios", error: error.message });
    }
  },

  // 2. Actualizar estatus
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

      await prisma.$transaction([
        prisma.user.update({
          where: { id: targetId },
          data: { rol, vendedor_verificado: !!verificado },
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

      res.json({ message: "Usuario actualizado exitosamente" });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al actualizar", error: error.message });
    }
  },

  // 3. Verificar vendedor
  verifySeller: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const targetId = typeof id === "string" ? id : id[0];

      const targetUser = await prisma.user.findUnique({
        where: { id: targetId },
        select: { nombre: true },
      });
      const nombreObjetivo = targetUser?.nombre || targetId;

      await prisma.$transaction([
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

      res.json({ message: "Vendedor verificado y rol actualizado a A_V" });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al verificar vendedor", error: error.message });
    }
  },

  // 3.5 Alternar beca alimenticia de un alumno
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

      res.json({
        message: `Beca ${esBecado ? "asignada" : "revocada"} correctamente`,
        es_becado: usuario.es_becado,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al actualizar la beca", error: error.message });
    }
  },

  // 4. Logs con relación a User
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

  // 5. Activar / Desactivar cuenta (reemplaza el borrado físico).
  // Nunca se elimina el registro del usuario: tiene órdenes, productos,
  // chats y logs vinculados con ON DELETE RESTRICT, así que un DELETE
  // directo siempre fallaría por integridad referencial. Desactivar es
  // además la práctica correcta: conserva el historial y es reversible.
  toggleActive: async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = Array.isArray(id) ? id[0] : id;
      const { activo } = req.body as { activo: boolean };

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
      });
    } catch (error: any) {
      res.status(500).json({
        message: "Error al actualizar el estado del usuario",
        error: error.message,
      });
    }
  },

  // 5.5 Crear cuentas de staff (Admin, Cocina, Vendedor). Los alumnos NO
  // se crean desde aquí: se registran ellos mismos por el flujo público
  // de /auth/register, así que el rol "Al" está bloqueado en este endpoint
  // a propósito.
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
        res.status(409).json({ message: "Ya existe un usuario con ese correo." });
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
            // El admin lo está creando directamente, no necesita pasar
            // por el flujo de verificación de correo del registro público.
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

  // 6. Estadísticas
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