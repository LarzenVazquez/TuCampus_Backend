const app = require("./app");
const http = require("http"); // Requerido para Socket.io
const { Server } = require("socket.io"); // La librería que instalaste
const os = require("os");
const cron = require("node-cron");
const dbSql = require("./src/config/dbSql");
const dbNoSql = require("./src/config/dbNoSql");
const { train } = require("./src/api/nsql-service/controllers/iaController");
require("dotenv").config();

app.set("trust proxy", 1);

// Crear el servidor HTTP usando la app de Express
const server = http.createServer(app);

// Inicializar Socket.io con CORS (importante para que el front se conecte)
const io = new Server(server, {
  cors: {
    origin: "*", // En producción cambia esto por tu dominio
    methods: ["GET", "POST"],
  },
});

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const ifaceList of Object.values(interfaces)) {
    for (const iface of ifaceList) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

// --- LÓGICA DE SOCKETS PARA EL CHAT ---
io.on("connection", (socket) => {
  console.log("Chat: Usuario conectado", socket.id);

  // Unirse a una sala privada (Chat ID de MongoDB)
  socket.on("join_chat", (chatId) => {
    socket.join(chatId);
    console.log(`Chat: Usuario unido a sala ${chatId}`);
  });

  // Escuchar cuando alguien envía un mensaje
  socket.on("send_message", (data) => {
    // Reenviar el mensaje a todos en la sala (incluyendo al vendedor/comprador)
    io.to(data.chatId).emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("Chat: Usuario desconectado");
  });
});

async function initialize() {
  try {
    // 1. Conexion MySQL
    const connection = await dbSql.getConnection();
    console.log("MySQL: OK");
    connection.release();

    // 2. Conexion MongoDB
    await dbNoSql();
    console.log("MongoDB: OK");

    const PORT = process.env.PORT || 3000;
    const localIp = getLocalIp();

    // 3. Inicio de servidor (USAMOS 'server.listen' en lugar de 'app.listen')
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server: http://localhost:${PORT}/api`);
      console.log(`Network: http://${localIp}:${PORT}/api`);
      console.log("WebSockets: Activo");
    });

    // Cron Job para IA
    cron.schedule("0 * * * *", async () => {
      console.log("IA: Iniciando entrenamiento programado");
      const fakeReq = {};
      const fakeRes = {
        json: () => console.log("IA: Ranking actualizado"),
        status: () => ({ json: () => {} }),
      };

      try {
        await train(fakeReq, fakeRes);
      } catch (err) {
        console.error("IA Error:", err.message);
      }
    });
  } catch (error) {
    console.error("Fatal Error:", error.message);
    process.exit(1);
  }
}

initialize();
