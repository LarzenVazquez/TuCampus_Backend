import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";

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
    const userId = req.user.id;

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
    const userId = req.user.id;
    const { nombre } = req.body;
    await prisma.user.update({
      where: { id: userId },
      data: {
        nombre,
      },
    });

    res.status(200).json({ message: "Perfil actualizado correctamente" });
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
