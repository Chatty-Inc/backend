const crypto = require('crypto');

const hash = (pw, salt) => new Promise((resolve, reject) => {
    const pwSalt = !!salt ? salt : crypto.randomBytes(32);
    crypto.scrypt(pw, pwSalt, 64, { N: 256**2, r: 8, p: 1, maxmem: (128*256**2)*8*2 },
        (e, k) => {
        if (e) reject(e);
        resolve({hash: k, salt: pwSalt});
    });
});

const verify = async (pw, salt, expectedHash) => {
    return expectedHash.toString('base64') === (await hash(pw, salt)).hash.toString('base64');
}

module.exports = {
    hash,
    verify
}