import * as net from 'net';
import { StringDecoder } from 'string_decoder';
import * as vscode from 'vscode';

export interface IScannerArguments {
    port: number;
    pattern: string;
    shell: string;
    shellArgs?: string[];
}

export class Receiver {

    private matchEmitter = new vscode.EventEmitter<string[]>();
    onMatch = this.matchEmitter.event;
    private port: Promise<number>;

    start() {
        const server = net.createServer(socket => {
            let message = '';
            const decoder = new StringDecoder('utf8');
            socket.on('data', data => {
                message += decoder.write(data);
            });
            socket.on('end', () => {
                JSON.parse(message).forEach((match: string[]) => {
                    this.matchEmitter.fire(match);
                });
            });
        });

        this.port = new Promise<number>(resolve => {
            server.listen(0, 'localhost', () => {
                resolve(server.address().port);
            });
        });
    }

    getScannerArguments(pattern: string, shell: string, shellArgs?: string[]): Promise<IScannerArguments> {
        return this.port.then(port => ({
            port,
            pattern,
            shell,
            shellArgs,
        }));
    }
}
