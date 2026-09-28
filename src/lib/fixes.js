// Catálogo de correções. O navegador envia apenas o id da correção; os comandos são
// montados aqui a partir de constantes e de valores do projeto já validados por regex.
// kind 'run': executado pelo agente e verificado em seguida.
// kind 'terminal': processo interativo (login, senha): abre um terminal com o comando.

const INSTALL_TIMEOUT = 15 * 60 * 1000;
const winget = (pkg) => ({ tool: 'winget', args: ['install', '--id', pkg, '-e', '--silent', '--accept-source-agreements', '--accept-package-agreements'], timeout: INSTALL_TIMEOUT });

// Baixa o binário oficial do GitHub Releases (supabase/cli) quando o Scoop não está disponível.
const SUPABASE_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  "$ProgressPreference='SilentlyContinue'",
  "$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'amd64' }",
  "$dir = Join-Path $env:LOCALAPPDATA 'Programs\\supabase'",
  'New-Item -ItemType Directory -Force $dir | Out-Null',
  "$tgz = Join-Path $env:TEMP ('supabase_windows_' + $arch + '.tar.gz')",
  "Invoke-WebRequest -UseBasicParsing ('https://github.com/supabase/cli/releases/latest/download/supabase_windows_' + $arch + '.tar.gz') -OutFile $tgz",
  'tar -xzf $tgz -C $dir',
  'Remove-Item $tgz',
  "$p = [Environment]::GetEnvironmentVariable('Path','User')",
  "if (-not (($p -split ';') -contains $dir)) { [Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';') + ';' + $dir), 'User') }",
  "& (Join-Path $dir 'supabase.exe') --version",
].join('; ');

const repoUrl = (p) => `https://github.com/${p.github.repository}.git`;

export const FIXES = {
  'install-git': { label: 'Instalar Git', kind: 'run', install: true, steps: () => [winget('Git.Git')] },
  'install-gh': { label: 'Instalar GitHub CLI', kind: 'run', install: true, steps: () => [winget('GitHub.cli')] },
  'install-firebase': { label: 'Instalar Firebase CLI', kind: 'run', install: true,
    steps: () => [{ tool: 'npm', args: ['install', '-g', 'firebase-tools'], timeout: INSTALL_TIMEOUT }] },
  'install-supabase': { label: 'Instalar Supabase CLI', kind: 'run', install: true,
    steps: (p, env) => (env.tool('scoop')?.installed
      ? [{ tool: 'scoop', args: ['bucket', 'add', 'supabase', 'https://github.com/supabase/scoop-bucket.git'], allowFail: true },
         { tool: 'scoop', args: ['install', 'supabase'], timeout: INSTALL_TIMEOUT }]
      : [{ tool: 'powershell', args: ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SUPABASE_SCRIPT], timeout: INSTALL_TIMEOUT,
           display: 'Baixar a Supabase CLI oficial (github.com/supabase/cli/releases) para %LOCALAPPDATA%\\Programs\\supabase e adicionar ao PATH do usuário' }]) },

  'login-gh': { label: 'Fazer login no GitHub', kind: 'terminal', steps: () => [{ tool: 'gh', args: ['auth', 'login', '--hostname', 'github.com', '--web'] }] },
  'login-supabase': { label: 'Fazer login no Supabase', kind: 'terminal', steps: () => [{ tool: 'supabase', args: ['login'] }] },
  'login-firebase': { label: 'Fazer login no Firebase', kind: 'terminal', steps: () => [{ tool: 'firebase', args: ['login'] }] },

  'git-init': { label: 'Inicializar repositório', kind: 'run', steps: () => [{ tool: 'git', args: ['init'], cwd: true }] },
  'git-remote-add': { label: 'Adicionar remote origin', kind: 'run', steps: (p) => [{ tool: 'git', args: ['remote', 'add', 'origin', repoUrl(p)], cwd: true }] },
  'git-remote-set': { label: 'Apontar origin para o repositório do projeto', kind: 'run', steps: (p) => [{ tool: 'git', args: ['remote', 'set-url', 'origin', repoUrl(p)], cwd: true }] },
  'git-terminal': { label: 'Abrir terminal para resolver', kind: 'terminal', steps: () => [] },

  // link pode pedir a senha do banco: roda no terminal.
  'supabase-link': { label: 'Vincular projeto Supabase', kind: 'terminal', steps: (p) => [{ tool: 'supabase', args: ['link', '--project-ref', p.supabase.projectRef] }] },
  'firebase-init': { label: 'Inicializar Firebase no diretório', kind: 'terminal', steps: () => [{ tool: 'firebase', args: ['init'] }] },
};

const TOOL_NAMES = { winget: 'winget', npm: 'npm', scoop: 'scoop', powershell: 'powershell', git: 'git', gh: 'gh', supabase: 'supabase', firebase: 'firebase' };

export const stepText = (s) => s.display ?? [TOOL_NAMES[s.tool], ...s.args.map((a) => (/[\s;]/.test(a) ? `"${a}"` : a))].join(' ');

// Resumo exibido na UI. Retorna null se a ferramenta necessária não existir (fica só a dica).
export function describeFix(id, project, env) {
  const def = FIXES[id];
  if (!def) return null;
  let steps;
  try { steps = def.steps(project, env); } catch { return null; }
  const missing = steps.find((s) => !env.tool(s.tool)?.installed);
  if (missing) return null;
  return { id, label: def.label, kind: def.kind, commands: steps.map(stepText) };
}
