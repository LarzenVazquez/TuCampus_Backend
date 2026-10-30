# TuCampus — Backend

API REST + WebSockets de TuCampus (Express 5, Prisma 7 / PostgreSQL, Socket.IO).
Un solo backend atiende a **los dos frontends**:

| Frontend                     | Carpeta             | Dev                     |
| ---------------------------- | ------------------- | ----------------------- |
| Vite (multipágina, original) | `TuCampus_Frontend` | `http://localhost:5173` |
| Angular (SPA/SSR, nuevo)     | `TuCampus_Front_A`  | `http://localhost:4200` |

## Roles

| Sigla | Rol                                                     |
| ----- | ------------------------------------------------------- |
| `A`   | Administrador General (control total)                   |
| `A_C` | Admin de Cafetería (inventario, KDS, pedidos)           |
| `Al`  | Alumno (usuario base)                                   |
| `A_V` | Alumno Vendedor (verificado para vender en Marketplace) |

## Puesta en marcha

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

### Migración nueva (contacto + teléfono)

Esta versión agrega la tabla `business.ContactoMensaje` y la columna
opcional `auth.User.telefono`. El SQL es idempotente (`IF NOT EXISTS`), así
que se puede aplicar sin riesgo sobre la base existente:

```bash
psql "$DATABASE_URL" -f prisma/migrations/20260926120000_add_contacto_y_telefono/migration.sql
```

(o `npx prisma migrate deploy` si tu historial de migraciones está al día).

### Migración nueva (imágenes propias, RNF-15/16)

Agrega la tabla `business.ImageFile`. Es idempotente:

```bash
psql "$DATABASE_URL" -f prisma/migrations/20261029120000_imagenes_propias/migration.sql
```

Después de desplegar, pasa las imágenes que todavía son URLs externas a
archivos propios. Puedes hacerlo con el botón «Migrar imágenes» del panel
(cocina para el menú, administrador para el marketplace) o desde la terminal:

```bash
npm run migrar:imagenes
```

Las que no se puedan descargar conservan su URL y aparecen en el reporte.

### Variables de entorno nuevas

| Variable                     | Valor recomendado                           | Uso                                                                 |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------- |
| `IMAGE_STORAGE`              | `db`                                        | `db` guarda las imágenes en PostgreSQL (Render gratis borra el disco). `disk` las guarda en carpeta |
| `IMAGE_STORAGE_DIR`          | `uploads/images`                            | Carpeta usada solo con `IMAGE_STORAGE=disk`                         |
| `PUBLIC_API_URL`             | `https://tucampus-backend.onrender.com`     | Base para las URLs absolutas de `/api/images/:id`                   |
| `IMAGE_IMPORT_ALLOW_PRIVATE` | sin definir                                 | Solo pruebas locales; en producción debe quedar vacía               |

## Scripts

| Script                      | Qué hace                                  |
| --------------------------- | ----------------------------------------- |
| `npm run dev` / `npm start` | Levanta el servidor                       |
| `npm test`                  | Pruebas (Prisma simulado, no requiere BD) |
| `npm run test:kds`          | Pruebas del modelo de saturación del KDS  |
| `npm run typecheck`         | Chequeo de tipos de TypeScript            |
| `npm run seed`              | Datos de ejemplo                          |
| `npm run migrar:imagenes`   | Convierte URLs externas en archivos propios |

Consulta **`CAMBIOS.md`** para el detalle de lo que se corrigió y del
contrato de la API que usan los frontends.
