import forge from "node-forge";

// Generación de par de llaves RSA al arrancar el servidor
const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(2048);

const publicKeyPem: string = forge.pki.publicKeyToPem(publicKey);
const privateKeyPem: string = forge.pki.privateKeyToPem(privateKey);

/**
 * Obtiene la llave pública en formato PEM
 */
export const getpublickey = (): string => {
  return publicKeyPem;
};

/**
 * Descifra la llave AES (o cualquier dato) cifrada previamente con la pública RSA
 * @param encryptedData64 String en Base64 proveniente del cliente
 */
export const decryptrsa = (encryptedData64: string): string => {
  try {
    const privateKeyObj = forge.pki.privateKeyFromPem(privateKeyPem);

    // Decodificar Base64 del cliente
    const encryptedBytes = forge.util.decode64(encryptedData64);

    // Descifrar con la llave privada
    const decrypted = privateKeyObj.decrypt(encryptedBytes);

    return decrypted;
  } catch (err: any) {
    console.error("Error fatal en descifrado RSA:", err.message);
    throw new Error("Fallo en la operación de descifrado asimétrico");
  }
};
