import fs from 'node:fs';
import path from 'node:path';
import { AppError } from './validation.js';
import { parseGitHubRemote } from '../integrations/github.js';
import { validators } from './validation.js';

const WIN_DIR = process.env.SystemRoot || 'C:\\Windows';

export function createLauncher({ runner, tools }) {
  async function terminal(dir, pref = 'auto') {
    const t = await tools.detect();
    const order = pref === 'auto' ? ['wt', 'pwsh', 'powershell', 'cmd'] : [pref, 'pwsh', 'powershell', 'cmd'];
    for (const id of order) {
      const tool = t[id];
      if (!tool?.installed) continue;
      if (id === 'wt' && dir.includes(';')) continue; // ";" é separador de comandos do wt
      if (id === 'wt') return runner.launch(tool.path, ['-d', dir], { label: 'terminal' });
      if (id === 'pwsh' || id === 'powershell') return runner.launch(tool.path, ['-NoExit', '-NoLogo'], { cwd: dir, label: 'terminal' });
      if (id === 'cmd') return runner.launch(tool.path, ['/K'], { cwd: dir, label: 'terminal' });
      if (id === 'gitBash') return runner.launch(tool.path, [`--cd=${dir}`], { label: 'terminal' });
    }
    throw new AppError('Nenhum terminal compatível foi encontrado.');
  }

  // Abre uma janela do PowerShell no diretório rodando um comando interativo (login, link).
  // exe vem da detecção de ferramentas; args vêm do catálogo de correções (constantes ou valores validados).
  async function runInTerminal(dir, exe, args) {
    const t = await tools.detect();
    const ps = t.pwsh?.installed ? t.pwsh : t.powershell;
    if (!ps?.installed) throw new AppError('PowerShell não encontrado.');
    const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
    const cmd = exe ? `& ${[exe, ...args].map(q).join(' ')}; Write-Host ''; Write-Host 'Concluído. Volte ao Project Switcher e clique em Verificar.'` : '';
    return runner.launch(ps.path, ['-NoExit', '-NoLogo', ...(cmd ? ['-Command', cmd] : [])], { cwd: dir, label: 'terminal' });
  }

  async function open(target, dir, settings) {
    if (!fs.existsSync(dir)) throw new AppError('Diretório não encontrado.', 404);
    if (target === 'folder') return runner.launch(path.join(WIN_DIR, 'explorer.exe'), [dir], { label: 'explorer' });
    if (target === 'terminal') return terminal(dir, settings.terminal);
    if (target === 'editor') {
      const code = (await tools.detect()).code;
      if (!code?.installed) throw new AppError('VS Code não encontrado. Instale ou adicione "code" ao PATH.');
      return runner.launch(code.path, [dir], { hide: true, label: 'code' });
    }
    throw new AppError('Ação desconhecida.');
  }

  // Abre o seletor de pasta nativo do Windows. Script fixo, sem input do usuário.
  async function pickDirectory() {
    const t = await tools.detect();
    const ps = t.pwsh?.installed ? t.pwsh : t.powershell;
    if (!ps?.installed) throw new AppError('PowerShell não encontrado.');
    const script = [
      '[Console]::OutputEncoding=[Text.Encoding]::UTF8',
      'Add-Type -AssemblyName System.Windows.Forms',
      '$f=New-Object System.Windows.Forms.FolderBrowserDialog',
      "$f.Description='Selecione a pasta do projeto'",
      '$o=New-Object System.Windows.Forms.Form -Property @{TopMost=$true;ShowInTaskbar=$false}',
      "if($f.ShowDialog($o) -eq 'OK'){[Console]::Out.Write($f.SelectedPath)}",
    ].join(';');
    const r = await runner.run(ps.path, ['-NoProfile', '-STA', '-Command', script], { timeout: 300000, label: 'folder-picker' });
    return { directory: r.stdout.trim() || null };
  }

  return { open, pickDirectory, runInTerminal };
}

// Varredura rápida por arquivos (sem executar CLIs) para cadastrar vários projetos.
export function scanProjects(root, registered = []) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new AppError('Pasta não encontrada.', 404);
  const known = new Set(registered.map((d) => d.toLowerCase()));
  const read = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .slice(0, 300)
    .map((d) => {
      const dir = path.join(root, d.name);
      const gitConfig = read(path.join(dir, '.git', 'config'));
      const url = gitConfig?.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/)?.[1];
      const repo = url ? parseGitHubRemote(url) : null;
      const ref = read(path.join(dir, 'supabase', '.temp', 'project-ref'))?.trim();
      let fb = null;
      try { fb = JSON.parse(read(path.join(dir, '.firebaserc')) ?? 'null')?.projects?.default ?? null; } catch {}
      return {
        name: d.name, directory: dir, git: gitConfig != null,
        repository: repo && !validators.githubRepository(repo) ? repo : null,
        supabaseRef: ref && !validators.supabaseRef(ref) ? ref : null,
        firebaseProjectId: fb && !validators.firebaseProjectId(fb) ? fb : null,
        registered: known.has(dir.toLowerCase()),
      };
    });
}
