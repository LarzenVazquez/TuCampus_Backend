import crypto from "crypto";
import dns from "dns/promises";
import fs from "fs/promises";
import net from "net";
import path from "path";
import axios from "axios";
import sharp from "sharp";
import prisma from "../lib/prismaClient";

/**
 * Almacenamiento propio de imágenes (RNF-15 y RNF-16).
 *
 * Las imágenes se guardan como archivos PNG o JPEG del propio sistema y se
 * sirven en /api/images/:id, sin depender de URLs externas.
 *
 * IMAGE_STORAGE=db   (por defecto) guarda el archivo en PostgreSQL. Es la
 *                    opción segura en Render gratuito, cuyo disco se borra
 *                    en cada despliegue.
 * IMAGE_STORAGE=disk guarda el archivo en IMAGE_STORAGE_DIR (por defecto
 *                    uploads/images), para servidores con disco persistente.
 */

export type ModuloImagen = "producto" | "marketplace";

export const MAX_BYTES_SUBIDA = 5 * 1024 * 1024;
const MAX_BYTES_DESCARGA = 8 * 1024 * 1024;
const MAX_LADO = 1600;
const RUTA_PUBLICA = "/api/images/";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const RE_INTERNA = new RegExp(`^${RUTA_PUBLICA}(${UUID})$`, "i");
const RE_ID_EN_URL = new RegExp(`${RUTA_PUBLICA}(${UUID})(?:[?#].*)?$`, "i");

export class ImagenError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const driver = () =>
  (process.env.IMAGE_STORAGE || "db").toLowerCase() === "disk" ? "disk" : "db";

const carpeta = () =>
  path.resolve(
    process.env.IMAGE_STORAGE_DIR ||
      path.join(process.cwd(), "uploads", "images"),
  );

/** Formato real según los primeros bytes (no se confía en el nombre ni en el mimetype). */
export function detectarFormato(buf: Buffer): "png" | "jpeg" | null {
  if (
    buf.length > 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  )
    return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return "jpeg";
  return null;
}

export const rutaPublica = (id: string) => `${RUTA_PUBLICA}${id}`;
export const esRutaInterna = (valor: unknown): boolean =>
  typeof valor === "string" && RE_INTERNA.test(valor);

/** Comprime y redimensiona conservando el formato (PNG o JPEG). */
async function procesar(buf: Buffer) {
  const formato = detectarFormato(buf);
  if (!formato)
    throw new ImagenError(
      "Formato no permitido. Solo se aceptan imágenes PNG o JPEG.",
      415,
    );
  if (buf.length > MAX_BYTES_SUBIDA)
    throw new ImagenError("La imagen supera el tamaño máximo de 5 MB.", 413);
  try {
    const base = sharp(buf, { failOn: "error" })
      .rotate()
      .resize({
        width: MAX_LADO,
        height: MAX_LADO,
        fit: "inside",
        withoutEnlargement: true,
      });
    const salida =
      formato === "png"
        ? base.png({ compressionLevel: 9, adaptiveFiltering: true })
        : base.jpeg({ quality: 82, mozjpeg: true });
    const { data, info } = await salida.toBuffer({ resolveWithObject: true });
    return {
      datos: data,
      mime: `image/${formato}`,
      ext: formato === "png" ? "png" : "jpg",
      width: info.width,
      height: info.height,
    };
  } catch {
    throw new ImagenError(
      "El archivo está dañado o no es una imagen válida.",
      422,
    );
  }
}

/** Guarda una imagen y devuelve su registro. Si ya existía la misma imagen, la reutiliza. */
export async function guardarImagen(
  buf: Buffer,
  modulo: ModuloImagen,
  opciones: { subidoPor?: string; origen?: string } = {},
) {
  const img = await procesar(buf);
  const sha256 = crypto.createHash("sha256").update(img.datos).digest("hex");

  const existente = await prisma.imageFile.findUnique({
    where: { sha256 },
    select: { id: true, mime: true, bytes: true, width: true, height: true },
  });
  if (existente) return { ...existente, url: rutaPublica(existente.id) };

  const id = crypto.randomUUID();
  let ruta: string | null = null;
  if (driver() === "disk") {
    await fs.mkdir(carpeta(), { recursive: true });
    ruta = `${id}.${img.ext}`;
    await fs.writeFile(path.join(carpeta(), ruta), img.datos);
  }

  const creado = await prisma.imageFile.create({
    data: {
      id,
      sha256,
      mime: img.mime,
      bytes: img.datos.length,
      width: img.width,
      height: img.height,
      modulo,
      datos: ruta ? null : new Uint8Array(img.datos),
      ruta,
      origen: opciones.origen?.slice(0, 500) ?? null,
      subidoPor: opciones.subidoPor ?? null,
    },
    select: { id: true, mime: true, bytes: true, width: true, height: true },
  });
  return { ...creado, url: rutaPublica(creado.id) };
}

export async function leerImagen(id: string) {
  if (!new RegExp(`^${UUID}$`, "i").test(id)) return null;
  const img = await prisma.imageFile.findUnique({
    where: { id },
    select: { mime: true, sha256: true, datos: true, ruta: true },
  });
  if (!img) return null;
  let datos: Buffer | null = img.datos ? Buffer.from(img.datos) : null;
  if (!datos && img.ruta) {
    try {
      datos = await fs.readFile(path.join(carpeta(), path.basename(img.ruta)));
    } catch {
      datos = null;
    }
  }
  return datos ? { mime: img.mime, sha256: img.sha256, datos } : null;
}

// --- Importación desde URL externa (migración y compatibilidad) ---

const permitirPrivadas = () =>
  process.env.IMAGE_IMPORT_ALLOW_PRIVATE === "true";

