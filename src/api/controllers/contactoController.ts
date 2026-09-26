import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";

const ensureString = (val: unknown): string =>
  Array.isArray(val) ? String(val[0] ?? "") : String(val ?? "");

export const contactoController = {
  enviar: async (req: Request, res: Response): Promise<void> => {
    try {
      const { nombre, email, asunto, mensaje } = req.body as {
        nombre: string;
        email: string;
        asunto?: string;
        mensaje: string;
      };

      const creado = await prisma.contactoMensaje.create({
        data: { nombre, email, asunto: asunto || null, mensaje },
      });
      req.app.get("io")?.to("staff").emit("nuevo_contacto", {
        id: creado.id,
        nombre: creado.nombre,
        asunto: creado.asunto,
      });

      res.status(201).json({
        message: "¡Gracias! Recibimos tu mensaje y te responderemos pronto.",
        id: creado.id,
      });
    } catch (error: any) {
      console.error("Error al guardar contacto:", error);
      res.status(500).json({ message: "No se pudo enviar tu mensaje." });
    }
  },

  listar: async (req: Request, res: Response): Promise<void> => {
    try {
      const soloPendientes = ensureString(req.query.pendientes) === "true";
      const mensajes = await prisma.contactoMensaje.findMany({
        where: soloPendientes ? { respondido: false } : undefined,
        orderBy: { created_at: "desc" },
      });
      res.json(mensajes);
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Error al obtener los mensajes de contacto." });
    }
  },

  marcarRespondido: async (req: Request, res: Response): Promise<void> => {
    try {
      const id = ensureString(req.params.id);
      const respondido =
        typeof req.body?.respondido === "boolean" ? req.body.respondido : true;

      const existe = await prisma.contactoMensaje.findUnique({ where: { id } });
      if (!existe) {
        res.status(404).json({ message: "Mensaje no encontrado." });
        return;
      }

      const actualizado = await prisma.$transaction(async (tx) => {
        const msg = await tx.contactoMensaje.update({
          where: { id },
          data: { respondido },
        });
        await tx.activityLog.create({
          data: {
            userId: req.user!.id,
            accion: respondido ? "CONTACTO_RESPONDIDO" : "CONTACTO_REABIERTO",
            descripcion: `${respondido ? "Marcó como respondido" : "Reabrió"} el mensaje de ${msg.nombre} (${msg.email})`,
            ip_address: req.ip,
          },
        });
        return msg;
      });

      res.json(actualizado);
    } catch (error: any) {
      res.status(500).json({ message: "No se pudo actualizar el mensaje." });
    }
  },
};
