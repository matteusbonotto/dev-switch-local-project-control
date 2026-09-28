import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createApp, defaultDataDir } from './app.js';

const argv = process.argv.slice(2);
const flag = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const port = Number(flag('--port') ?? process.env.PROJECT_SWITCHER_PORT ?? 4477);
const HOST = '127.0.0.1'; // nunca exposto na rede

const app = createApp({ port, dataDir: defaultDataDir() });
const server = http.createServer(app.handler);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') console.error(`A porta ${port} já está em uso. O Project Switcher já está rodando? Abra http://${HOST}:${port} ou use --port <n>.`);
  else console.error(err);
  process.exit(1);
});

server.listen(port, HOST, () => {
  const url = `http://${HOST}:${port}`;
  console.log(`Project Switcher rodando em ${url}`);
  console.log(`Dados em ${defaultDataDir()}`);
  if (argv.includes('--open') && process.platform === 'win32') {
    spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'explorer.exe'), [url], { detached: true, stdio: 'ignore' }).unref();
  }
  app.tools.detect().catch(() => {}); // aquece a detecção de CLIs
});
