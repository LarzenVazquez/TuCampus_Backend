import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;

// CORRECCIÓN L6: Simplificado con optional chaining
if (apiKey?.startsWith("SG.")) {
  sgMail.setApiKey(apiKey);
} else {
  console.warn(
    "ADVERTENCIA: SendGrid no configurado. Los correos no se enviarán.",
  );
}

export const sendEmail = async (to: string, subject: string, html: string) => {
  // CORRECCIÓN L15: Simplificado con optional chaining
  if (!apiKey?.startsWith("SG.")) {
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
