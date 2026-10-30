import { Request, Response } from "express";
import prisma from "../../lib/prismaClient";
import { sendEmail } from "../../lib/emailService";
import { notificarUsuario } from "../../services/notificationService";

/**
 * RQF24 - Solicitud de beca alimenticia.
 *  - El alumno envía matrícula, datos de contacto y motivo.
 *  - Solo puede tener una solicitud "Pendiente" a la vez.
 *  - Solo el Super Administrador (rol A) aprueba o rechaza.
 *  - Al aprobar se activa es_becado; en ambos casos se notifica al alumno.
 */

export const ESTATUS_SOLICITUD = [
  "Pendiente",
  "Aprobada",
  "Rechazada",
] as const;

const RE_MATRICULA = /^[A-Za-z0-9]{5,20}$/;
const RE_TELEFONO = /^[0-9+\-\s()]{7,20}$/;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const html = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const usuarioSelect = {
  select: {
    id: true,
    nombre: true,
    email: true,
    matricula: true,
    es_becado: true,
  },
} as const;

class SolicitudActiva extends Error {}

export const becaController = {
  /** POST /api/becas/solicitudes */
  crear: async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const matricula = texto(req.body?.matricula);
    const telefono = texto(req.body?.telefono);
    const correo = texto(req.body?.correo).toLowerCase();
    const motivo = texto(req.body?.motivo);

    const errores: string[] = [];
    if (!RE_MATRICULA.test(matricula))
      errores.push("La matrícula debe tener de 5 a 20 letras o números.");
    if (!RE_TELEFONO.test(telefono))
      errores.push("Escribe un teléfono de contacto válido.");
    if (correo && (!RE_CORREO.test(correo) || correo.length > 120))
      errores.push("El correo de contacto no es válido.");
    if (motivo.length < 20 || motivo.length > 1000)
      errores.push(
        "Explica el motivo de tu solicitud en 20 a 1000 caracteres.",
      );
    if (errores.length) {
      res.status(400).json({ message: "Error de validación", errors: errores });
      return;
    }

    try {
      const solicitud = await prisma.$transaction(async (tx) => {
        // Bloquea la fila del alumno: dos envíos simultáneos no pueden crear dos solicitudes.
        await tx.$queryRaw`SELECT id FROM auth."User" WHERE id = ${userId} FOR UPDATE`;
        const usuario = await tx.user.findUnique({
          where: { id: userId },
          select: { email: true, es_becado: true },
        });
        if (!usuario) throw new Error("Usuario no encontrado");
        if (usuario.es_becado)
          throw new SolicitudActiva(
            "Ya cuentas con la beca alimenticia activa.",
          );

        const activa = await tx.solicitudBeca.findFirst({
          where: { userId, estatus: "Pendiente" },
        });
        if (activa)
          throw new SolicitudActiva(
            "Ya tienes una solicitud de beca en proceso. Espera a que sea revisada.",
          );

        const creada = await tx.solicitudBeca.create({
          data: {
            userId,
            matricula,
            telefono,
            correo: correo || usuario.email,
            motivo,
          },
        });
        await tx.activityLog.create({
          data: {
            userId,
            accion: "SOLICITUD_BECA_CREADA",
            descripcion: `Envió una solicitud de beca alimenticia (matrícula ${matricula})`,
            ip_address: req.ip,
          },
        });
        return creada;
      });

      req.app
        .get("io")
        ?.to("admin")
        .emit("nueva_solicitud_beca", { id: solicitud.id });
      res
        .status(201)
        .json({
          message: "Solicitud enviada. Te avisaremos cuando sea revisada.",
          solicitud,
        });
    } catch (e: any) {
      if (e instanceof SolicitudActiva) {
        res.status(409).json({ message: e.message });
        return;
      }
      console.error("Error al crear solicitud de beca:", e);
      res.status(500).json({ message: "No se pudo registrar la solicitud." });
    }
  },

  /** GET /api/becas/solicitudes/mias - estado actual e historial del alumno. */
  mias: async (req: Request, res: Response): Promise<void> => {
    try {
      const [usuario, historial] = await Promise.all([
        prisma.user.findUnique({
          where: { id: req.user!.id },
          select: { es_becado: true },
        }),
        prisma.solicitudBeca.findMany({
          where: { userId: req.user!.id },
          orderBy: { created_at: "desc" },
        }),
      ]);
      res.json({
        esBecado: !!usuario?.es_becado,
        activa: historial.find((s) => s.estatus === "Pendiente") ?? null,
        historial,
      });
    } catch {
      res
        .status(500)
        .json({ message: "No se pudieron cargar tus solicitudes." });
    }
  },

  /** GET /api/becas/solicitudes?estatus=Pendiente|Aprobada|Rechazada (sin filtro: todas) */
  listar: async (req: Request, res: Response): Promise<void> => {
    try {
      const estatus = texto(req.query.estatus);
      const where = (ESTATUS_SOLICITUD as readonly string[]).includes(estatus)
        ? { estatus }
        : {};
      const solicitudes = await prisma.solicitudBeca.findMany({
        where,
        include: { user: usuarioSelect },
        orderBy: [{ estatus: "desc" }, { created_at: "asc" }],
      });
      const previas = await prisma.solicitudBeca.groupBy({
        by: ["userId"],
        where: {
          userId: { in: [...new Set(solicitudes.map((s) => s.userId))] },
        },
        _count: { _all: true },
      });
      const conteo = Object.fromEntries(
        previas.map((p) => [p.userId, p._count._all]),
      );
      res.json(
        solicitudes.map((s) => ({
          ...s,
          solicitudesDelAlumno: conteo[s.userId] ?? 1,
        })),
      );
    } catch {
      res
        .status(500)
        .json({ message: "No se pudieron cargar las solicitudes." });
    }
  },

  /** GET /api/becas/solicitudes/resumen */
  resumen: async (_req: Request, res: Response): Promise<void> => {
    const grupos = await prisma.solicitudBeca.groupBy({
      by: ["estatus"],
      _count: { _all: true },
    });
    const c = Object.fromEntries(grupos.map((g) => [g.estatus, g._count._all]));
    res.json({
      pendientes: c.Pendiente ?? 0,
      aprobadas: c.Aprobada ?? 0,
      rechazadas: c.Rechazada ?? 0,
    });
  },

  /** PATCH /api/becas/solicitudes/:id  body: { decision: "Aprobada" | "Rechazada", comentario? } */
  revisar: async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    const decision = texto(req.body?.decision);
    const comentario = texto(req.body?.comentario).slice(0, 500);

    if (decision !== "Aprobada" && decision !== "Rechazada") {
      res
        .status(400)
        .json({ message: "La decisión debe ser «Aprobada» o «Rechazada»." });
      return;
    }
    if (decision === "Rechazada" && comentario.length < 5) {
      res
        .status(400)
        .json({
          message: "Escribe el motivo del rechazo para informarlo al alumno.",
        });
      return;
    }

    try {
      const resultado = await prisma.$transaction(async (tx) => {
        const actual = await tx.solicitudBeca.findUnique({
          where: { id },
          include: { user: usuarioSelect },
        });
        if (!actual) return { estado: 404 as const };
        if (actual.estatus !== "Pendiente")
          return { estado: 409 as const, estatus: actual.estatus };

        if (decision === "Aprobada") {
          await tx.user.update({
            where: { id: actual.userId },
            data: { es_becado: true },
          });
        }
        const solicitud = await tx.solicitudBeca.update({
          where: { id },
          data: {
            estatus: decision,
            comentario: comentario || null,
            revisadoPor: req.user!.id,
            fecha_revision: new Date(),
          },
          include: { user: usuarioSelect },
        });
        await tx.activityLog.create({
          data: {
            userId: req.user!.id,
            accion:
              decision === "Aprobada"
                ? "SOLICITUD_BECA_APROBADA"
                : "SOLICITUD_BECA_RECHAZADA",
            descripcion: `${decision === "Aprobada" ? "Aprobó" : "Rechazó"} la solicitud de beca de ${actual.user.nombre} (${actual.user.email})${comentario ? `: ${comentario}` : ""}`,
            ip_address: req.ip,
          },
        });
        return { estado: 200 as const, solicitud };
      });

      if (resultado.estado === 404) {
        res.status(404).json({ message: "Solicitud no encontrada." });
        return;
      }
      if (resultado.estado === 409) {
        res
          .status(409)
          .json({
            message: `Esta solicitud ya fue revisada (${resultado.estatus}).`,
          });
        return;
      }

      const s = resultado.solicitud;
      const aprobada = decision === "Aprobada";
      const mensaje = aprobada
        ? "Tu solicitud de beca alimenticia fue aprobada. Ya puedes reclamar tu menú del día."
        : `Tu solicitud de beca alimenticia fue rechazada: ${comentario}. Puedes volver a solicitarla.`;
      const io = req.app.get("io");
      notificarUsuario(io, s.userId, mensaje);
      io?.to(s.userId).emit("beca_actualizada", {
        estatus: decision,
        esBecado: aprobada,
      });
      sendEmail(
        s.correo,
        aprobada
          ? "Tu beca alimenticia fue aprobada - TuCampus"
          : "Resultado de tu solicitud de beca - TuCampus",
        `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111827">
           <p>Hola, ${html(s.user.nombre)}.</p><p>${html(mensaje)}</p><p>Equipo TuCampus</p></div>`,
      ).catch((e) =>
        console.error("No se pudo enviar el correo de la beca:", e.message),
      );

      res.json({
        message: aprobada ? "Solicitud aprobada" : "Solicitud rechazada",
        solicitud: s,
      });
    } catch (e: any) {
      console.error("Error al revisar solicitud de beca:", e);
      res.status(500).json({ message: "No se pudo guardar la revisión." });
    }
  },
};
