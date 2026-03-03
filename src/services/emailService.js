const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendOrderConfirmation(email, orderDetails) {
    try {
      const mailOptions = {
        from: `"TuCampus Cafetería" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Confirmación de Pedido #${orderDetails._id}`,
        html: `
          <h1>¡Gracias por tu compra!</h1>
          <p>Tu pedido está siendo preparado.</p>
          <p><strong>Total:</strong> $${orderDetails.total}</p>
          <p><strong>Método de pago:</strong> ${orderDetails.metodo_pago}</p>
          <br>
          <p>Presenta tu código QR en la barra para recogerlo.</p>
        `,
      };

      await this.transporter.sendMail(mailOptions);
      console.log("Correo enviado a:", email);
    } catch (error) {
      console.error("Error enviando correo:", error);
    }
  }
  /*   async sendPasswordReset(email, resetToken) {
    try {
      // La URL de tu frontend donde el usuario pondrá la nueva clave
      const resetUrl = `http://localhost:3000/reset-password?token=${resetToken}`;

      const mailOptions = {
        from: `"TuCampus Seguridad" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Recuperación de Contraseña",
        html: `
        <h1>Restablecer tu contraseña</h1>
        <p>Has solicitado cambiar tu contraseña. Haz clic en el siguiente enlace para continuar:</p>
        <a href="${resetUrl}" style="padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px;">
          Restablecer Contraseña
        </a>
        <p>Este enlace expirará en 1 hora.</p>
        <p>Si no solicitaste este cambio, ignora este correo.</p>
      `,
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error("Error enviando correo de recuperación:", error);
    }
  } */
}

module.exports = new EmailService();
