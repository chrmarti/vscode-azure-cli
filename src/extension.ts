import * as cp from 'child_process';
import * as opn from 'opn';
import * as shortid from 'shortid';
import * as vscode from 'vscode';

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
        dockerImage: '10thmagnitude/powershell-azure',
    }
];

const jumpboxName = 'azure-cli-jumpbox';

export type commands = { [id: string]: () => void; };
export const commands = clis.reduce((cmds, cli) => Object.assign(cmds, {
    [cli.commandId]: () => openTerminal(cli)
                        .catch(err => console.error(err))
}), <commands>{});

const terminals: vscode.Terminal[] = [];

export function activate(context: vscode.ExtensionContext) {
    const subscriptions = context.subscriptions;
    subscriptions.push(vscode.window.onDidCloseTerminal(onDidCloseTerminal));
    checkDockerInstall().then(installed => {
        if (installed) {
            return listTerminalSessions().then(sessions => {
                sessions.forEach(attachSession);
            });
        }
    });
    for (const commandId in commands) {
        subscriptions.push(vscode.commands.registerCommand(commandId, commands[commandId]));
    }
}

function openTerminal(cli: CLI): Promise<void> {
    return checkDockerInstall().then(installed => {
        if (installed) {
            return listTerminalSessions().then(names => {
                const sessionName = newSessionName(cli.terminalName, names);
                const terminal = vscode.window.createTerminal(sessionName);
                terminals.push(terminal);
                terminal.show();
                terminal.sendText(`docker pull chrmarti/azure-cli-jumpbox`);
                terminal.sendText(`docker pull ${cli.dockerImage}`);
                terminal.sendText(`docker run --name ${jumpboxName} -d -t -v /var/run/docker.sock:/var/run/docker.sock chrmarti/azure-cli-jumpbox cat`);
                terminal.sendText(`docker start ${jumpboxName}`);
                const containerName = `azure-cli-${shortid.generate()}`;
                terminal.sendText(`docker exec -it ${jumpboxName} tmux new-session -s '${toTmuxSessionName(sessionName)}' /bin/bash -c "trap 'docker rm -f ${containerName}' EXIT && docker run --name ${containerName} -it -v ${vscode.workspace.rootPath}:/code -w /code ${cli.dockerImage}"; exit`);
            });
        } else {
            return dockerNotFound();
        }
    });
}

function dockerNotFound(): Thenable<void> {
    return vscode.window.showInformationMessage<any>('Docker not found on PATH, make sure it is installed.',
        {
            title: 'Download',
            run: () => {
                opn('https://www.docker.com/');
            }
        },
        {
            title: 'Close',
            isCloseAffordance: true
        }
    ).then(result => {
        if (result.run) {
            result.run();
        }
    });
}

function onDidCloseTerminal(terminal: vscode.Terminal) {
    const i = terminals.indexOf(terminal);
    if (i !== -1) {
        terminals.splice(i, 1);
        cp.exec(`docker exec -t ${jumpboxName} tmux kill-session -t '${toTmuxSessionName(terminal.name)}'`, err => {
            if (err) {
                console.error(err);
            }
        });
    }
}

function newSessionName(prefix: string, existingNames: string[]): string {
    let name: string;
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

function checkDockerInstall(): Promise<boolean> {
    return new Promise(resolve => {
        cp.exec('docker --help', err => {
            resolve(!err);
        });
    });
}

function attachSession(sessionName: string) {
        const terminal = vscode.window.createTerminal(sessionName);
        terminals.push(terminal);
        terminal.show();
        terminal.sendText(`docker pull chrmarti/azure-cli-jumpbox`);
        terminal.sendText(`docker run --name ${jumpboxName} -d -t -v /var/run/docker.sock:/var/run/docker.sock chrmarti/azure-cli-jumpbox cat`);
        terminal.sendText(`docker start ${jumpboxName}`);
        terminal.sendText(`docker exec -it ${jumpboxName} tmux attach-session -t '${toTmuxSessionName(sessionName)}'`);
}

export function deactivate() {
}