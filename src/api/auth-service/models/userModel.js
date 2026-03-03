const db = require("../../../config/dbSql");

class User {
  /* buscar usuario por email */
  static async findByEmail(email) {
    // Cambiado: tabla 'users' y columna 'email'
    const [rows] = await db.execute("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    return rows[0];
  }

  /* crear nuevo usuario */
  static async create({ nombre, email, password, rol }) {
    // Cambiado: tabla 'users', columna 'password_hash' y 'rol'
    const [result] = await db.execute(
      "INSERT INTO users (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)",
      [nombre, email, password, rol || "comprador"],
    );
    return result.insertId;
  }

  /* Obtener perfil por ID */
  static async findById(id) {
    // Cambiado: columna 'id' y tabla 'users'
    const [rows] = await db.execute(
      "SELECT id, nombre, email, rol, created_at FROM users WHERE id = ?",
      [id],
    );
    return rows[0];
  }

  /* Actualizar perfil */
  static async updateProfile(id, { nombre, email }) {
    // Cambiado: columna 'id'
    await db.execute("UPDATE users SET nombre = ?, email = ? WHERE id = ?", [
      nombre,
      email,
      id,
    ]);
  }
}

module.exports = User;
