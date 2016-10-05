'use strict';

import * as vscode from 'vscode';

interface CLI {
    commandId: string;
    terminalName: string;
    dockerImage: string;
    loginCommand: string;
}

const clis: CLI[] = [
    {
        commandId: 'azure-cli.openTerminal',
        terminalName: 'Azure CLI',
        dockerImage: 'microsoft/azure-cli',
        loginCommand: 'azure login'
    },
    {
        commandId: 'azure-cli.openTerminal20',
        terminalName: 'Azure CLI 2.0',
        dockerImage: 'azuresdk/azure-cli-python',
        loginCommand: 'az login'
    },
    {
        commandId: 'azure-cli.openTerminalPowershell',
        terminalName: 'Azure Powershell',
        dockerImage: 'lukaszkaluzny/powershell-azure',
        loginCommand: 'Login-AzureRmAccount'
    }
];

export type commands = { [id: string]: () => void; };
export const commands = clis.reduce((cmds, cli) => Object.assign(cmds, {
    [cli.commandId]: () => {
        const terminal = vscode.window.createTerminal(cli.terminalName);
        terminal.show();
        terminal.sendText(`docker run -it --rm -v \`pwd\`:/code -w /code ${cli.dockerImage}`);
        terminal.sendText(cli.loginCommand);
    }
}), <commands>{});

export function activate(context: vscode.ExtensionContext) {
    const subscriptions = context.subscriptions;
    for (const commandId in commands) {
        subscriptions.push(vscode.commands.registerCommand(commandId, commands[commandId]));
    }
}

export function deactivate() {
}