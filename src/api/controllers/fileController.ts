import { Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import prisma from "../../lib/prismaClient";

export const uploadProfileImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: "No se proporcionó ningún archivo" });
      return;
    }

    if (!req.user) {
      res.status(401).json({ message: "Usuario no autenticado" });
      return;
    }

    const file = req.file;
    const userId = req.user.id;

    const fileBuffer = fs.readFileSync(file.path);
    const fileHash = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    // Preparar subida a ImgBB
    const form = new FormData();
    form.append("image", fileBuffer.toString("base64"));

    const imgbbRes = await axios.post(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      form,
      { headers: form.getHeaders() },
    );

    const remoteUrl: string = imgbbRes.data.data.url;
    await prisma.userFile.create({
      data: {
        userId: userId,
        nombre_archivo: file.originalname,
        url_archivo: remoteUrl,
        file_hash: fileHash,
        tipo_archivo: "perfil",
      },
    });

    // Limpieza de archivo temporal
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    res.status(200).json({
      status: "success",
      message: "Perfil actualizado correctamente",
      url: remoteUrl,
    });
  } catch (error: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error("Error al subir la imagen:", error.message);
    res.status(500).json({
      message: "Error al procesar la solicitud",
      error: error.message,
    });
  }
};
