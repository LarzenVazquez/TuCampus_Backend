const db = require("../../../config/dbSql");

class User {
  /* buscar usuario por email para validacion middleware */
  static async findByEmail(email) {
    const [rows] = await db.execute("SELECT * FROM usuarios WHERE email = ?", [
      email,
    ]);
    return rows[0];
  }

  /* crear nuevo usuario */
  static async create({ nombre, email, password, rol_id }) {
    const [result] = await db.execute(
      "INSERT INTO usuarios (nombre, email, password, rol_id) VALUES (?, ?, ?, ?)",
      [nombre, email, password, rol_id || 2] /* estudiante usuario */,
    );
    return result.insertId;
  }

  // Obtener perfil por ID (para el middleware de auth)
  static async findById(id) {
    const [rows] = await db.execute(
      "SELECT id_usuario, nombre, email, rol_id, fecha_registro FROM usuarios WHERE id_usuario = ?",
      [id],
    );
    return rows[0];
  }

  static async updateProfile(id, { nombre, email }) {
    await db.execute(
      "UPDATE usuarios SET nombre = ?, email = ? WHERE id_usuario = ?",
      [nombre, email, id],
    );
  }
}

module.exports = User;
