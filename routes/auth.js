const crypto = require('crypto');
const uuid = require('uuid');
const decryptE2EE = require('../decryptE2EE');
const logger = require('../utils/logger');
const authErrCodes = require('../config/errorCodes.json');
const verifyCaptcha = require('../utils/validateRecaptcha');

const keyPairs = [];

module.exports = app => {
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
        const id = uuid.v4();

        // Decrypt auth data
        if (keyPairs.length >= 1) {
            const result = await decryptE2EE(req.body.payload, keyPairs[0].private);
            logger.info('Decrypted credentials: ' + JSON.stringify(result));

            // Verify recaptcha token
            if (!result.captcha) {
                logger.error('No captcha present');
                return;
            }

            if (!(await verifyCaptcha(result.captcha))) {
                res.status(401).send({ result: 'Unauthorized', err: authErrCodes.recaptcha });// If captcha failed don't allow auth
                return;
            }
        }
        else {
            res.status(500).send({ result: 'Internal server error', message: 'Try again later' });
            return;
        }

        logger.info(`Updating session for user ${id}`);
        req.session.userId = id;
        res.status(200).send({ result: 'OK', message: 'Session updated' });
    });

    app.post('/signup', async (req, res) => {

    });
}