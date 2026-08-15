import axios from "axios";

const brevoApiKey = process.env.BREVO_API_KEY;
const senderEmail = process.env.BREVO_SENDER_EMAIL || "tucampus.uteq@gmail.com";

const isConfigured = Boolean(brevoApiKey);

if (!isConfigured) {
  console.warn(
    "ADVERTENCIA: Brevo no configurado (falta BREVO_API_KEY). Los correos no se enviarán.",
  );
}

export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!isConfigured) {
    console.log(`Simulando envío de correo a ${to}: ${subject}`);
    return;
  }
  return await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: { email: senderEmail, name: "TuCampus" },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    },
    {
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
  );
};