import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";
import { sanitizeUser } from "../../lib/sanitize";

export const getProfileFiles = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const files = await prisma.userFile.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.json(files);
  } catch (error: any) {
    res
      .status(500)
      .json({ error: "Error al obtener archivos", details: error.message });
  }
};

export const uploadProfilePic = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { fileName, url, hash } = req.body.fileData;
    const userId = req.user!.id;

    await prisma.$transaction([
      prisma.userFile.create({
        data: {
          userId: userId,
          nombre_archivo: fileName,
          url_archivo: url,
          file_hash: hash,
          tipo_archivo: "perfil",
        },
      }),
      prisma.activityLog.create({
        data: {
          userId: userId,
          accion: "UPDATE_PROFILE",
          descripcion: "Actualización de foto de perfil",
          ip_address: req.ip,
        },
      }),
    ]);

    res.json({ message: "Foto actualizada y registrada exitosamente" });
  } catch (error: any) {
    res
      .status(500)
      .json({ message: "Error al registrar la foto", error: error.message });
  }
};

export const updateProfile = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { nombre, telefono } = req.body as { nombre?: unknown; telefono?: unknown };

    const data: { nombre?: string; telefono?: string | null } = {};

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || nombre.trim().length < 2 || nombre.trim().length > 100) {
        res.status(400).json({ message: "El nombre debe tener entre 2 y 100 caracteres." });
        return;
      }
      data.nombre = nombre.trim();
    }

    if (telefono !== undefined) {
      const tel = typeof telefono === "string" ? telefono.trim() : "";
      if (tel && !/^[0-9+\-\s()]{7,20}$/.test(tel)) {
        res.status(400).json({ message: "El teléfono no tiene un formato válido." });
        return;
      }
      data.telefono = tel || null;
    }

    const actualizado = await prisma.user.update({
      where: { id: userId },
      data,
    });

    res.status(200).json({
      message: "Perfil actualizado correctamente",
      user: sanitizeUser(actualizado),
    });
  } catch (error: any) {
    console.error("Error al actualizar perfil:", error);
    res
      .status(500)
      .json({ message: "Error al guardar los cambios", error: error.message });
  }
};

export const userController = {
  getProfileFiles,
  updateProfile,
  uploadProfilePic,
};
