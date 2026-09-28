import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { sanitize, stripAnsi } from './sanitize.js';

const IS_WIN = process.platform === 'win32';
const MAX_OUTPUT = 1024 * 1024;
// Caracteres que o cmd.exe pode interpretar mesmo dentro de aspas. Nunca passam.
const CMD_META = /["%!^&|<>\r\n\0`]/;

export function needsCmdShell(exe) {
  return IS_WIN && /\.(cmd|bat)$/i.test(exe);
}

export function quoteCmdArg(arg) {
  const s = String(arg);
  if (CMD_META.test(s)) throw new Error(`Argumento recusado (caracteres inseguros para cmd.exe): ${s}`);
  return s === '' || /[\s,;=()]/.test(s) ? `"${s}"` : s;
}

// Monta a linha para .cmd/.bat (Volta, npm shims). Todos os argumentos são validados.
export function buildCmdLine(exe, args) {
  if (CMD_META.test(exe)) throw new Error('Caminho do executável contém caracteres inseguros.');
  return [`"${exe}"`, ...args.map(quoteCmdArg)].join(' ');
}

function isFile(p) {
  try { return fs.statSync(p).isFile(); } catch { try { fs.lstatSync(p); return true; } catch { return false; } }
}

export function resolveExecutable(name, candidates = []) {
  const exts = IS_WIN ? (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').toLowerCase().split(';').filter(Boolean) : [''];
  const dirs = (process.env.PATH || '').split(path.delimiter).map((d) => d.replace(/"/g, '').trim()).filter(Boolean);
  if (name) {
    for (const dir of dirs) {
      for (const ext of exts) {
        const full = path.join(dir, name + ext);
        if (isFile(full)) return full;
      }
    }
  }
  return candidates.find(isFile) ?? null;
}

function display(exe, args) {
  const bin = path.basename(exe).replace(/\.(exe|cmd|bat)$/i, '');
  return [bin, ...args.map((a) => (/\s/.test(a) ? `"${a}"` : a))].join(' ');
}

export function createRunner({ logger, defaultTimeout = 30000 } = {}) {
  const baseEnv = (extra) => ({
    ...process.env,
    NO_COLOR: '1', FORCE_COLOR: '0', CLICOLOR: '0',
    GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_UPDATE_NOTIFIER: '1', NODE_NO_WARNINGS: '1',
    ...extra,
  });

  function spawnSafe(exe, args, options) {
    if (needsCmdShell(exe)) return spawn(buildCmdLine(exe, args), { ...options, shell: true });
    return spawn(exe, args, { ...options, shell: false });
  }

  function run(exe, args = [], { cwd, timeout = defaultTimeout, env, label } = {}) {
    const started = Date.now();
    const command = sanitize(display(exe, args));
    return new Promise((resolve) => {
      let out = '', err = '', done = false, timedOut = false, child, timer;
      const finish = (exitCode, error = null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        const res = {
          ok: exitCode === 0 && !timedOut && !error,
          exitCode, error, timedOut, command,
          stdout: stripAnsi(out), stderr: stripAnsi(err),
          durationMs: Date.now() - started,
        };
        res.logId = logger?.command({ tool: label, command, cwd, ...res }) ?? null;
        resolve(res);
      };
      try {
        child = spawnSafe(exe, args, { cwd, env: baseEnv(env), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      } catch (e) {
        err = e.message;
        return finish(null, 'spawn-failed');
      }
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (d) => { if (out.length < MAX_OUTPUT) out += d; });
      child.stderr.on('data', (d) => { if (err.length < MAX_OUTPUT) err += d; });
      child.on('error', (e) => { err += e.message; finish(null, e.code || 'spawn-failed'); });
      child.on('close', (code) => finish(code));
      timer = setTimeout(() => {
        timedOut = true;
        if (IS_WIN && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
        else child.kill('SIGKILL');
        setTimeout(() => finish(null, 'timeout'), 1500);
      }, timeout);
    });
  }

  // Abre um processo independente (terminal, editor, explorer). Não espera terminar.
  function launch(exe, args = [], { cwd, hide = false, label } = {}) {
    const command = sanitize(display(exe, args));
    return new Promise((resolve) => {
      const finish = (ok, error = null) => {
        const logId = logger?.command({ tool: label, command, cwd, exitCode: ok ? 0 : null, error, durationMs: 0, stdout: ok ? '(processo iniciado)' : '', stderr: error ?? '' });
        resolve({ ok, error, logId });
      };
      try {
        const child = spawnSafe(exe, args, { cwd, detached: true, stdio: 'ignore', windowsHide: hide, env: process.env });
        child.on('error', (e) => finish(false, e.message));
        child.on('spawn', () => { child.unref(); finish(true); });
      } catch (e) {
        finish(false, e.message);
      }
    });
  }

  return { run, launch };
}
