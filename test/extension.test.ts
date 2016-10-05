import * as assert from 'assert';
import * as vscode from 'vscode';
import * as extension from '../src/extension';

suite("CLIs", () => {

    test("All commands", () => {
        assert.ok('azure-cli.openTerminal' in extension.commands);
        assert.ok('azure-cli.openTerminal20' in extension.commands);
        assert.ok('azure-cli.openTerminalPowershell' in extension.commands);
    });
});