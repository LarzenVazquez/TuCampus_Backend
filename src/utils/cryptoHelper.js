const forge = require("node-forge");

/* generacion de llaves rsa al arrancar el servidor */
const { privatekey, publickey } = forge.pki.rsa.generatekeypair(2048);
const publickeypem = forge.pki.publickeytopem(publickey);
const privatekeypem = forge.pki.privatekeytopem(privatekey);

module.exports = {
  /* obtener llave publica */
  getpublickey: () => publickeypem,

  /* desifrar la llave aes que viene en rsa */
  decryptrsa: (encrypteddata64) => {
    try {
      const privatekeyobj = forge.pki.privatekeyfrompem(privatekeypem);

      /* decodificar base64 del cliente */
      const encryptedbytes = forge.util.decode64(encrypteddata64);

      /* descifrar con llave privada */
      const decrypted = privatekeyobj.decrypt(encryptedbytes);
      return decrypted;
    } catch (err) {
      /* error en descifrado */
      console.error("error fatal en descifrado rsa:", err.message);
      throw err;
    }
  },
};
