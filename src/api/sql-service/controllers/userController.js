const UserFile = require("../models/fileModel");
const Activity = require("../models/activityModel");

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
