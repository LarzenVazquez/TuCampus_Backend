const UserFile = require("../models/fileModel");
const Activity = require("../models/activityModel");
const db = require("../../../config/dbSql");

exports.getProfileFiles = async (req, res) => {
  try {
    const files = await UserFile.getAllByUserId(req.user.id);
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener archivos" });
  }
};

exports.uploadProfilePic = async (req, res) => {
  const { fileName, url, hash } = req.fileData;

  await UserFile.create(req.user.id, fileName, url, hash, "perfil");
  await Activity.create(
    req.user.id,
    "UPDATE_PROFILE",
    "Actualización de foto de perfil",
    req.ip,
  );

  res.json({ message: "Foto actualizada y registrada en SQL" });
};

// Actualizar perfil del usuario
exports.updateProfile = async (req, res) => {
  try {
    // El ID viene del token de la sesión (verifyToken)
    const userId = req.user.id;
    const { nombre, telefono } = req.body;

    // Actualizamos en MySQL
    await db.query("UPDATE users SET nombre = ?, telefono = ? WHERE id = ?", [
      nombre,
      telefono,
      userId,
    ]);

    res.status(200).json({ message: "Perfil actualizado correctamente" });
  } catch (error) {
    console.error("Error al actualizar perfil:", error);
    res.status(500).json({ message: "Error al guardar los cambios" });
  }
};
