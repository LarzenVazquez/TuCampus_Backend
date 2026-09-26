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

## Scripts

| Script                      | Qué hace                                  |
| --------------------------- | ----------------------------------------- |
| `npm run dev` / `npm start` | Levanta el servidor                       |
| `npm test`                  | Pruebas (Prisma simulado, no requiere BD) |
| `npm run test:kds`          | Pruebas del modelo de saturación del KDS  |
| `npm run typecheck`         | Chequeo de tipos de TypeScript            |
| `npm run seed`              | Datos de ejemplo                          |

Consulta **`CAMBIOS.md`** para el detalle de lo que se corrigió y del
contrato de la API que usan los frontends.
