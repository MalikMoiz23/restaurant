/**
 * Runs the API and the web app together, prefixing each line so it is
 * clear which process is talking. Ctrl-C stops both.
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const targets = [
  { name: 'api', color: '\x1b[36m', workspace: '@mesa/api' },
  { name: 'web', color: '\x1b[35m', workspace: '@mesa/web' },
];

const children = targets.map(({ name, color, workspace }) => {
  const child = spawn(npm, ['run', 'dev', '--workspace', workspace], {
    cwd: root,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const prefix = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, target) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) target.write(prefix + line + '\n');
    });
  };

  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    console.log(`${prefix}exited with code ${code}`);
  });

  return child;
});

const stop = () => {
  for (const child of children) child.kill();
  process.exit(0);
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
