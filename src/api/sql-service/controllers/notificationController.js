const Notification = require("../models/notificationModel");

exports.getMisNotificaciones = async (req, res) => {
  try {
    const notifs = await Notification.getByUserId(req.user.id);
    res.json(notifs);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener notificaciones" });
  }
};

exports.marcarLeidas = async (req, res) => {
  try {
    await Notification.markAllAsRead(req.user.id);
    res.json({ message: "Notificaciones actualizadas" });
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar notificaciones" });
  }
};