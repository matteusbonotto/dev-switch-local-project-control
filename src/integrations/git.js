import path from 'node:path';
import { createState, field, issue, finalize, toolInfo, explain } from './state.js';

export function parseStatusHeader(line = '') {
  const out = { branch: null, detached: false, upstream: null, ahead: 0, behind: 0, noCommits: false };
  if (!line.startsWith('## ')) return out;
  const rest = line.slice(3).trim();
  let m = rest.match(/^(?:No commits yet on|Initial commit on) (.+)$/);
  if (m) return { ...out, branch: m[1].trim(), noCommits: true };
  if (rest.startsWith('HEAD (no branch)')) return { ...out, detached: true };
  m = rest.match(/^(.+?)(?:\.\.\.(\S+))?(?: \[(.+)\])?$/);
  if (!m) return out;
  const extra = m[3] ?? '';
  return {
    ...out, branch: m[1], upstream: m[2] ?? null,
    ahead: Number(extra.match(/ahead (\d+)/)?.[1] ?? 0),
    behind: Number(extra.match(/behind (\d+)/)?.[1] ?? 0),
  };
}

const samePath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

async function readRepo(dir, env) {
  const st = await env.exec('git', ['status', '--porcelain=v1', '--branch'], { cwd: dir });
  if (!st.ok) return { error: /not a git repository/i.test(st.stderr) ? 'not-repo' : explain(st, 'erro ao ler o Git') };
  const lines = st.stdout.split(/\r?\n/).filter(Boolean);
  const top = await env.exec('git', ['rev-parse', '--show-toplevel'], { cwd: dir });
  return { head: parseStatusHeader(lines[0]), changes: Math.max(0, lines.length - 1), toplevel: top.ok ? path.resolve(top.stdout.trim()) : null };
}

export default {
  id: 'git', label: 'Git local', icon: 'branch', section: 'git',
  description: 'Branch e estado do repositório no diretório do projeto.',
  fields: [{ key: 'branch', label: 'Branch esperada', placeholder: 'main', validator: 'gitBranch',
    help: 'Opcional. Se definida, a troca de contexto faz "git switch" — somente com a árvore de trabalho limpa.' }],
  isConfigured: (p) => !!p.git?.branch,
  configId: () => null,

  async getState(project, env) {
    const s = createState(this, project);
    const expected = project.git?.branch;
    s.tool = toolInfo(env.tool('git'));
    if (!s.tool.installed) { issue(s, 'error', 'Git não encontrado no PATH.', 'winget install --id Git.Git -e', 'install-git'); return finalize(s); }
    if (!env.isDir(project.directory)) { issue(s, 'error', 'Diretório do projeto não encontrado.'); return finalize(s); }
    const repo = await readRepo(project.directory, env);
    if (repo.error === 'not-repo') { issue(s, expected ? 'error' : 'info', 'O diretório não é um repositório Git.', 'git init', 'git-init'); return finalize(s); }
    if (repo.error) { issue(s, 'error', `Não foi possível ler o Git: ${repo.error}`); return finalize(s); }
    const { head, changes, toplevel } = repo;
    field(s, 'Repositório', toplevel ? path.basename(toplevel) : null);
    const branchMatch = field(s, 'Branch', head.detached ? '(detached HEAD)' : head.branch, { expected });
    field(s, 'Status', changes ? `${changes} arquivo(s) alterado(s)` : 'Limpo', { mono: false });
    if (head.upstream) field(s, 'Upstream', `${head.upstream}${head.ahead ? ` ↑${head.ahead}` : ''}${head.behind ? ` ↓${head.behind}` : ''}`);
    if (toplevel && !samePath(toplevel, project.directory))
      issue(s, 'warning', `O diretório está dentro de outro repositório (raiz: ${toplevel}).`, 'Confira se o diretório cadastrado é a raiz do projeto.');
    if (head.noCommits) issue(s, 'info', 'Repositório ainda sem commits.');
    s.summary = head.branch ?? 'detached';
    if (expected) {
      s.match = branchMatch;
      if (!branchMatch) {
        s.fixable = changes === 0 && !head.noCommits;
        if (changes) issue(s, 'warning', 'Há alterações não commitadas: a branch não será trocada automaticamente.', 'git stash   (ou faça commit) e tente novamente', 'git-terminal');
      }
    }
    return finalize(s);
  },

  plan(project, s) {
    const from = s.fields.find((f) => f.label === 'Branch')?.value;
    return [{ op: 'switch', from, to: project.git.branch, scope: 'local', description: `Trocar branch ${from ?? '?'} → ${project.git.branch}`, command: `git switch ${project.git.branch}` }];
  },

  async apply(project, change, env) {
    const r = await env.exec('git', ['switch', change.to], { cwd: project.directory });
    return { ok: r.ok, message: r.ok ? `branch ${change.to}` : explain(r, 'git switch falhou'), logId: r.logId };
  },

  async detect(dir, env) {
    if (!env.tool('git')?.installed) return { values: null, checks: [{ label: 'Git', ok: false, detail: 'Git não instalado' }] };
    const repo = await readRepo(dir, env);
    if (repo.error) return { values: null, checks: [{ label: 'Repositório Git', ok: false, detail: repo.error === 'not-repo' ? 'não é um repositório Git' : repo.error }] };
    const nested = repo.toplevel && !samePath(repo.toplevel, dir);
    return {
      values: null, // branch não é pré-preenchida: definir uma branch faz a troca de contexto executar git switch
      checks: [{ label: 'Repositório Git', ok: !nested, detail: nested ? `dentro de ${repo.toplevel}` : `branch atual: ${repo.head.branch ?? 'detached'}` }],
    };
  },
};

