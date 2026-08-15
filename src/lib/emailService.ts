import nodemailer from "nodemailer";

const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

const isConfigured = Boolean(gmailUser && gmailAppPassword);

const transporter = isConfigured
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
      },
    })
  : null;

if (!isConfigured) {
  console.warn(
    "ADVERTENCIA: Gmail SMTP no configurado (faltan GMAIL_USER / GMAIL_APP_PASSWORD). Los correos no se enviarán.",
  );
}

export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!transporter) {
    console.log(`Simulando envío de correo a ${to}: ${subject}`);
    return;
  }
  return await transporter.sendMail({
    from: `"TuCampus" <${gmailUser}>`,
    to,
    subject,
    html,
  });
};
