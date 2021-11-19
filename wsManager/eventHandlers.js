const lzString = require('lz-string');
const logger = require('../utils/logger');
const parseMsg = require('./parse');
const constructMsg = require('./construct');
const { getFirestore } = require('firebase-admin/firestore');
const validateObjKeys = require('../utils/validateObjKeys');
const statusStrings = require('../config/statusStrings.json');
const { validate, version } = require('uuid');

module.exports = wss => {
    const db = getFirestore();

    wss.on('connection', (ws, request) => {
        const userId = request.session.userId;
        const promises = new Map();

        global.connWSClients.set(userId, ws);

        const send = async (constructedMsg) => ws.send(lzString.compressToUint8Array(constructedMsg).buffer);

        send(constructMsg('123', 'keyUpdate', {request: 'sign', user: 'self'}))

        ws.on('message', async message => {
            //
            // Here we can now use session parameters.
            //
            const msg = lzString.decompressFromUint8Array(message);
            logger.silly('Message received: ' + msg)
            const parsed = parseMsg(msg);

            switch (parsed.type) {
                case 'keepAlive':
                    await send(constructMsg(parsed.tag, parsed.type, {time: +new Date()})) // Ping pong, how fun
                    break;
                case 'vaultAction':
                    if (!validateObjKeys(parsed.payload, ['action', 'key'])) return;
                    const vaultDoc = db.collection('users')
                        .doc(userId)
                        .collection('encryptedVault')
                        .doc(parsed.payload.key)
                    if (parsed.payload.action === 'set') {
                        if (!validateObjKeys(parsed.payload, ['payload', 'salt', 'iv'])) return;
                        await vaultDoc.set({
                            content: parsed.payload.payload,
                            salt: parsed.payload.salt,
                            iv: parsed.payload.iv,
                        });
                        await send(constructMsg(parsed.tag, parsed.type, {result: statusStrings.success}));
                    }
                    else if (parsed.payload.action === 'get') {
                        const docContent = await vaultDoc.get();
                        const data = docContent.data();
                        await send(constructMsg(parsed.tag, parsed.type,
                        docContent.exists
                            ? { salt: data.salt, content: data.content, iv: data.iv }
                            : { error: '404' }
                        ))
                    }
                    break;
                case 'userInfo':
                    if (!validateObjKeys(parsed.payload, ['user'])) return;
                    const requestedUID = parsed.payload.user === 'self' ? userId : parsed.payload.user;
                    if (!(validate(requestedUID) && version(requestedUID) === 4)) return;

                    const usrData = await db
                        .collection('users')
                        .doc(requestedUID)
                        .get()
                    const data = usrData.data()
                    await send(constructMsg(parsed.tag, parsed.type,
                        usrData.exists
                            ? { uuid: requestedUID, created: data.created.toMillis(), username: data.username,
                                tag: data.tag, handlePortion: data.handle }
                            : { error: '404' }
                    ))
                    break;
                default:

            }
        });

        ws.on('close', function () {
            logger.verbose('Client disconnected, sessionID: ' + userId)
            global.connWSClients.delete(userId);
        });

        ws.send(lzString.compressToUint8Array('hi').buffer);
    });
}