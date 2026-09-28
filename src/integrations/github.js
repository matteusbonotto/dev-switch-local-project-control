import { createState, field, issue, finalize, toolInfo, combine, explain } from './state.js';

// Aceita https, ssh e aliases de host (git@github.com-trabalho:dono/repo.git).
export function parseGitHubRemote(url) {
  const u = String(url ?? '').trim();
  const m = u.match(/^(?:https?|git|ssh):\/\/(?:[^@\/]+@)?github\.com(?:-[\w.-]+)?(?::\d+)?\/([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/i)
    || u.match(/^(?:[^@\s]+@)?github\.com(?:-[\w.-]+)?:([^\/]+)\/([^\/]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

export const redactUrl = (u) => String(u ?? '').replace(/(https?:\/\/)[^\/\s@]+@/i, '$1');

export function parseGhAuthStatus(text) {
  const accounts = [];
  let cur = null;
  for (const line of String(text).split(/\r?\n/)) {
    let m = line.match(/Logged in to (\S+) (?:account|as) ([A-Za-z0-9-]+)/);
    if (m) { cur = { host: m[1], login: m[2], active: null, ok: true }; accounts.push(cur); continue; }
    m = line.match(/Failed to log in to (\S+) account ([A-Za-z0-9-]+)/);
    if (m) { cur = { host: m[1], login: m[2], active: null, ok: false }; accounts.push(cur); continue; }
    m = line.match(/Active account:\s*(true|false)/i);
    if (m && cur) cur.active = m[1].toLowerCase() === 'true';
  }
  if (accounts.length === 1 && accounts[0].active === null) accounts[0].active = true;
  const active = accounts.find((a) => a.active) ?? null;
  return { accounts, active: active?.ok ? active.login : null, authenticated: accounts.some((a) => a.ok) };
}

export function getGhAuth(env) {
  if (!env.tool('gh')?.installed) return Promise.resolve(null);
  return env.cached('gh:auth', 60000, async () => {
    const r = await env.exec('gh', ['auth', 'status', '--hostname', 'github.com']);
    return { ...parseGhAuthStatus(`${r.stdout}\n${r.stderr}`), logId: r.logId };
  });
}

async function readOrigin(dir, env) {
  if (!env.tool('git')?.installed || !env.isDir(dir)) return null;
  const r = await env.exec('git', ['remote', 'get-url', 'origin'], { cwd: dir });
  return r.ok ? r.stdout.trim() : '';
}

export default {
  id: 'github', label: 'GitHub', icon: 'repo', section: 'github',
  description: 'Repositório remoto (origin) e conta ativa da GitHub CLI.',
  fields: [
    { key: 'repository', label: 'Repositório', placeholder: 'dono/repositorio', validator: 'githubRepository', help: 'Comparado com o remote "origin" do diretório.' },
    { key: 'account', label: 'Conta GitHub', placeholder: 'login', validator: 'githubAccount', help: 'Opcional. Se definida, a troca faz "gh auth switch" (afeta todos os terminais).' },
  ],
  isConfigured: (p) => !!(p.github?.repository || p.github?.account),
  configId: (p) => p.github?.repository?.toLowerCase() ?? null,

  async getState(project, env) {
    const s = createState(this, project);
    const cfg = project.github ?? {};
    s.tool = toolInfo(env.tool('gh'));
    const matches = [];

    const origin = await readOrigin(project.directory, env);
    const repo = origin ? parseGitHubRemote(origin) : null;
    s.observedId = repo?.toLowerCase() ?? null;
    s.summary = repo ?? cfg.repository ?? null;
    if (origin === null) issue(s, cfg.repository ? 'error' : 'info', 'Não foi possível ler o remote (Git ausente ou diretório inexistente).');
    else if (!origin) issue(s, cfg.repository ? 'error' : 'info', 'O diretório não possui remote "origin".', null, cfg.repository ? 'git-remote-add' : null);
    else if (!repo) issue(s, 'warning', 'O remote "origin" não aponta para o GitHub.', redactUrl(origin));
    if (cfg.repository) {
      const m = field(s, 'Repositório', repo, { expected: cfg.repository });
      matches.push(origin === null ? null : m);
      if (m === false && origin) issue(s, 'error', 'O remote origin aponta para outro repositório. A troca de contexto não altera isso; use Corrigir se o cadastro estiver certo.', `git remote set-url origin https://github.com/${cfg.repository}.git`, 'git-remote-set');
    } else field(s, 'Repositório', repo);
    if (origin) field(s, 'Remote', `origin → ${redactUrl(origin)}`);

    const auth = await getGhAuth(env);
    if (!auth) {
      field(s, 'Conta ativa', null);
      issue(s, cfg.account ? 'warning' : 'info', 'GitHub CLI (gh) não encontrada — conta não verificada.', 'winget install --id GitHub.cli -e', 'install-gh');
      if (cfg.account) matches.push(null);
    } else {
      const m = field(s, 'Conta ativa', auth.active, { expected: cfg.account });
      if (auth.accounts.length > 1) field(s, 'Contas logadas', auth.accounts.map((a) => a.login).join(', '));
      if (!auth.authenticated) issue(s, cfg.account ? 'error' : 'warning', 'GitHub CLI não autenticada.', 'gh auth login', 'login-gh');
      if (cfg.account) {
        matches.push(m);
        if (m === false) {
          const known = auth.accounts.some((a) => a.ok && a.login.toLowerCase() === cfg.account.toLowerCase());
          s.fixable = known;
          if (!known) issue(s, 'error', `A conta ${cfg.account} não está logada na GitHub CLI.`, 'gh auth login', 'login-gh');
        }
      }
    }
    s.match = combine(matches);
    // Só a conta é corrigível; se o repositório diverge, a correção automática não resolve.
    if (s.match === false && matches[0] === false && cfg.repository) s.fixable = false;
    return finalize(s);
  },

  plan(project, s) {
    const from = s.fields.find((f) => f.label === 'Conta ativa')?.value;
    return [{ op: 'switch-account', from, to: project.github.account, scope: 'global',
      description: `Trocar conta ativa do gh: ${from ?? '—'} → ${project.github.account}`,
      command: `gh auth switch --hostname github.com --user ${project.github.account}` }];
  },

  async apply(project, change, env) {
    const r = await env.exec('gh', ['auth', 'switch', '--hostname', 'github.com', '--user', change.to]);
    env.invalidate('gh:');
    return { ok: r.ok, message: r.ok ? `conta ${change.to}` : explain(r, 'gh auth switch falhou'), logId: r.logId };
  },

  async detect(dir, env) {
    const origin = await readOrigin(dir, env);
    const repo = origin ? parseGitHubRemote(origin) : null;
    return {
      values: repo ? { repository: repo } : null,
      checks: [{ label: 'Remote do GitHub', ok: !!repo, detail: repo ?? (origin ? `origin não é GitHub: ${redactUrl(origin)}` : 'sem remote origin') }],
    };
  },

  async health(env) {
    const auth = await getGhAuth(env);
    if (!auth) return [{ id: 'gh-auth', label: 'GitHub Auth', status: 'missing', value: 'gh não instalada' }];
    return [{ id: 'gh-auth', label: 'GitHub Auth', status: auth.active ? 'ok' : 'error',
      value: auth.active ?? 'não autenticado', detail: auth.accounts.length > 1 ? `contas: ${auth.accounts.map((a) => a.login).join(', ')}` : null,
      hint: auth.active ? null : { command: 'gh auth login' }, logId: auth.logId }];
  },
};
