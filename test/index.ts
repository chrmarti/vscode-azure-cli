var testRunner = require('vscode/lib/testrunner');

// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info
testRunner.configure({
    ui: 'tdd',
    useColors: true
});

module.exports = testRunner;