import http from "http";
import { Server, Socket } from "socket.io";
import cron from "node-cron";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import app from "./app";
import { train } from "./src/api/controllers/iaController";
import { evaluarSaturacionKDS } from "./src/services/kdsSaturationService";
import { corsOriginCallback } from "./src/lib/appConfig";

dotenv.config();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOriginCallback,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.set("io", io);

const usuarioDelHandshake = (
  socket: Socket,
): { id: string; rol: string } | null => {
  const raw =
    (socket.handshake.auth as any)?.token ||
    (socket.handshake.headers.authorization || "").toString().split(" ")[1];
  if (!raw || !process.env.JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(raw, process.env.JWT_SECRET) as {
      id: string;
      rol: string;
    };
    return decoded?.id ? decoded : null;
  } catch {
    return null;
  }
};

io.on("connection", (socket: Socket) => {
  const autenticado = usuarioDelHandshake(socket);
  if (autenticado) {
    socket.join(autenticado.id);
    if (autenticado.rol === "A_C" || autenticado.rol === "A")
      socket.join("staff");
    if (autenticado.rol === "A") socket.join("admin");
  }

  socket.on("join_user_room", (userId: string) => {
    if (typeof userId !== "string" || userId.length === 0 || userId.length > 64)
      return;
    if (autenticado && autenticado.id !== userId) return;
    socket.join(userId);
  });
});

const tareaEntrenarIA = async () => {
  await train(
    {} as any,
    { status: () => ({ json: () => {} }), json: () => {} } as any,
  );
};

async function initialize(): Promise<void> {
  const PORT = process.env.PORT || 3000;

  server.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server corriendo en puerto ${PORT}`);
    console.log("WebSockets: Activo");
  });

  cron.schedule("0 * * * *", async () => {
    console.log("IA: Iniciando entrenamiento programado");
    try {
      await tareaEntrenarIA();
    } catch (err: any) {
      console.error("IA Cron Error:", err.message);
    }
  });

  cron.schedule("* * * * *", async () => {
    try {
      await evaluarSaturacionKDS(io);
    } catch (err: any) {
      console.error("KDS Saturación Cron Error:", err.message);
    }
  });

  try {
    console.log("IA: Ejecutando entrenamiento inicial...");
    await tareaEntrenarIA();
  } catch (err: any) {
    console.error("IA: entrenamiento inicial falló:", err.message);
  }

  try {
    await evaluarSaturacionKDS(io);
    console.log("KDS: Monitor de saturación activo");
  } catch (err: any) {
    console.error("KDS: cálculo inicial falló:", err.message);
  }
}

initialize();
