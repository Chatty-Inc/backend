const crypto = require('crypto');
const uuid = require('uuid');
const decryptE2EE = require('../decryptE2EE');
const logger = require('../utils/logger');
const verifyCaptcha = require('../utils/validateRecaptcha');
const { hash, verify } = require('../utils/crypto/scrypt');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const statusStrings = require('../config/statusStrings.json');
const authErrCodes = require('../config/errorCodes.json');

const keyPairs = [];

const decryptAuthMsg = async payload => {
    // Decrypt auth data
    if (keyPairs.length >= 1) {
        const result = await decryptE2EE(payload, keyPairs[0].private);
        logger.info('Decrypted credentials: ' + JSON.stringify(result));

        // Verify recaptcha token
        if (!result.captcha) {
            logger.error('No captcha present');
            return null;
        }

        const captchaOK = await verifyCaptcha(result.captcha)
        if (captchaOK) return result;
    }
    console.log('here')
    return null;
}

module.exports = app => {
    const db = getFirestore()

    /**
     * GET: returns latest public key, or generate one if none are present
     */
    app.get('/pubKey', (req, res) => {
        if (keyPairs.length === 0) { // Nothing in cache?
            // Create a new pair and store it
            crypto.generateKeyPair('rsa', {
                // The standard secure default length for RSA keys is 2048 bits
                modulusLength: 2048,
            }, (err, pubKey, priKey) => {
                res.status(200).send(pubKey.export({format: 'jwk'}));
                keyPairs.push({public: pubKey, private: priKey});
            });
        }
        else res.status(200).send(keyPairs[0].public.export({format: 'jwk'}));
        // Send one precached public key
    });

    /**
     * POST: Authenticate existing users and verifies reCAPTCHA token.
     * Use /signup (POST) to create a new user
     */
    app.post('/login', async function (req, res) {
        // "Log in" user and set userId to session.
        const content = await decryptAuthMsg(req.body.payload);
        if (!content) {
            res.status(401).send({ result: statusStrings.unauthorized, err: authErrCodes.recaptcha });
            return;
        }
        if (!content.username || !content.pw) {
            res.status(400).send({ result: statusStrings.badReq, err: authErrCodes.missingParams });
            return;
        }

        // Attempt to retrieve user data
        const dataSS = await db.collection('users').where('username', '==', content.username).limit(1).get();
        if (dataSS.empty) {
            // Prevents an attacker from knowing if its the wrong username or pw
            setTimeout(() => {
                res.status(400).send({ result: statusStrings.badReq, err: authErrCodes.credWrong });
            }, Math.floor(Math.random() * 500) + 400);
            return;
        }

        const userData = dataSS.docs[0].data();

        if (!await verify(content.pw,
            Buffer.from(userData.pwSalt, 'base64'),
            Buffer.from(userData.pwHash, 'base64')
        )) {
            res.status(400).send({ result: statusStrings.badReq, err: authErrCodes.credWrong });
            return;
        }

        const userID = dataSS.docs[0].id
        logger.info(`Updating session for user ${userID}`);
        req.session.userId = userID;
        res.status(200).send({ result: statusStrings.success, message: statusStrings.success});
    });

    /**
     * POST: Sign up a new user and add user metadata to
     * the respective document in the database.
     */
    app.post('/signup', async (req, res) => {
        const content = await decryptAuthMsg(req.body.payload);
        if (!content) {
            res.status(401).send({ result: statusStrings.unauthorized, err: authErrCodes.recaptcha });
            return;
        }
        if (!content.username || !content.pw || !content.handle) {
            res.status(400).send({ result: statusStrings.badReq, err: authErrCodes.missingParams });
            return;
        }

        const existingUsers = await db.collection('users').where('username', '==', content.username).limit(1).get();
        if (!existingUsers.empty) {
            res.status(400).send({ result: statusStrings.badReq, err: authErrCodes.acctExists });
            return;
        }

        const newID = uuid.v4(); // Generate a new user id for the new user

        const hashed = await hash(content.pw);

        await db.collection('users').doc(newID).set({
            username: content.username,
            pwSalt: hashed.salt.toString('base64'),
            pwHash: hashed.hash.toString('base64'),
            created: FieldValue.serverTimestamp(),
            tag: Math.floor(Math.random() * 10000),
            handle: content.handle
        });
        res.status(200).send({ result: statusStrings.success, message: 'Account created' });
    });
}