import path from 'node:path';
import fs from 'node:fs';
import { resolveExecutable } from './runner.js';

const PF = process.env.ProgramFiles || 'C:\\Program Files';
const LAD = process.env.LOCALAPPDATA || '';
const HOME = process.env.USERPROFILE || process.env.HOME || '';
const PS_VERSION = ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'];

export const TOOL_DEFS = {
  git: { label: 'Git', group: 'CLI', bin: 'git', version: ['--version'], candidates: [`${PF}\\Git\\cmd\\git.exe`], install: 'https://git-scm.com/download/win', command: 'winget install --id Git.Git -e' },
  gh: { label: 'GitHub CLI', group: 'CLI', bin: 'gh', version: ['--version'], candidates: [`${PF}\\GitHub CLI\\gh.exe`, `${LAD}\\Programs\\GitHub CLI\\gh.exe`, `${HOME}\\scoop\\shims\\gh.exe`], install: 'https://cli.github.com', command: 'winget install --id GitHub.cli -e' },
  supabase: { label: 'Supabase CLI', group: 'CLI', bin: 'supabase', version: ['--version'], candidates: [`${HOME}\\scoop\\shims\\supabase.exe`, `${LAD}\\Programs\\supabase\\supabase.exe`], install: 'https://supabase.com/docs/guides/local-development/cli/getting-started', command: 'scoop bucket add supabase https://github.com/supabase/scoop-bucket.git; scoop install supabase' },
  firebase: { label: 'Firebase CLI', group: 'CLI', bin: 'firebase', version: ['--version'], install: 'https://firebase.google.com/docs/cli', command: 'npm install -g firebase-tools' },
  pwsh: { label: 'PowerShell 7', group: 'Terminal', bin: 'pwsh', version: PS_VERSION, command: 'winget install --id Microsoft.PowerShell -e' },
  powershell: { label: 'Windows PowerShell', group: 'Terminal', bin: 'powershell', version: PS_VERSION },
  wt: { label: 'Windows Terminal', group: 'Terminal', bin: 'wt', command: 'winget install --id Microsoft.WindowsTerminal -e' },
  // Git Bash nunca vem do PATH: "bash.exe" em System32 é o WSL.
  gitBash: { label: 'Git Bash', group: 'Terminal', bin: null, candidates: [`${PF}\\Git\\git-bash.exe`, `${LAD}\\Programs\\Git\\git-bash.exe`] },
  cmd: { label: 'Prompt de Comando', group: 'Terminal', bin: null, candidates: [process.env.ComSpec || 'C:\\Windows\\System32\\cmd.exe'] },
  winget: { label: 'winget', group: 'Instalador', bin: 'winget', version: ['--version'] },
  npm: { label: 'npm', group: 'Instalador', bin: 'npm', version: ['--version'] },
  scoop: { label: 'Scoop', group: 'Instalador', bin: 'scoop', candidates: [`${HOME}\\scoop\\shims\\scoop.cmd`] },
  code: { label: 'VS Code', group: 'Editor', bin: 'code', version: ['--version'], candidates: [`${LAD}\\Programs\\Microsoft VS Code\\bin\\code.cmd`, `${PF}\\Microsoft VS Code\\bin\\code.cmd`], install: 'https://code.visualstudio.com' },
};

export function createToolService({ runner }) {
  let snapshot = null, at = 0, pending = null;

  async function detectOne(id, def, found) {
    let p = resolveExecutable(def.bin, def.candidates ?? []);
    if (id === 'gitBash' && !p && found.git?.path) {
      const c = path.resolve(path.dirname(found.git.path), '..', 'git-bash.exe');
      if (fs.existsSync(c)) p = c;
    }
    const base = { id, label: def.label, group: def.group, install: def.install ?? null, installCommand: def.command ?? null };
    if (!p) return { ...base, installed: false, path: null, version: null };
    let version = null;
    if (def.version) {
      const r = await runner.run(p, def.version, { timeout: 20000, label: id });
      version = `${r.stdout}\n${r.stderr}`.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? null;
    }
    return { ...base, installed: true, path: p, version };
  }

  async function detect(force = false) {
    if (!force && snapshot && Date.now() - at < 300000) return snapshot;
    if (pending) return pending;
    pending = (async () => {
      const found = {};
      found.git = await detectOne('git', TOOL_DEFS.git, found);
      const rest = await Promise.all(Object.entries(TOOL_DEFS).filter(([id]) => id !== 'git').map(async ([id, def]) => [id, await detectOne(id, def, found)]));
      snapshot = { ...found, ...Object.fromEntries(rest) };
      at = Date.now();
      return snapshot;
    })().finally(() => { pending = null; });
    return pending;
  }

  return { detect };
}
