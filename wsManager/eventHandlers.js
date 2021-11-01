const lzString = require('lz-string');
const logger = require('../utils/logger');

module.exports = wss => {
    wss.on('connection', function (ws, request) {
        const userId = request.session.userId;

        global.connWSClients.set(userId, ws);

        ws.on('message', function (message) {
            //
            // Here we can now use session parameters.
            //
            const msg = lzString.decompressFromUint8Array(message);
            logger.silly('Message received: ' + msg)
        });

        ws.on('close', function () {
            logger.verbose('Client disconnected, sessionID: ' + userId)
            global.connWSClients.delete(userId);
        });

        ws.send(lzString.compressToUint8Array('hi').buffer);
    });
}