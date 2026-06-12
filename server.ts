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
