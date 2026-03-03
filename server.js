const app = require("./app");
const os = require("os");
const dbSql = require("./src/config/dbSql");
const dbNoSql = require("./src/config/dbNoSql");
require("dotenv").config();

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
    // Verificación de conexión MySQL
    const connection = await dbSql.getConnection();
    console.log("MySQL: Conectado");
    connection.release();

    // Verificación de conexión MongoDB
    await dbNoSql();
    console.log("MongoDB: Conectado");

    const PORT = process.env.PORT || 3000;
    const localIp = getLocalIp();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor corriendo en: http://${localIp}:${PORT}/api`);
    });
  } catch (error) {
    console.error("Error en la inicializacion:", error.message);
    process.exit(1);
  }
}

initialize();
