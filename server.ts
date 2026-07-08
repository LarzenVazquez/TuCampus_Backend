import http from "http";
import { Server, Socket } from "socket.io";
import os from "os";
import cron from "node-cron";
import dotenv from "dotenv";
import app from "./app";
// Solo importamos la lógica necesaria, sin conexiones antiguas
import { train } from "./src/api/controllers/iaController";

dotenv.config();

app.set("trust proxy", 1);
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.set("io", io);

// --- LÓGICA DE SALAS POR USUARIO (necesaria para el tracker en tiempo real) ---
// El frontend (loader.js) emite "join_user_room" con el id del usuario logueado
// al conectarse. Antes, el backend nunca escuchaba este evento, por lo que
// ningún emit dirigido a un usuario específico (io.to(userId).emit(...))
// llegaba a nadie. Aquí se registra esa sala.
io.on("connection", (socket: Socket) => {
  socket.on("join_user_room", (userId: string) => {
    if (typeof userId === "string" && userId.length > 0) {
      socket.join(userId);
    }
  });

  socket.on("disconnect", () => {
    // No se requiere limpieza manual: socket.io libera las salas automáticamente.
  });
});

// ... (tu función getLocalIp y lógica de sockets igual)

async function initialize(): Promise<void> {
  try {
    // Ya no inicializamos dbSql ni dbNoSql.
    // Prisma gestiona la conexión de forma automática al hacer la primera query.
    console.log("Servidor: Conectando a servicios...");

    const PORT = process.env.PORT || 3000;

    server.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Server corriendo en puerto ${PORT}`);
      console.log("WebSockets: Activo");
    });

    // IA: Ejecución programada usando el contexto del ORM
    cron.schedule("0 * * * *", async () => {
      console.log("IA: Iniciando entrenamiento programado");
      try {
        await train(
          {} as any,
          { status: () => ({ json: () => {} }), json: () => {} } as any,
        );
      } catch (err: any) {
        console.error("IA Cron Error:", err.message);
      }
    });

    console.log("IA: Ejecutando entrenamiento inicial...");
    await train(
      {} as any,
      { status: () => ({ json: () => {} }), json: () => {} } as any,
    );
  } catch (error: any) {
    console.error("Fatal Error al iniciar:", error.message);
    process.exit(1);
  }
}

initialize();
