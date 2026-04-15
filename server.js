//server.js
const app = require("./app");
const http = require("http");
const { Server } = require("socket.io");
const os = require("os");
const cron = require("node-cron");
const dbSql = require("./src/config/dbSql");
const dbNoSql = require("./src/config/dbNoSql");
const { train } = require("./src/api/nsql-service/controllers/iaController");
require("dotenv").config();

app.set("trust proxy", 1);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

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

io.on("connection", (socket) => {
  console.log("Socket: Usuario conectado", socket.id);

  socket.on("join_user_room", (userId) => {
    if (!userId) {
      console.warn("Socket: Un usuario intentó unirse sin un ID válido.");
      return;
    }
    socket.join(userId.toString());
    console.log(`Notificaciones: Usuario ${userId} unido a su sala privada`);
  });

  socket.on("join_chat", (chatId) => {
    socket.join(chatId);
    console.log(`Chat: Usuario unido a sala ${chatId}`);
  });

  socket.on("send_message", (data) => {
    io.to(data.chatId).emit("receive_message", data);
  });

  socket.on("disconnect", () => {
    console.log("Socket: Usuario desconectado");
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

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server: http://localhost:${PORT}/api`);
      console.log(`Network: http://${localIp}:${PORT}/api`);
      console.log("WebSockets: Activo");
    });

    cron.schedule("0 * * * *", async () => {
      console.log("IA: Iniciando entrenamiento programado");
      const fakeReq = { cron: true };
      const fakeRes = {
        status: function () {
          return this;
        },
        json: function () {
          console.log("IA: Entrenamiento de hora completado");
          return this;
        },
      };

      try {
        await train(fakeReq, fakeRes);
      } catch (err) {
        console.error("IA Cron Error:", err.message);
      }
    });

    console.log("IA: Ejecutando entrenamiento de arranque...");
    await train(
      { cron: true },
      { status: () => ({ json: () => {} }), json: () => {} },
    );
  } catch (error) {
    console.error("Fatal Error:", error.message);
    process.exit(1);
  }
}

initialize();
