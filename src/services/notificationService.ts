import { Server } from "socket.io";
import prisma from "../lib/prismaClient";

export async function notificarUsuario(
  io: Server | undefined,
  userId: string,
  mensaje: string,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    const notif = await prisma.notificacion.create({
      data: { userId, mensaje },
    });
    io?.to(userId).emit("nueva_notificacion", { ...notif, ...meta });
  } catch (err: any) {
    console.error("No se pudo crear la notificación:", err.message);
  }
}
