const forge = require("node-forge");

// Generamos las llaves una sola vez al arrancar el server
const { privateKey, publicKey } = forge.pki.rsa.generateKeyPair(2048);
const publicKeyPem = forge.pki.publicKeyToPem(publicKey);
const privateKeyPem = forge.pki.privateKeyToPem(privateKey);

module.exports = {
  getPublicKey: () => publicKeyPem,
  decryptRSA: (encryptedData64) => {
    try {
      const privateKeyObj = forge.pki.privateKeyFromPem(privateKeyPem);
      // Decodificamos el Base64 que viene del cliente
      const encryptedBytes = forge.util.decode64(encryptedData64);
      // Desciframos (Forge usa PKCS#1 v1.5 por defecto, igual que el cliente)
      const decrypted = privateKeyObj.decrypt(encryptedBytes);
      return decrypted;
    } catch (err) {
      console.error("Error FATAL en descifrado RSA:", err.message);
      throw err;
    }
  },
};
