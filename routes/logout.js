const logger = require('../utils/logger');

module.exports = app => {
    app.delete('/logout', function (request, response) {
        const ws = global.connWSClients.get(request.session.userId);

        logger.info(`Destroying session for user ${request.session.userId}`);
        request.session.destroy(function () {
            if (ws) ws.close();

            response.send({ result: 'OK', message: 'Session destroyed' });
        });
    });
}