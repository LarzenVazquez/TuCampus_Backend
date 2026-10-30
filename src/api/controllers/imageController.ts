import { NextFunction, Request, Response } from "express";
import multer from "multer";
import prisma from "../../lib/prismaClient";
import {
  ImagenError,
  MAX_BYTES_SUBIDA,
  ModuloImagen,
  guardarImagen,
  leerImagen,
  migrarImagenesProductos,
} from "../../services/imageStorage";

const MIME_PERMITIDOS = ["image/png", "image/jpeg", "image/jpg", "image/pjpeg"];

const multerImagen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES_SUBIDA, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (MIME_PERMITIDOS.includes(file.mimetype)) cb(null, true);
    else
      cb(
        new ImagenError(
          "Formato no permitido. Solo se aceptan imágenes PNG o JPEG.",
          415,
        ),
      );
  },
});

/** Recibe un archivo en el campo "image" (multipart/form-data). */
export const recibirImagen = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  multerImagen.single("image")(req, res, (err: any) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res
        .status(413)
        .json({ message: "La imagen supera el tamaño máximo de 5 MB." });
      return;
    }
    if (err instanceof ImagenError) {
      res.status(err.status).json({ message: err.message });
      return;
    }
    res.status(400).json({ message: "No se pudo leer el archivo enviado." });
  });
};

export const subirImagen =
  (modulo: ModuloImagen) =>
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res
        .status(400)
        .json({ message: "Selecciona una imagen PNG o JPEG (campo «image»)." });
      return;
    }
    try {
      const img = await guardarImagen(req.file.buffer, modulo, {
        subidoPor: req.user?.id,
      });
      res.status(201).json({ message: "Imagen guardada", ...img });
    } catch (e: any) {
      if (e instanceof ImagenError) {
        res.status(e.status).json({ message: e.message });
        return;
      }
      console.error("Error al guardar imagen:", e);
      res.status(500).json({ message: "No se pudo guardar la imagen." });
    }
  };

/** GET /api/images/:id — la imagen nunca cambia, así que se cachea de forma permanente. */
export const servirImagen = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = String(req.params.id);
    const img = await leerImagen(id);
    if (!img) {
      res.status(404).json({ message: "Imagen no encontrada" });
      return;
    }
    const etag = `"${img.sha256}"`;
    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }
    res.type(img.mime).send(img.datos);
  } catch (e) {
    res.status(500).json({ message: "No se pudo leer la imagen." });
  }
};

export const migrarImagenes =
  (modulo: ModuloImagen) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const resultado = await migrarImagenesProductos(req.user?.id);
      await prisma.activityLog.create({
        data: {
          userId: req.user!.id,
          accion:
            modulo === "producto"
              ? "MIGRAR_IMAGENES_PRODUCTOS"
              : "MIGRAR_IMAGENES_MARKETPLACE",
          descripcion: `Migró ${resultado.migradas} de ${resultado.revisadas} registros con imágenes externas (${resultado.fallidas.length} con error)`,
          ip_address: req.ip,
        },
      });
      res.json({ message: "Migración terminada", ...resultado });
    } catch (e: any) {
      console.error("Error en la migración de imágenes:", e);
      res.status(500).json({ message: "No se pudo completar la migración." });
    }
  };

/** Resumen para el panel: cuántos registros siguen usando URLs externas. */
export const estadoImagenes = async (
  _req: Request,
  res: Response,
): Promise<void> => {
  const [productosExternos, productos, publicaciones] = await Promise.all([
    prisma.product.count({ where: { imagenUrl: { startsWith: "http" } } }),
    prisma.product.count(),
    prisma.market.findMany({ select: { imagenes: true } }),
  ]);
  const marketExternos = publicaciones.filter((p) =>
    p.imagenes.some((u) => /^https?:\/\//i.test(u)),
  ).length;
  res.json({
    productos: { total: productos, conUrlExterna: productosExternos },
    marketplace: { total: publicaciones.length, conUrlExterna: marketExternos },
  });
};

// --- URLs absolutas en las respuestas ---

const RE_RUTA = /^\/api\/images\/[0-9a-f-]{36}$/i;

const absolutizar = (
  valor: any,
  base: string,
  vistos: WeakSet<object>,
): any => {
  if (typeof valor === "string")
    return RE_RUTA.test(valor) ? base + valor : valor;
  if (!valor || typeof valor !== "object" || vistos.has(valor)) return valor;
  if (Array.isArray(valor)) {
    vistos.add(valor);
    return valor.map((v) => absolutizar(v, base, vistos));
  }
  if (Object.getPrototypeOf(valor) !== Object.prototype) return valor;
  vistos.add(valor);
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(valor))
    out[k] = absolutizar(v, base, vistos);
  return out;
};

/**
 * En la base de datos se guarda la ruta relativa "/api/images/<id>" (así no
 * depende del dominio del backend). Al responder se convierte en URL absoluta,
 * para que el frontend Angular y el Vite la usen directamente en <img src>.
 */
export const imagenesAbsolutas = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const json = res.json.bind(res);
  res.json = (body?: any) => {
    const base = (
      process.env.PUBLIC_API_URL || `${req.protocol}://${req.get("host")}`
    ).replace(/\/+$/, "");
    return json(absolutizar(body, base, new WeakSet()));
  };
  next();
};
