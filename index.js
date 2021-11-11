'use strict';
// This file handles basic init and importing all other modules in other files

const { WebSocketServer } = require('ws')
const session = require('express-session');
const express = require('express');
const http = require('http');
const cors = require('cors');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const dev = process.env.NODE_ENV !== 'production';
const logger = require('./utils/logger');

const serviceAccount = require('./config/serviceAccountKey.json');
initializeApp({
    credential: cert(serviceAccount)
});
logger.info('Initialized firebase admin SDK');

const app = express();
global.connWSClients = new Map();

//
// We need the same instance of the session parser in express and
// WebSocket server.
//
const FirestoreStore = require('firestore-store')(session);
const sessionParser = session({
    store: new FirestoreStore({
        database: getFirestore(),
    }),
    saveUninitialized: false,
    secret: ['5dfe72e0360e40ffa82a97349a7a0585'],
    name: 'sessionId',
    resave: false,
    cookie: {
        httpOnly: true,
        domain: dev ? 'localhost' : '', // TODO: Fill in actual production domain
    }
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

// require('./routes')(app);
require('./wsManager/eventHandlers')(wss);
require('./routes/auth')(app);
require('./routes/logout')(app);
