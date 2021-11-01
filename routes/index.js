const glob = require('glob');
const path = require('path');

module.exports = (app) => {
    glob(path.join(__dirname, '**/*.js'), {}, (e, f) => {
        f.forEach(file => {
            if (f === 'index.js') return;
            const name = file.slice(0, -3);
            require(name)(app);
        });
    });
}