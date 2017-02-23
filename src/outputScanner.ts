import { EOL } from 'os';
import * as net from 'net';
import { IScannerArguments } from './matchReceiver';
const fork: typeof node_pty.fork = require(`../../os/${process.platform}/node_modules/node-pty`).fork;

const args: IScannerArguments = JSON.parse(process.argv[2]);

const regex = new RegExp(args.pattern);

const child = fork(args.shell, args.shellArgs || [], {
    name: process.env.TERM,
    ...getWindowSize(),
    cwd: process.env.HOME,
    env: process.env,
});

let leftover = '';
child.on('data', (data: string) => {
    process.stdout.write(data);
    const lines = (leftover + data).split(EOL);
    leftover = lines.pop();
    const matches = lines.map(line => regex.exec(line)).filter(match => match);
    if (matches.length) {
        const client = new net.Socket();
        client.on('error', (err) => {
            console.error(err);
        });
        client.connect(args.port, 'localhost', () => {
            client.write(JSON.stringify(matches));
            client.end();
        });
    }
});

process.stdin.on('data', (data: string | Buffer) => {
    child.write(<any>data);
});

process.stdout.on('resize', () => {
    const { cols, rows } = getWindowSize();
    child.resize(cols, rows);
});

child.on('error', err => {
    console.error(err);
    process.exit(1);
});

child.on('exit', code => {
    console.log('exit', code);
    process.exit(code);
});

// Turn outer terminal off, since we are nesting terminals.
(<any>process.stdin).setRawMode(true);

function getWindowSize() {
    const stdout: any = process.stdout;
    const windowSize: [number, number] = stdout.isTTY ? stdout.getWindowSize() : [80, 30];
    return {
        cols: windowSize[0],
        rows: windowSize[1],
    };
}
