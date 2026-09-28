import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRegistry } from './integrations/index.js';
import { createRunner } from './lib/runner.js';
import { createToolService } from './lib/tools.js';
import { ProjectManager, Logger, History, TtlCache } from './lib/store.js';
import { ContextService } from './lib/context.js';
import { createLauncher, scanProjects } from './lib/system.js';
import { AppError, notFound, conflict, validateDirectory } from './lib/validation.js';
import { FIXES, stepText } from './lib/fixes.js';
import { explain } from './integrations/state.js';

export const VERSION = '0.1.0';
const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

export function defaultDataDir() {
  if (process.env.PROJECT_SWITCHER_HOME) return path.resolve(process.env.PROJECT_SWITCHER_HOME);
  if (process.platform === 'win32' && process.env.APPDATA) return path.join(process.env.APPDATA, 'ProjectSwitcher');
  return path.join(os.homedir(), '.config', 'project-switcher');
}

export function createApp({ dataDir = defaultDataDir(), port, registry = createRegistry(), runner, tools, envOverride } = {}) {
  const logger = new Logger({ file: path.join(dataDir, 'commands.jsonl') });
  runner ??= createRunner({ logger });
  tools ??= createToolService({ runner });
  const cache = new TtlCache();
  const defaultsRoot = path.join(os.homedir(), 'Documents', 'github');
  const projects = new ProjectManager({ file: path.join(dataDir, 'config.json'), registry, defaults: { projectsRoot: fs.existsSync(defaultsRoot) ? defaultsRoot : '' } });
  const history = new History(path.join(dataDir, 'history.jsonl'));
  const launcher = createLauncher({ runner, tools });

  async function createEnv() {
    if (envOverride) return envOverride;
    const t = await tools.detect();
    return {
      tool: (id) => t[id],
      exec: (id, args, opts = {}) => (t[id]?.installed
        ? runner.run(t[id].path, args, { ...opts, label: id })
        : Promise.resolve({ ok: false, error: 'not-installed', exitCode: null, stdout: '', stderr: '' })),
      cached: (k, ttl, fn) => cache.wrap(k, ttl, fn),
      invalidate: (prefix) => cache.clear(prefix),
      readText: (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } },
      isDir: (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } },
      isFile: (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } },
    };
  }

  const context = new ContextService({ projects, registry, createEnv, logger, history, cache });
  const token = crypto.randomBytes(32).toString('hex');

  // ---------- rotas
  const bootstrap = () => ({
    app: { name: 'Project Switcher', version: VERSION, platform: process.platform, dataDir },
    integrations: registry.meta(), settings: projects.settings(), projects: projects.list(),
    activeProjectId: projects.data.activeProjectId, warning: projects.loadWarning,
  });

  async function health(force) {
    if (force) cache.clear();
    const t = await tools.detect(force);
    const env = await createEnv();
    const checks = Object.values(t).map((x) => ({
      id: x.id, label: x.label, group: x.group, status: x.installed ? 'ok' : 'missing',
      value: x.installed ? (x.version ? `v${x.version}` : 'instalado') : 'não encontrado', detail: x.path,
      hint: x.installed ? null : { url: x.install, command: x.installCommand },
    }));
    for (const a of registry.list()) {
      if (a.health) for (const c of await a.health(env)) checks.push({ group: 'Autenticação', ...c });
    }
    checks.push({ id: 'node', label: 'Node.js', group: 'Ambiente', status: 'ok', value: process.version });
    let writable = true;
    try { fs.mkdirSync(dataDir, { recursive: true }); fs.accessSync(dataDir, fs.constants.W_OK); } catch { writable = false; }
    checks.push({ id: 'data', label: 'Pasta de dados', group: 'Ambiente', status: writable ? 'ok' : 'error', value: dataDir });
    return { checkedAt: new Date().toISOString(), checks };
  }

  async function detect(body) {
    const dir = validateDirectory(body?.directory);
    if (!fs.existsSync(dir)) throw new AppError('Diretório não encontrado.', 404);
    const env = await createEnv();
    const suggestion = { name: path.basename(dir), directory: dir };
    const checks = [];
    for (const a of registry.list()) {
      const r = await a.detect(dir, env);
      if (r.values) suggestion[a.section] = r.values;
      checks.push(...r.checks);
    }
    return { suggestion, checks };
  }

  // Depois de instalar algo, o PATH deste processo está desatualizado: relê o do registro.
  async function refreshPath() {
    const ps = (await tools.detect()).powershell;
    if (!ps?.installed) return;
    const r = await runner.run(ps.path, ['-NoProfile', '-NonInteractive', '-Command',
      "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"], { label: 'path' });
    if (!r.ok) return;
    const seen = new Set();
    process.env.PATH = [...String(process.env.PATH).split(';'), ...r.stdout.trim().split(';')]
      .filter((p) => p && !seen.has(p.toLowerCase()) && seen.add(p.toLowerCase())).join(';');
  }

  // Executa uma correção. Só aceita correções que o estado atual (recalculado aqui) oferece.
  let fixing = false;
  async function runFix(id, body) {
    const project = projects.get(id);
    if (fixing || context.busy) throw conflict('Já existe uma operação em andamento.');
    fixing = true;
    try {
      const before = await context.status(id, { fresh: true });
      const s = before.integrations.find((x) => x.id === body?.integration);
      const offered = s?.issues.find((i) => i.fix?.id === body?.fix)?.fix;
      if (!offered) throw conflict('Esta correção não se aplica ao estado atual. Clique em Verificar.');
      const def = FIXES[offered.id];
      const env = await createEnv();
      const t = await tools.detect();
      const steps = def.steps(project, env);
      logger.event(s.label, 'info', `Correção: ${def.label}`);

      if (def.kind === 'terminal') {
        const st = steps[0];
        const r = await launcher.runInTerminal(project.directory, st ? t[st.tool].path : null, st?.args ?? []);
        if (!r.ok) throw new AppError(`Não foi possível abrir o terminal: ${r.error}`);
        logger.event(s.label, 'info', 'Terminal aberto — conclua o processo nele e clique em Verificar.', r.logId);
        return { kind: 'terminal', ok: true, message: 'Um terminal foi aberto com o comando. Conclua o processo nele (login no navegador, senha etc.) e depois clique em Verificar.', status: before };
      }

      const results = [];
      for (const st of steps) {
        const r = await runner.run(t[st.tool].path, st.args, { cwd: st.cwd ? project.directory : undefined, timeout: st.timeout ?? 120000, label: st.tool });
        results.push({ command: stepText(st), ok: r.ok, logId: r.logId, error: r.ok ? null : explain(r, `falhou (código ${r.exitCode})`) });
        logger.event(s.label, r.ok || st.allowFail ? 'info' : 'error', `${stepText(st).slice(0, 120)} → ${r.ok ? 'ok' : results.at(-1).error}`, r.logId);
        if (!r.ok && !st.allowFail) break;
      }
      if (def.install) { await refreshPath(); await tools.detect(true); }
      cache.clear();
      const after = await context.status(id, { fresh: true });
      const still = after.integrations.find((x) => x.id === s.id)?.issues.some((i) => i.fix?.id === offered.id);
      const ok = results.every((r, i) => r.ok || steps[i].allowFail) && !still;
      const message = ok ? `${def.label}: concluído e verificado.`
        : results.some((r, i) => !r.ok && !steps[i].allowFail) ? `${def.label}: o comando falhou. Veja o log do comando.`
        : `${def.label}: o comando terminou, mas o problema ainda aparece na verificação.`;
      logger.event(s.label, ok ? 'success' : 'error', message);
      return { kind: 'run', ok, message, results, status: after };
    } finally { fixing = false; }
  }

  const routes = [
    ['GET', /^\/api\/bootstrap$/, () => bootstrap()],
    ['GET', /^\/api\/health$/, (m, q) => health(q.get('refresh') === '1')],
    ['POST', /^\/api\/projects$/, (m, q, b) => projects.create(b)],
    ['PUT', /^\/api\/projects\/([\w-]+)$/, ([id], q, b) => projects.update(id, b)],
    ['DELETE', /^\/api\/projects\/([\w-]+)$/, ([id]) => { projects.remove(id); return { ok: true }; }],
    ['GET', /^\/api\/projects\/([\w-]+)\/status$/, ([id], q) => context.status(id, { fresh: q.get('fresh') === '1' })],
    ['GET', /^\/api\/projects\/([\w-]+)\/plan$/, ([id]) => context.plan(id)],
    ['POST', /^\/api\/projects\/([\w-]+)\/apply$/, ([id]) => context.apply(id)],
    ['POST', /^\/api\/projects\/([\w-]+)\/fix$/, ([id], q, b) => runFix(id, b)],
    ['POST', /^\/api\/projects\/([\w-]+)\/fix$/, ([id], q, b) => runFix(id, b)],
    ['POST', /^\/api\/projects\/([\w-]+)\/open$/, async ([id], q, b) => {
      const r = await launcher.open(b?.target, projects.get(id).directory, projects.settings());
      if (!r.ok) throw new AppError(`Não foi possível abrir: ${r.error}`);
      return { ok: true };
    }],
    ['POST', /^\/api\/deactivate$/, () => { projects.setActive(null); return { ok: true }; }],
    ['POST', /^\/api\/detect$/, (m, q, b) => detect(b)],
    ['POST', /^\/api\/scan$/, (m, q, b) => ({ items: scanProjects(validateDirectory(b?.root, 'root'), projects.list().map((p) => p.directory)) })],
    ['POST', /^\/api\/pick-directory$/, () => launcher.pickDirectory()],
    ['PUT', /^\/api\/settings$/, (m, q, b) => projects.updateSettings(b)],
    ['GET', /^\/api\/logs$/, (m, q) => ({ entries: logger.since(Number(q.get('since') || 0)) })],
    ['GET', /^\/api\/history$/, () => ({ items: history.list() })],
    ['GET', /^\/api\/export$/, () => projects.exportData()],
    ['POST', /^\/api\/import$/, (m, q, b) => projects.importData(b?.data, b?.mode === 'replace' ? 'replace' : 'merge')],
  ];

  // ---------- estáticos (lista fixa: não existe caminho vindo da URL até o disco)
  const TYPES = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml' };
  const STATIC = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/styles.css': 'styles.css', '/favicon.svg': 'favicon.svg' };
  function serveStatic(pathname) {
    const file = STATIC[pathname];
    if (!file) return null;
    let body = fs.readFileSync(path.join(PUBLIC, file), 'utf8');
    if (file === 'index.html') body = body.replace('__PS_TOKEN__', token);
    return { type: TYPES[file.split('.').pop()], body };
  }

  const SEC_HEADERS = {
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store',
  };

  function send(res, status, body, type = 'application/json; charset=utf-8') {
    res.writeHead(status, { ...SEC_HEADERS, 'Content-Type': type });
    res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
  }

  const tokenBuf = Buffer.from(token);
  const validToken = (t) => typeof t === 'string' && t.length === token.length && crypto.timingSafeEqual(Buffer.from(t), tokenBuf);

  async function handler(req, res) {
    const allowedHosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    // Proteção contra DNS rebinding e requisições de outros sites.
    if (!allowedHosts.includes(req.headers.host)) return send(res, 403, { error: { message: 'Host não permitido.' } });
    if (req.headers.origin && !allowedHosts.some((h) => req.headers.origin === `http://${h}`)) return send(res, 403, { error: { message: 'Origem não permitida.' } });
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (!url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET') return send(res, 405, { error: { message: 'Método não permitido.' } });
      const s = serveStatic(url.pathname);
      return s ? send(res, 200, s.body, s.type) : send(res, 404, { error: { message: 'Não encontrado.' } });
    }
    if (!validToken(req.headers['x-ps-token'])) return send(res, 401, { error: { message: 'Token de sessão inválido. Recarregue a página.' } });

    try {
      let body = null;
      if (req.method === 'POST' || req.method === 'PUT') {
        if (!String(req.headers['content-type'] ?? '').startsWith('application/json')) throw new AppError('Content-Type deve ser application/json.', 415);
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 2 * 1024 * 1024) throw new AppError('Corpo da requisição muito grande.', 413);
        }
        try { body = raw ? JSON.parse(raw) : {}; } catch { throw new AppError('JSON inválido.'); }
      }
      for (const [method, re, fn] of routes) {
        const m = url.pathname.match(re);
        if (m && method === req.method) return send(res, 200, await fn(m.slice(1), url.searchParams, body));
      }
      throw notFound('Rota não encontrada.');
    } catch (err) {
      const status = err.status ?? 500;
      if (status >= 500) logger.event('Servidor', 'error', err.stack ?? err.message);
      send(res, status, { error: { message: status >= 500 ? `Erro interno: ${err.message}` : err.message, field: err.field ?? null } });
    }
  }

  return { handler, token, projects, context, logger, tools };
}
