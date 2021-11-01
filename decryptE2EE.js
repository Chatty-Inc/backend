const crypto = require('crypto');
const lzString = require('lz-string');
const {getAuthTag} = require('./utils/cryptoUtils');

module.exports = async (payload, privateKey) => {
    const [encContent, encKey, aesIV] = payload.split(';');

    // Decrypt encrypted key
    const encKeyBuf = Buffer.from(encKey, 'base64');
    const decryptedKey = crypto.privateDecrypt({
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
    }, encKeyBuf);
    const aesRaw = lzString.decompressFromUint8Array(decryptedKey);

    // Import the decrypted JWK
    const iv = Buffer.from(aesIV, 'base64');
    const importedKey = Buffer.from(aesRaw, 'base64');

    // (Attempt to) decrypt the payload
    const decipher = crypto.createDecipheriv('aes-256-gcm', importedKey, iv);
    decipher.setAuthTag(getAuthTag(Buffer.from(encContent, 'base64')));
    return JSON.parse(Buffer.concat([
        decipher.update(Buffer.from(encContent, 'base64').slice(0, -16)),
        decipher.final()
    ]).toString('utf8'));
}