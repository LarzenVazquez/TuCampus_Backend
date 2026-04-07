const app = require("./app");
const os = require("os");
const cron = require("node-cron");
const dbSql = require("./src/config/dbSql");
const dbNoSql = require("./src/config/dbNoSql");
const { train } = require("./src/api/nsql-service/controllers/iaController");
require("dotenv").config();

app.set("trust proxy", 1);

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

    // 3. Inicio de servidor
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server: http://localhost:${PORT}/api`);
      console.log(`Network: http://${localIp}:${PORT}/api`);
    });

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