function ipPrivada(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  if (v.startsWith("::ffff:")) return ipPrivada(v.slice(7));
  return (
    v === "::1" ||
    v === "::" ||
    v.startsWith("fc") ||
    v.startsWith("fd") ||
    v.startsWith("fe80")
  );
}

async function validarDestino(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new ImagenError(
      "Solo se pueden importar imágenes desde direcciones http o https.",
    );
  if (permitirPrivadas()) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const ips = net.isIP(host)
    ? [host]
    : (await dns.lookup(host, { all: true })).map((r) => r.address);
  if (ips.length === 0 || ips.some(ipPrivada))
    throw new ImagenError("La dirección de la imagen no está permitida.");
}

export async function importarDesdeUrl(
  url: string,
  modulo: ModuloImagen,
  subidoPor?: string,
) {
  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    throw new ImagenError("La dirección de la imagen no es válida.");
  }

  // Se siguen las redirecciones a mano para validar cada destino.
  let respuesta;
  for (let saltos = 0; ; saltos++) {
    await validarDestino(destino);
    try {
      respuesta = await axios.get<ArrayBuffer>(destino.toString(), {
        responseType: "arraybuffer",
        timeout: 10000,
        maxRedirects: 0,
        maxContentLength: MAX_BYTES_DESCARGA,
        validateStatus: (s) => s >= 200 && s < 400,
        headers: {
          Accept: "image/png,image/jpeg,image/*;q=0.8",
          "User-Agent": "TuCampus-Importador/1.0",
        },
      });
    } catch {
      throw new ImagenError("No se pudo descargar la imagen externa.", 502);
    }
    if (respuesta.status < 300) break;
    const siguiente = respuesta.headers.location;
    if (!siguiente || saltos >= 3)
      throw new ImagenError("No se pudo descargar la imagen externa.", 502);
    destino = new URL(siguiente, destino);
  }

  return guardarImagen(Buffer.from(respuesta.data), modulo, {
    subidoPor,
    origen: url,
  });
}

/**
 * Convierte el valor de imagen recibido en una ruta interna:
 *  - "/api/images/<id>" o una URL absoluta a una imagen propia: se conserva.
 *  - URL externa: se descarga y se guarda como archivo propio.
 *  - vacío: se devuelve "" (producto sin imagen).
 */
export async function normalizarImagen(
  valor: unknown,
  modulo: ModuloImagen,
  subidoPor?: string,
): Promise<string> {
  if (typeof valor !== "string" || !valor.trim()) return "";
  const v = valor.trim();
  if (esRutaInterna(v)) return v;
  const propia = v.match(RE_ID_EN_URL);
  if (
    propia &&
    (await prisma.imageFile.count({ where: { id: propia[1] } })) > 0
  )
    return rutaPublica(propia[1]);
  if (/^https?:\/\//i.test(v))
    return (await importarDesdeUrl(v, modulo, subidoPor)).url;
  throw new ImagenError("La imagen debe subirse como archivo PNG o JPEG.");
}

// --- Migración de imágenes existentes (URL externa -> archivo propio) ---

export type ResultadoMigracion = {
  revisadas: number;
  migradas: number;
  fallidas: { id: string; nombre: string; url: string; error: string }[];
};

const esExterna = (u: string) =>
  /^https?:\/\//i.test(u) && !RE_ID_EN_URL.test(u);

export async function migrarImagenesProductos(
  subidoPor?: string,
): Promise<ResultadoMigracion> {
  const productos = await prisma.product.findMany({
    where: { imagenUrl: { startsWith: "http" } },
    select: { id: true, nombre: true, imagenUrl: true },
  });
  const res: ResultadoMigracion = { revisadas: 0, migradas: 0, fallidas: [] };
  for (const p of productos) {
    if (!esExterna(p.imagenUrl)) continue;
    res.revisadas++;
    try {
      const nueva = await normalizarImagen(p.imagenUrl, "producto", subidoPor);
      await prisma.$transaction([
        prisma.product.update({
          where: { id: p.id },
          data: { imagenUrl: nueva },
        }),
        prisma.recommendation.updateMany({
          where: { producto_base_id: p.id },
          data: { imagenUrl: nueva },
        }),
      ]);
      res.migradas++;
    } catch (e: any) {
      res.fallidas.push({
        id: p.id,
        nombre: p.nombre,
        url: p.imagenUrl,
        error: e.message,
      });
    }
  }
  return res;
}

export async function migrarImagenesMarketplace(
  subidoPor?: string,
): Promise<ResultadoMigracion> {
  const items = await prisma.market.findMany({
    select: { id: true, titulo: true, imagenes: true },
  });
  const res: ResultadoMigracion = { revisadas: 0, migradas: 0, fallidas: [] };
  for (const item of items) {
    if (!item.imagenes.some(esExterna)) continue;
    res.revisadas++;
    const nuevas: string[] = [];
    let error: { url: string; mensaje: string } | null = null;
    for (const url of item.imagenes) {
      if (!esExterna(url)) {
        nuevas.push(url);
        continue;
      }
      try {
        nuevas.push(await normalizarImagen(url, "marketplace", subidoPor));
      } catch (e: any) {
        // Se conserva la original para no perder la referencia; queda reportada.
        nuevas.push(url);
        error = error ?? { url, mensaje: e.message };
      }
    }
    await prisma.market.update({
      where: { id: item.id },
      data: { imagenes: nuevas },
    });
    if (error)
      res.fallidas.push({
        id: item.id,
        nombre: item.titulo,
        url: error.url,
        error: error.mensaje,
      });
    else res.migradas++;
  }
  return res;
}
