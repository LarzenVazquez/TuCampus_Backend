const db = require("../../../config/dbSql");

/* modelo para gestionar usuarios en la base de datos */
const user = {
  /* buscar por medio del email */
  findbyemail: async (email) => {
    const [rows] = await db.execute("select * from users where email = ?", [
      email,
    ]);
    return rows[0];
  },

  /* registro con sha bycript */
  create: async (userdata) => {
    const { nombre, email, password, matricula, rol } = userdata;
    const [result] = await db.execute(
      "insert into users (nombre, email, password, matricula, rol) values (?, ?, ?, ?, ?)",
      [nombre, email, password, matricula, rol || "comprador"],
    );
    return result.insertid;
  },

  /* crear sesion en tabla sessions */
  createsession: async (userid, token, expiresat) => {
    await db.execute(
      "insert into sessions (user_id, token, expira_en) values (?, ?, ?)",
      [userid, token, expiresat],
    );
  },

  /* eliminar sesion por token */
  deletesession: async (token) => {
    await db.execute("delete from sessions where token = ?", [token]);
  },

  /* registro de hash para integridad */
  registerfilehash: async (userid, filename, path, hash) => {
    return await db.execute(
      "insert into user_files (user_id, nombre_archivo, url_archivo, file_hash, tipo_archivo) values (?, ?, ?, ?, ?)",
      [userid, filename, path, hash, "perfil"],
    );
  },
};

module.exports = user;
