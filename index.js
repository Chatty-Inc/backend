'use strict';

const { WebSocketServer } = require('ws')
const session = require('express-session');
const express = require('express');
const http = require('http');
const cors = require('cors');
const admin = require('firebase-admin');

const logger = require('./utils/logger');

const serviceAccount = require('./config/serviceAccountKey.json');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
logger.info('Initialized firebase admin SDK');

const app = express();
global.connWSClients = new Map();

//
// We need the same instance of the session parser in express and
// WebSocket server.
//
const sessionParser = session({
    saveUninitialized: false,
    secret: ['$eCuRiTy'],
    resave: false
});

//
// Serve static files from the 'public' folder.
//
// app.use(express.static('public'));
app.use(sessionParser);
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:3000']
}))

//
// Create an HTTP server.
//
const server = http.createServer(app);

//
// Create a WebSocket server completely detached from the HTTP server.
//
const wss = new WebSocketServer({ clientTracking: false, noServer: true });

server.on('upgrade', function (request, socket, head) {
    logger.debug('Parsing session from request...');

    sessionParser(request, {}, () => {
        wss.handleUpgrade(request, socket, head, function (ws) {
            // logger.debug(JSON.stringify(request))
            if (!request.session.userId) {
                logger.warn('401 Unauthorized')
                ws.close(1008, 'unauthorized');

                return;
            }

            logger.debug('Session is parsed!');
            wss.emit('connection', ws, request);
        });
    });
});

//
// Start the server.
//
server.listen(8080, function () {
    logger.info('Waiting for connection at http://localhost:8080');
});

require('./wsManager/eventHandlers')(wss);
// require('./routes')(app);
require('./routes/auth')(app);
