-- Teléfono opcional en el perfil (lo envían los formularios de
-- "Datos personales" de ambos frontends; antes se descartaba).
ALTER TABLE "auth"."User" ADD COLUMN IF NOT EXISTS "telefono" TEXT;

-- Mensajes del formulario público de contacto.
CREATE TABLE IF NOT EXISTS "business"."ContactoMensaje" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "asunto" TEXT,
    "mensaje" TEXT NOT NULL,
    "respondido" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactoMensaje_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ContactoMensaje_respondido_created_at_idx"
    ON "business"."ContactoMensaje"("respondido", "created_at");
