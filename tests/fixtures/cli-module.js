const { Honolus } = require('../../dist');

const sonolus = new Honolus();

sonolus.route.server.info(class {
    handle() {
        return {
            title: 'CLI fixture',
            buttons: [],
            configuration: { options: [] },
        };
    }
});

exports.sonolus = sonolus;
