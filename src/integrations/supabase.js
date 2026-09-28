import path from 'node:path';
import { createState, field, issue, finalize, toolInfo, explain, firstLine } from './state.js';

// O vínculo do Supabase é por diretório: a CLI lê supabase/.temp/project-ref.
export function readLink(dir, env) {
  const tmp = path.join(dir, 'supabase', '.temp');
  const raw = env.readText(path.join(tmp, 'project-ref'))?.trim() || null;
  let name = null;
  try { name = JSON.parse(env.readText(path.join(tmp, 'linked-project.json')) ?? 'null')?.name ?? null; } catch {}
  const toml = env.readText(path.join(dir, 'supabase', 'config.toml'));
  const localId = toml?.match(/^\s*project_id\s*=\s*"([^"]*)"/m)?.[1] ?? null;
  return { ref: raw && /^[a-z]{20}$/.test(raw) ? raw : null, name, localId, hasConfig: toml != null };
}

export function getSupabaseAuth(env) {
  if (!env.tool('supabase')?.installed) return Promise.resolve(null);
  return env.cached('supabase:auth', 120000, async () => {
    const r = await env.exec('supabase', ['projects', 'list', '-o', 'json'], { timeout: 45000 });
    if (r.ok) {
      let projects = null;
      try {
        const arr = JSON.parse(r.stdout.slice(r.stdout.indexOf('['), r.stdout.lastIndexOf(']') + 1));
        projects = arr.map((p) => ({ ref: p.ref ?? p.id, name: p.name })).filter((p) => p.ref);
      } catch {}
      return { authenticated: true, projects, logId: r.logId };
    }
    const text = `${r.stderr}\n${r.stdout}`;
    if (/access token|not logged in|unauthori[sz]ed|supabase login/i.test(text)) return { authenticated: false, logId: r.logId };
    return { authenticated: null, error: explain(r, 'erro desconhecido'), logId: r.logId };
  });
}

export default {
  id: 'supabase', label: 'Supabase', icon: 'bolt', section: 'supabase',
  description: 'Projeto vinculado pela Supabase CLI no diretório (supabase link).',
  fields: [{ key: 'projectRef', label: 'Project ref', placeholder: 'abcdefghijklmnopqrst', validator: 'supabaseRef', help: 'Encontrado na URL do dashboard: supabase.com/dashboard/project/<ref>.' }],
  isConfigured: (p) => !!p.supabase?.projectRef,
  configId: (p) => p.supabase?.projectRef ?? null,

  async getState(project, env) {
    const s = createState(this, project);
    const expected = project.supabase?.projectRef;
    s.tool = toolInfo(env.tool('supabase'));
    const link = readLink(project.directory, env);
    s.observedId = link.ref;
    s.summary = link.name ?? link.ref;

    const auth = await getSupabaseAuth(env);
    field(s, 'Autenticação', !auth ? 'desconhecida (CLI ausente)' : auth.authenticated ? 'autenticado' : auth.authenticated === false ? 'não autenticado' : `desconhecida: ${auth.error}`, { mono: false });
    s.match = expected ? field(s, 'Projeto vinculado', link.ref, { expected }) : null;
    if (!expected) field(s, 'Projeto vinculado', link.ref);
    if (link.name) field(s, 'Nome', link.name, { mono: false });
    if (link.localId) field(s, 'project_id (config.toml)', link.localId);

    if (!s.tool.installed) issue(s, expected ? 'warning' : 'info', 'Supabase CLI não encontrada. O vínculo foi lido do arquivo local.', 'scoop bucket add supabase https://github.com/supabase/scoop-bucket.git; scoop install supabase', 'install-supabase');
    if (auth?.authenticated === false) issue(s, 'error', 'A Supabase CLI não está autenticada.', 'supabase login', 'login-supabase');
    if (!link.ref) issue(s, expected ? 'warning' : 'info', 'Nenhum projeto vinculado neste diretório.', null, expected && s.tool.installed ? 'supabase-link' : null);
    if (expected && auth?.projects && !auth.projects.some((p) => p.ref === expected))
      issue(s, 'warning', `O projeto ${expected} não aparece na conta autenticada.`);
    if (s.match === false) s.fixable = s.tool.installed && auth?.authenticated !== false;
    return finalize(s);
  },

  plan(project, s) {
    const ref = project.supabase.projectRef;
    return [{ op: 'link', from: s.observedId, to: ref, scope: 'local', description: `Vincular Supabase: ${s.summary ?? 'nenhum'} → ${ref}`, command: `supabase link --project-ref ${ref}` }];
  },

  async apply(project, change, env) {
    const r = await env.exec('supabase', ['link', '--project-ref', change.to], { cwd: project.directory, timeout: 90000 });
    return { ok: r.ok, message: r.ok ? `projeto ${change.to} vinculado` : `${explain(r, 'supabase link falhou')} — se a CLI pedir a senha do banco, rode o comando pelo botão Terminal.`, logId: r.logId };
  },

  async detect(dir, env) {
    const link = readLink(dir, env);
    return {
      values: link.ref ? { projectRef: link.ref } : null,
      checks: [{ label: 'Projeto Supabase', ok: !!link.ref, detail: link.ref ? `${link.name ?? ''} ${link.ref}`.trim() : link.hasConfig ? 'supabase/ existe, mas não está vinculado' : 'não encontrado' }],
    };
  },

  async health(env) {
    const auth = await getSupabaseAuth(env);
    if (!auth) return [{ id: 'supabase-auth', label: 'Supabase Auth', status: 'missing', value: 'CLI não instalada' }];
    return [{ id: 'supabase-auth', label: 'Supabase Auth', status: auth.authenticated ? 'ok' : auth.authenticated === false ? 'error' : 'warning',
      value: auth.authenticated ? `autenticado${auth.projects ? ` · ${auth.projects.length} projeto(s)` : ''}` : auth.authenticated === false ? 'não autenticado' : firstLine(auth.error),
      hint: auth.authenticated ? null : { command: 'supabase login' }, logId: auth.logId }];
  },
};
