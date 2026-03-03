const QRCode = require("qrcode");

class QrService {
  // Genera el QR en formato Base64 para que el Frontend lo muestre fácil
  static async generateOrderQR(orderId) {
    try {
      // Creamos un string que el escáner de la cafetería leerá
      const qrData = JSON.stringify({
        tipo: "pedido_campus",
        id: orderId,
        fecha: new Date(),
      });

      const qrImage = await QRCode.toDataURL(qrData);
      return qrImage;
    } catch (error) {
      throw new Error("Error al generar el código QR");
    }
  }
}

module.exports = QrService;
