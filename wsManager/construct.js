module.exports = (tag, type, payload) => {
    // Format: tag; type; payload (JSON-encoded);
    return [
        tag,
        type,
        JSON.stringify(payload)
    ].join(';');
}