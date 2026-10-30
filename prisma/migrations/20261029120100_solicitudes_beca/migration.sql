-- RQF24: solicitudes de beca alimenticia.
CREATE TABLE IF NOT EXISTS "business"."SolicitudBeca" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "matricula" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "estatus" TEXT NOT NULL DEFAULT 'Pendiente',
    "comentario" TEXT,
    "revisadoPor" TEXT,
    "fecha_revision" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SolicitudBeca_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SolicitudBeca_userId_estatus_idx" ON "business"."SolicitudBeca"("userId", "estatus");
CREATE INDEX IF NOT EXISTS "SolicitudBeca_estatus_created_at_idx" ON "business"."SolicitudBeca"("estatus", "created_at");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SolicitudBeca_userId_fkey') THEN
    ALTER TABLE "business"."SolicitudBeca"
      ADD CONSTRAINT "SolicitudBeca_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "auth"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
