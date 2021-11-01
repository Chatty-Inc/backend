const winston = require('winston');

const logger = winston.createLogger({
    transports: [
        new winston.transports.Console(),
        // new winston.transports.File({ filename: 'combined.log' })
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.cli()
    ),
    level: 0
});

module.exports = logger