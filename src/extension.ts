import * as vscode from 'vscode';
import * as cp from 'child_process';

interface CLI {
    commandId: string;
    terminalName: string;
    dockerImage: string;
}

const clis: CLI[] = [
    {
        commandId: 'azure-cli.openTerminal',
        terminalName: 'Azure CLI',
        dockerImage: 'microsoft/azure-cli',
    },
    {
        commandId: 'azure-cli.openTerminal20',
        terminalName: 'Azure CLI 2.0',
        dockerImage: 'azuresdk/azure-cli-python',
    },
    {
        commandId: 'azure-cli.openTerminalPowershell',
        terminalName: 'Azure Powershell',
        dockerImage: 'lukaszkaluzny/powershell-azure',
    }
];

const jumpboxName = 'azure-cli-jumpbox';

export type commands = { [id: string]: () => void; };
export const commands = clis.reduce((cmds, cli) => Object.assign(cmds, {
    [cli.commandId]: () => openTerminal(cli)
                        .catch(err => console.error(err))
}), <commands>{});

export function activate(context: vscode.ExtensionContext) {
    listTerminalSessions().then(sessions => {
        sessions.forEach(attachSession);
    });
    const subscriptions = context.subscriptions;
    for (const commandId in commands) {
        subscriptions.push(vscode.commands.registerCommand(commandId, commands[commandId]));
    }
}

function openTerminal(cli: CLI): Promise<void> {
    return listTerminalSessions().then(names => {
        const sessionName = newSessionName(cli.terminalName, names);
        const terminal = vscode.window.createTerminal(sessionName);
        terminal.show();
        terminal.sendText(`docker run --name ${jumpboxName} -d -t -v /var/run/docker.sock:/var/run/docker.sock chrmarti/azure-cli-jumpbox cat`);
        terminal.sendText(`docker exec -it ${jumpboxName} tmux new-session -s '${toTmuxSessionName(sessionName)}'\\; set status off\\; set prefix None`);
        terminal.sendText(`docker run -it --rm -v ${vscode.workspace.rootPath}:/code -w /code ${cli.dockerImage}`);
    });
}

function newSessionName(prefix: string, existingNames: string[]): string {
    let name;
    for (let i = 1; existingNames.indexOf(name = i > 1 ? `${prefix} (${i})` : prefix) !== -1; i++);
    return name;
}

function toTmuxSessionName(sessionName: string): string {
    return sessionName.replace('.', '_');
}

function fromTmuxSessionName(sessionName: string): string {
    return sessionName.replace('_', '.');
}

function listTerminalSessions(): Promise<string[]> {
    return isAzureCliJumpboxRunning().then(isRunning => {
        if (!isRunning) {
            return [];
        }
        return new Promise((resolve, reject) => {
            cp.exec(`docker exec -t ${jumpboxName} tmux start-server\\; list-sessions -F '#{session_name}'`, (err, stdout) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(stdout.split(/\r?\n/)
                        .filter(sessionName => !!sessionName)
                        .map(sessionName => fromTmuxSessionName(sessionName)));
                }
            });
        });
    });
}

function isAzureCliJumpboxRunning(): Promise<boolean> {
    return listDockerContainers().then(names => {
        return names.indexOf(jumpboxName) !== -1;
    });
}

function listDockerContainers(): Promise<string[]> {
    return new Promise((resolve, reject) => {
        cp.exec('docker ps --format "{{.Names}}"', (err, stdout) => {
            if (err) {
                reject(err);
            } else {
                resolve(stdout.split(/\r?\n/)
                    .filter(name => !!name));
            }
        });
    });
}

function attachSession(sessionName: string) {
        const terminal = vscode.window.createTerminal(sessionName);
        terminal.show();
        terminal.sendText(`docker exec -it ${jumpboxName} tmux attach-session -t '${toTmuxSessionName(sessionName)}'`);
}

export function deactivate() {
}