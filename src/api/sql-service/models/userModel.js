const db = require("../../../config/dbSql");
const Activity = require("../models/activityModel");

const adminController = {
  // Obtener lista de usuarios para el dashboard
  getUsers: async (req, res) => {
    try {
      const [users] = await db.execute(
        "SELECT id, nombre, email, rol, es_vendedor_verificado, created_at FROM users",
      );
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener lista" });
    }
  },

  verifySeller: async (req, res) => {
    try {
      const { id } = req.params;
      const { verificado } = req.body;
      const rol = verificado ? "vendedor" : "comprador";

      await db.execute(
        "UPDATE users SET es_vendedor_verificado = ?, rol = ? WHERE id = ?",
        [verificado ? 1 : 0, rol, id],
      );

      await Activity.create(
        req.user.id,
        "VERIFICACION",
        `Usuario ${id} actualizado a ${rol}`,
        req.ip,
      );

      res.json({ message: "Estatus actualizado correctamente" });
    } catch (error) {
      res.status(500).json({ message: "Error al verificar" });
    }
  },

  getLogs: async (req, res) => {
    try {
      const [logs] = await db.execute(
        "SELECT a.*, u.nombre FROM activity_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY fecha DESC",
      );
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener logs" });
    }
  },
};

module.exports = adminController;
