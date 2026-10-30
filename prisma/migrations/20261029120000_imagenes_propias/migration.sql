-- RNF-15 / RNF-16: imágenes propias del sistema (PNG/JPEG).
CREATE TABLE IF NOT EXISTS "business"."ImageFile" (
    "id" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "modulo" TEXT NOT NULL,
    "datos" BYTEA,
    "ruta" TEXT,
    "origen" TEXT,
    "subidoPor" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImageFile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ImageFile_sha256_key" ON "business"."ImageFile"("sha256");
CREATE INDEX IF NOT EXISTS "ImageFile_modulo_idx" ON "business"."ImageFile"("modulo");
