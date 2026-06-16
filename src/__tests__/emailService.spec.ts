import { sendEmail } from "../lib/emailService";
import sgMail from "@sendgrid/mail";

jest.mock("@sendgrid/mail");

describe("Email Service", () => {
  it("debería imprimir log cuando no hay API Key configurada", async () => {
    const consoleSpy = jest.spyOn(console, "log");
    await sendEmail("test@test.com", "Asunto", "Contenido");

    expect(sgMail.send).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
it("debería ejecutar el envío real cuando la API Key es válida", async () => {
  process.env.SENDGRID_API_KEY = "SG.mi_clave_valida";

  // Forzamos el reset
  jest.resetModules();

  // Re-importamos el módulo ahora que el env está configurado
  const { sendEmail } = require("../lib/emailService");
  const sgMail = require("@sendgrid/mail"); // Importamos el mock

  // Ejecutamos
  await sendEmail("test@test.com", "Asunto", "Contenido");

  // Verificamos
  expect(sgMail.send).toHaveBeenCalledTimes(1);
});
