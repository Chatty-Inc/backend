const logger = require('./logger');
const fetch = require('node-fetch');

const RECAPTCHA_SECRET = '6Lc3ZNccAAAAAH9yhauNPj7tZ6yzo7xoeYbzheCe'

module.exports = async captcha => {
    logger.debug('Verifying captcha...');
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: `response=${captcha}&secret=${RECAPTCHA_SECRET}` // An incredibly hacky method
    });
    return (await resp.json()).success;
}