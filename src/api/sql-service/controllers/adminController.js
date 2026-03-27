const db = require("../../../config/dbSql");
const Activity = require("../models/activityModel");

const adminController = {
  // 1. Obtener usuarios con la columna correcta
  getUsers: async (req, res) => {
    try {
      const [users] = await db.execute(`
        SELECT id, nombre, email, matricula, rol, vendedor_verificado, created_at,
        (SELECT COUNT(*) FROM user_files WHERE user_id = users.id) as total_archivos
        FROM users
        ORDER BY created_at DESC
      `);
      res.json(users);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error al obtener lista de usuarios" });
    }
  },

  // 2. Actualizar estatus usando los nuevos ENUM (A, A_C, Al, A_V)
  updateUserStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { rol, verificado } = req.body; // verificado debe ser true/false

      // Validamos que el rol sea uno de los permitidos por el ENUM
      const rolesPermitidos = ["A", "A_C", "Al", "A_V"];
      if (!rolesPermitidos.includes(rol)) {
        return res.status(400).json({ message: "Rol no válido" });
      }

      await db.execute(
        "UPDATE users SET rol = ?, vendedor_verificado = ? WHERE id = ?",
        [rol, verificado ? 1 : 0, id],
      );

      await Activity.create(
        req.user.id,
        "ADMIN_UPDATE",
        `Update User ${id}: Rol=${rol}, Verif=${verificado}`,
        req.ip,
      );

      res.json({ message: "Usuario actualizado exitosamente" });
    } catch (error) {
      res.status(500).json({ message: "Error al actualizar usuario" });
    }
  },

  // 3. Verificar Vendedor y cambiar rol a A_V automáticamente
  verifySeller: async (req, res) => {
    try {
      const { id } = req.params;

      // Al verificar, lo promovemos a Alumno Vendedor (A_V)
      await db.execute(
        "UPDATE users SET vendedor_verificado = 1, rol = 'A_V' WHERE id = ?",
        [id],
      );

      await Activity.create(
        req.user.id,
        "ADMIN_VERIFY",
        `Vendedor verificado ID: ${id}. Rol cambiado a A_V`,
        req.ip,
      );

      res.json({ message: "Vendedor verificado y rol actualizado a A_V" });
    } catch (error) {
      res.status(500).json({ message: "Error al verificar vendedor" });
    }
  },

  // 4. Logs y Delete (Se mantienen igual, solo corregimos consistencia)
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
