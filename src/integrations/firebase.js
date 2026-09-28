import path from 'node:path';
import { createState, field, issue, finalize, toolInfo, explain } from './state.js';

export function parseJsonBlock(text) {
  const i = text.indexOf('{'), j = text.lastIndexOf('}');
  if (i < 0 || j < i) return null;
  try { return JSON.parse(text.slice(i, j + 1)); } catch { return null; }
}

// Usa a saída em TEXTO de "login:list": a versão --json imprime tokens.
export function parseFirebaseLogin(text) {
  if (/No authorized accounts/i.test(text)) return { authenticated: false, current: null, accounts: [] };
  const accounts = [...new Set(String(text).match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? [])];
  const current = String(text).match(/Logged in as\s+([^\s]+@[^\s]+?)[.,;]?(?:\s|$)/i)?.[1] ?? accounts[0] ?? null;
  return { authenticated: accounts.length ? true : null, current, accounts };
}

export function getFirebaseAuth(env) {
  if (!env.tool('firebase')?.installed) return Promise.resolve(null);
  return env.cached('firebase:auth', 120000, async () => {
    const r = await env.exec('firebase', ['login:list'], { timeout: 45000 });
    return { ...parseFirebaseLogin(`${r.stdout}\n${r.stderr}`), logId: r.logId };
  });
}

export function readFirebaserc(dir, env) {
  try {
    const rc = JSON.parse(env.readText(path.join(dir, '.firebaserc')) ?? 'null');
    return { default: rc?.projects?.default ?? null, aliases: rc?.projects ?? {} };
  } catch { return { default: null, aliases: {} }; }
}

async function currentProject(dir, env) {
  const r = await env.exec('firebase', ['use', '--json'], { cwd: dir, timeout: 45000 });
  const j = parseJsonBlock(r.stdout);
  if (j?.status === 'success') return { id: typeof j.result === 'string' ? j.result : null, logId: r.logId };
  return { id: null, error: j?.error ?? explain(r, 'firebase use falhou'), logId: r.logId };
}

export default {
  id: 'firebase', label: 'Firebase', icon: 'flame', section: 'firebase',
  description: 'Projeto ativo da Firebase CLI no diretório (firebase use).',
  fields: [{ key: 'projectId', label: 'Project ID', placeholder: 'meu-projeto', validator: 'firebaseProjectId', help: 'O ID do projeto (não o nome de exibição).' }],
  isConfigured: (p) => !!p.firebase?.projectId,
  configId: (p) => p.firebase?.projectId ?? null,

  async getState(project, env) {
    const s = createState(this, project);
    const expected = project.firebase?.projectId;
    const dir = project.directory;
    s.tool = toolInfo(env.tool('firebase'));
    const rc = readFirebaserc(dir, env);
    const hasJson = env.isFile(path.join(dir, 'firebase.json'));

    if (!s.tool.installed) {
      field(s, 'Projeto ativo', null, { expected });
      issue(s, expected ? 'warning' : 'info', 'Firebase CLI não encontrada — projeto ativo não verificado.', 'npm install -g firebase-tools', 'install-firebase');
    } else {
      const [auth, cur] = await Promise.all([getFirebaseAuth(env), env.isDir(dir) ? currentProject(dir, env) : { id: null, error: 'Diretório não encontrado.' }]);
      const id = cur.id && rc.aliases[cur.id] ? rc.aliases[cur.id] : cur.id; // resolve alias → project id
      s.observedId = id;
      s.summary = id;
      field(s, 'Conta (padrão da CLI)', auth?.current ?? (auth?.authenticated === false ? 'não autenticado' : null));
      const m = field(s, 'Projeto ativo', id, { expected });
      if (expected) s.match = cur.error && !id ? null : m;
      if (auth?.authenticated === false) issue(s, 'error', 'A Firebase CLI não está autenticada.', 'firebase login', 'login-firebase');
      if (cur.error) issue(s, expected ? 'error' : 'info', cur.error.split('\n')[0], hasJson ? null : 'firebase init');
      if (s.match === false || (expected && s.match === null && hasJson)) s.fixable = hasJson && auth?.authenticated !== false;
      if (expected && s.match === null && s.fixable) s.match = false; // sem projeto ativo mas corrigível
    }
    if (rc.default) field(s, 'Padrão (.firebaserc)', rc.default);
    if (!hasJson) issue(s, expected ? 'warning' : 'info', 'firebase.json não encontrado no diretório — "firebase use" exige um diretório Firebase.', 'firebase init', s.tool.installed ? 'firebase-init' : null);
    s.summary ??= rc.default;
    return finalize(s);
  },

  plan(project, s) {
    const id = project.firebase.projectId;
    return [{ op: 'use', from: s.observedId, to: id, scope: 'local', description: `Selecionar projeto Firebase: ${s.observedId ?? 'nenhum'} → ${id}`, command: `firebase use ${id}` }];
  },

  async apply(project, change, env) {
    const r = await env.exec('firebase', ['use', change.to, '--non-interactive'], { cwd: project.directory, timeout: 60000 });
    return { ok: r.ok, message: r.ok ? `projeto ${change.to} selecionado` : explain(r, 'firebase use falhou'), logId: r.logId };
  },

  async detect(dir, env) {
    const rc = readFirebaserc(dir, env);
    let id = rc.default;
    if (env.tool('firebase')?.installed && env.isFile(path.join(dir, 'firebase.json'))) id = (await currentProject(dir, env)).id ?? id;
    return { values: id ? { projectId: id } : null, checks: [{ label: 'Projeto Firebase', ok: !!id, detail: id ?? 'não encontrado' }] };
  },

  async health(env) {
    const auth = await getFirebaseAuth(env);
    if (!auth) return [{ id: 'firebase-auth', label: 'Firebase Auth', status: 'missing', value: 'CLI não instalada' }];
    return [{ id: 'firebase-auth', label: 'Firebase Auth', status: auth.authenticated ? 'ok' : 'error',
      value: auth.current ?? 'não autenticado', detail: auth.accounts.length > 1 ? `contas: ${auth.accounts.join(', ')}` : null,
      hint: auth.authenticated ? null : { command: 'firebase login' }, logId: auth.logId }];
  },
};
