import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;

// Inicializamos solo si la key existe y es válida
if (apiKey && apiKey.startsWith("SG.")) {
  sgMail.setApiKey(apiKey);
} else {
  console.warn(
    "ADVERTENCIA: SendGrid no configurado. Los correos no se enviarán.",
  );
}

// AQUÍ ESTABA EL ERROR: Agrega 'export'
export const sendEmail = async (to: string, subject: string, html: string) => {
  if (!apiKey || !apiKey.startsWith("SG.")) {
    console.log(`Simulando envío de correo a ${to}: ${subject}`);
    return;
  }
  return await sgMail.send({
    to,
    from: "tucampus.uteq@gmail.com",
    subject,
    html,
  });
};
