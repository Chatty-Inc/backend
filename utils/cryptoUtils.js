/** Get the authentication tag from a encrypted AES-GCM buffer */
const getAuthTag = (encBuf, tagLen) => {
    if (tagLen === void 0) tagLen = 128; // By default tag lengths are 128 bits
    return encBuf.slice(encBuf.byteLength - ((tagLen + 7) >> 3)); // Some bit magic
}

module.exports = {
    getAuthTag
}