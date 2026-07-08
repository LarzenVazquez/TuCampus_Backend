-- Módulo de Becas: permite marcar usuarios beneficiarios de beca alimenticia
ALTER TABLE "User" ADD COLUMN "es_becado" BOOLEAN NOT NULL DEFAULT false;

-- Tracker en tiempo real: tiempo estimado de preparación por producto (minutos)
ALTER TABLE "Product" ADD COLUMN "tiempoPrepMin" INTEGER NOT NULL DEFAULT 8;

-- Módulo de Becas: marca qué producto(s) forman el "menú del día" que la
-- cocina designa como elegible para beca. Un alumno becado SOLO puede
-- reclamar productos marcados aquí, nunca el catálogo completo.
ALTER TABLE "Product" ADD COLUMN "esMenuBeca" BOOLEAN NOT NULL DEFAULT false;

-- Tracker en tiempo real: tipo de orden (Normal | Beca) y marcas de tiempo del ciclo de vida
ALTER TABLE "Order" ADD COLUMN "tipo" TEXT NOT NULL DEFAULT 'Normal';
ALTER TABLE "Order" ADD COLUMN "tiempoEstimadoMin" INTEGER;
ALTER TABLE "Order" ADD COLUMN "fechaListo" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "fechaEntregado" TIMESTAMP(3);
