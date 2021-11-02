const lzString = require('lz-string');
const logger = require('../utils/logger');

module.exports = msg => {
    if (!msg) return {type: 'invalid', payload: {}};
    const split = msg.split(';');
    if (split.length < 2) return {type: 'invalid', payload: {}};

    if (split.length === 2) return {type: split[0], payload: JSON.parse(split[1])}
    return {tag: split[0], type: split[1], payload: JSON.parse(split[2])}
}