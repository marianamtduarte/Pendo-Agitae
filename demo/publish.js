// Publica dist-demo/ na branch gh-pages (GitHub Pages). Uso: npm run publish:demo
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();
execFileSync(process.execPath, [path.join(root, 'demo/build.js')], { stdio: 'inherit' });

const out = path.join(root, 'dist-demo');
const remote = git(['remote', 'get-url', 'origin']);
const name = git(['config', 'user.name']), email = git(['config', 'user.email']);
fs.rmSync(path.join(out, '.git'), { recursive: true, force: true });
git(['init', '-q', '-b', 'gh-pages'], out);
git(['add', '-A'], out);
git(['-c', `user.name=${name}`, '-c', `user.email=${email}`, 'commit', '-q', '-m', 'Publica a demonstração estática\n\nCo-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>'], out);
git(['remote', 'add', 'origin', remote], out);
git(['push', '-f', 'origin', 'gh-pages'], out); // branch de build: sempre reescrita
console.log('Publicado na branch gh-pages de ' + remote);
