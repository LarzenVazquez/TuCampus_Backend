const db = require("../../../config/dbSql");
const Activity = require("../models/activityModel");

const adminController = {
  getUsers: async (req, res) => {
    try {
      const [users] = await db.execute(`
        SELECT id, nombre, email, matricula, rol, es_vendedor_verificado, created_at,
        (SELECT COUNT(*) FROM user_files WHERE user_id = users.id) as total_archivos
        FROM users
      `);
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener lista de usuarios" });
    }
  },

  updateUserStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { rol, verificado } = req.body;

      await db.execute(
        "UPDATE users SET rol = ?, es_vendedor_verificado = ? WHERE id = ?",
        [rol, verificado ? 1 : 0, id],
      );

      await Activity.create(
        req.user.id,
        "ADMIN_UPDATE",
        `Se actualizó al usuario ${id}: Rol=${rol}, Verificado=${verificado}`,
        req.ip,
      );

      res.json({ message: "Usuario actualizado exitosamente" });
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar usuario" });
    }
  },

  getLogs: async (req, res) => {
    try {
      const [logs] = await db.execute(
        "SELECT a.*, u.nombre as admin_name FROM activity_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.fecha DESC",
      );
      res.json(logs);
    } catch (error) {
      res.status(500).json({ message: "Error al obtener logs" });
    }
  },

  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;
      await db.execute("DELETE FROM users WHERE id = ?", [id]);
      await Activity.create(
        req.user.id,
        "ADMIN_DELETE",
        `Eliminó al usuario ID: ${id}`,
        req.ip,
      );
      res.json({ message: "Usuario eliminado del sistema" });
    } catch (error) {
      res.status(500).json({ message: "Error al eliminar usuario" });
    }
  },
};

module.exports = adminController;
