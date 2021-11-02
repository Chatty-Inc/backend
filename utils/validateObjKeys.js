module.exports = (obj, requiredKeys) => {
    for (const key of requiredKeys) {
        if (!obj[key]) return false;
    }
    return true;
}