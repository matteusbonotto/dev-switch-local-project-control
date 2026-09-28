import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sanitize } from '../src/lib/sanitize.js';
import { quoteCmdArg, createRunner } from '../src/lib/runner.js';
import { ProjectManager, TtlCache, Logger, History } from '../src/lib/store.js';
import { ContextService } from '../src/lib/context.js';
import { createRegistry } from '../src/integrations/index.js';
import git, { parseStatusHeader } from '../src/integrations/git.js';
import github, { parseGitHubRemote, parseGhAuthStatus } from '../src/integrations/github.js';
import supabase from '../src/integrations/supabase.js';
import firebase, { parseFirebaseLogin } from '../src/integrations/firebase.js';
import { createApp } from '../src/app.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ps-test-'));
const DIR = path.resolve(os.tmpdir(), 'proj-a');
const registry = createRegistry();

// Env falso: respostas por "tool args", arquivos em memória.
function fakeEnv({ tools = ['git', 'gh', 'supabase', 'firebase'], responses = {}, files = {}, dirs = [DIR] } = {}) {
  const calls = [];
  return {
    calls,
    tool: (id) => ({ id, label: id, installed: tools.includes(id), version: '1.0.0' }),
    exec: async (id, args) => {
      calls.push(`${id} ${args.join(' ')}`);
      if (!tools.includes(id)) return { ok: false, error: 'not-installed', exitCode: null, stdout: '', stderr: '' };
      let r = responses[`${id} ${args.join(' ')}`];
      if (typeof r === 'function') r = r();
      if (!r) return { ok: false, exitCode: 1, stdout: '', stderr: `unexpected: ${id} ${args.join(' ')}` };
      const exitCode = r.exitCode ?? 0;
      return { ok: exitCode === 0, exitCode, stdout: r.stdout ?? '', stderr: r.stderr ?? '', logId: calls.length };
    },
    cached: (k, ttl, fn) => fn(),
    invalidate() {},
    readText: (p) => files[path.resolve(p)] ?? null,
    isDir: (p) => dirs.includes(path.resolve(p)),
    isFile: (p) => path.resolve(p) in files,
  };
}
const f = (rel) => path.resolve(DIR, rel);

// ---------------------------------------------------------------- segurança
test('sanitize remove tokens conhecidos', () => {
  const s = sanitize('gho_abcdefghijklmnopqrstuvwxyz0123 ya29.a0AXabc "refresh_token": "1//0hKEnNR63obwbCgYIARAAGBESNwF" sbp_0123456789abcdef0123456789 https://user:pass@github.com/x Token: abc123');
  for (const leak of ['gho_abc', 'ya29.a0AX', '1//0hK', 'sbp_0123', 'user:pass', 'abc123']) assert.ok(!s.includes(leak), `vazou ${leak}: ${s}`);
});

test('quoteCmdArg recusa metacaracteres do cmd.exe', () => {
  for (const bad of ['a&b', 'a|b', 'a"b', '%PATH%', 'a^b', 'a>b', 'x\nrm']) assert.throws(() => quoteCmdArg(bad));
  assert.equal(quoteCmdArg('C:\\Meus Projetos\\app'), '"C:\\Meus Projetos\\app"');
  assert.equal(quoteCmdArg('bnttapp'), 'bnttapp');
});

test('runner executa com argumentos separados, captura exit code e respeita timeout', async () => {
  const logger = new Logger();
  const run = createRunner({ logger }).run;
  const ok = await run(process.execPath, ['-e', 'console.log("a & b | c")']);
  assert.equal(ok.exitCode, 0);
  assert.equal(ok.stdout.trim(), 'a & b | c');
  const fail = await run(process.execPath, ['-e', 'process.exit(3)']);
  assert.equal(fail.ok, false);
  assert.equal(fail.exitCode, 3);
  const slow = await run(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], { timeout: 300 });
  assert.equal(slow.timedOut, true);
  assert.equal(logger.since(0).length, 3);
});

// ---------------------------------------------------------------- ProjectManager
test('ProjectManager: criar, editar seção, favoritar, excluir, persistir', () => {
  const file = path.join(tmp(), 'config.json');
  const pm = new ProjectManager({ file, registry });
  const p = pm.create({ name: 'BNTT', directory: DIR, github: { repository: 'matteusbonotto/bonotroll' }, token: 'segredo' });
  assert.equal(p.token, undefined, 'chaves desconhecidas são descartadas');
  pm.update(p.id, { supabase: { projectRef: 'qlcrsclgtpjeqkmykqrs' } });
  pm.update(p.id, { favorite: true });
  assert.equal(pm.get(p.id).github.repository, 'matteusbonotto/bonotroll', 'editar uma seção não apaga as outras');
  pm.update(p.id, { github: null });
  assert.equal(pm.get(p.id).github, undefined);
  pm.setActive(p.id);
  const reloaded = new ProjectManager({ file, registry });
  assert.equal(reloaded.get(p.id).supabase.projectRef, 'qlcrsclgtpjeqkmykqrs');
  assert.equal(reloaded.getActive().id, p.id);
  assert.throws(() => reloaded.create({ name: 'bntt', directory: DIR }), /Já existe/);
  reloaded.remove(p.id);
  assert.equal(reloaded.getActive(), null);
  assert.ok(!fs.readFileSync(file, 'utf8').includes('segredo'));
});

test('validação recusa entradas maliciosas', () => {
  const pm = new ProjectManager({ file: path.join(tmp(), 'c.json'), registry });
  const bad = [
    { name: 'x', directory: 'relativo\\pasta' },
    { name: 'x', directory: DIR, supabase: { projectRef: 'abc & calc.exe' } },
    { name: 'x', directory: DIR, firebase: { projectId: 'proj; rm -rf /' } },
    { name: 'x', directory: DIR, git: { branch: '--upload-pack=evil' } },
    { name: 'x', directory: DIR, github: { repository: '../../etc' } },
    { name: 'a\u0000b', directory: DIR },
  ];
  for (const b of bad) assert.throws(() => pm.create(b), undefined, JSON.stringify(b));
});

test('import/export não carrega segredos e ignora projetos inválidos', () => {
  const pm = new ProjectManager({ file: path.join(tmp(), 'c.json'), registry });
  const r = pm.importData({ format: 'project-switcher', projects: [
    { name: 'A', directory: DIR, firebase: { projectId: 'bnttapp', serviceAccount: '{...}' }, accessToken: 'x' },
    { name: 'B', directory: 'nao-absoluto' },
  ] });
  assert.equal(r.added, 1);
  assert.equal(r.errors.length, 1);
  const out = JSON.stringify(pm.exportData());
  assert.ok(!out.includes('serviceAccount') && !out.includes('accessToken'));
});

// ---------------------------------------------------------------- parsers
test('parsers de git, remote, gh e firebase', () => {
  assert.deepEqual(parseStatusHeader('## main...origin/main [ahead 2, behind 1]'), { branch: 'main', detached: false, upstream: 'origin/main', ahead: 2, behind: 1, noCommits: false });
  assert.equal(parseStatusHeader('## No commits yet on master').noCommits, true);
  assert.equal(parseGitHubRemote('https://github.com/matteusbonotto/bonotroll.git'), 'matteusbonotto/bonotroll');
  assert.equal(parseGitHubRemote('git@github.com-work:org/repo.git'), 'org/repo');
  assert.equal(parseGitHubRemote('https://gitlab.com/a/b.git'), null);
  const gh = parseGhAuthStatus('github.com\n  ✓ Logged in to github.com account alice (keyring)\n  - Active account: false\n  ✓ Logged in to github.com account bob (keyring)\n  - Active account: true\n');
  assert.equal(gh.active, 'bob');
  assert.equal(parseGhAuthStatus('You are not logged into any GitHub hosts.').authenticated, false);
  assert.equal(parseFirebaseLogin('Logged in as appbntt@gmail.com').current, 'appbntt@gmail.com');
  assert.equal(parseFirebaseLogin('No authorized accounts, run "firebase login"').authenticated, false);
});

// ---------------------------------------------------------------- adapters
const base = { id: '1', name: 'A', directory: DIR };

test('GitHub: CLI ausente, repo correto/incorreto, conta', async () => {
  const remote = (url) => ({ 'git remote get-url origin': { stdout: `${url}\n` } });
  let s = await github.getState({ ...base, github: { repository: 'me/a' } }, fakeEnv({ tools: ['git'], responses: remote('https://github.com/me/a.git') }));
  assert.equal(s.match, true);
  assert.ok(s.issues.some((i) => /não encontrada/.test(i.message)));
  s = await github.getState({ ...base, github: { repository: 'me/a' } }, fakeEnv({ tools: ['git'], responses: remote('https://github.com/me/b.git') }));
  assert.equal(s.status, 'mismatch');
  assert.equal(s.fixable, false, 'remote divergente não é alterado automaticamente');
  const auth = { 'gh auth status --hostname github.com': { stdout: '✓ Logged in to github.com account alice (keyring)\n- Active account: true\n✓ Logged in to github.com account bob (keyring)\n- Active account: false' } };
  s = await github.getState({ ...base, github: { repository: 'me/a', account: 'bob' } }, fakeEnv({ responses: { ...remote('https://github.com/me/a'), ...auth } }));
  assert.equal(s.match, false);
  assert.equal(s.fixable, true);
  assert.equal(github.plan({ ...base, github: { account: 'bob' } }, s)[0].scope, 'global');
  s = await github.getState({ ...base, github: { account: 'bob' } }, fakeEnv({ responses: { ...remote('https://github.com/me/a'), 'gh auth status --hostname github.com': { exitCode: 1, stderr: 'You are not logged into any GitHub hosts.' } } }));
  assert.equal(s.fixable, false);
});

test('Supabase: ausente, correto, incorreto, erro de auth', async () => {
  const files = { [f('supabase/.temp/project-ref')]: 'aaaaaaaaaaaaaaaaaaaa\n' };
  const p = { ...base, supabase: { projectRef: 'aaaaaaaaaaaaaaaaaaaa' } };
  let s = await supabase.getState(p, fakeEnv({ tools: [], files }));
  assert.equal(s.match, true);
  assert.equal(s.status, 'warning', 'CLI ausente é sinalizada');
  const listOk = { 'supabase projects list -o json': { stdout: '[{"id":"aaaaaaaaaaaaaaaaaaaa","name":"A"}]' } };
  s = await supabase.getState(p, fakeEnv({ files, responses: listOk }));
  assert.equal(s.status, 'ok');
  s = await supabase.getState({ ...base, supabase: { projectRef: 'bbbbbbbbbbbbbbbbbbbb' } }, fakeEnv({ files, responses: listOk }));
  assert.equal(s.status, 'mismatch');
  assert.equal(s.fixable, true);
  s = await supabase.getState({ ...base, supabase: { projectRef: 'bbbbbbbbbbbbbbbbbbbb' } }, fakeEnv({ files, responses: { 'supabase projects list -o json': { exitCode: 1, stderr: 'Access token not provided. Supply an access token by running supabase login' } } }));
  assert.equal(s.fixable, false);
  assert.ok(s.issues.some((i) => /não está autenticada/.test(i.message)));
});

test('Firebase: ausente, correto, incorreto, fora de diretório Firebase', async () => {
  const files = { [f('firebase.json')]: '{}', [f('.firebaserc')]: '{"projects":{"default":"proj-a"}}' };
  const login = { 'firebase login:list': { stdout: 'Logged in as me@x.com' } };
  const p = { ...base, firebase: { projectId: 'proj-a' } };
  let s = await firebase.getState(p, fakeEnv({ tools: [], files }));
  assert.equal(s.status, 'unavailable');
  s = await firebase.getState(p, fakeEnv({ files, responses: { ...login, 'firebase use --json': { stdout: '{"status":"success","result":"proj-a"}' } } }));
  assert.equal(s.status, 'ok');
  s = await firebase.getState({ ...base, firebase: { projectId: 'proj-b' } }, fakeEnv({ files, responses: { ...login, 'firebase use --json': { stdout: '{"status":"success","result":"proj-a"}' } } }));
  assert.equal(s.status, 'mismatch');
  assert.equal(s.fixable, true);
  s = await firebase.getState(p, fakeEnv({ files: {}, responses: { ...login, 'firebase use --json': { exitCode: 126, stdout: '{"status":"error","error":"firebase use must be run from a Firebase project directory."}' } } }));
  assert.equal(s.fixable, false);
  assert.equal(s.status, 'error');
});

test('Git: branch divergente só é trocada com árvore limpa', async () => {
  const top = { 'git rev-parse --show-toplevel': { stdout: DIR } };
  let s = await git.getState({ ...base, git: { branch: 'main' } }, fakeEnv({ responses: { ...top, 'git status --porcelain=v1 --branch': { stdout: '## dev...origin/dev\n' } } }));
  assert.equal(s.match, false);
  assert.equal(s.fixable, true);
  s = await git.getState({ ...base, git: { branch: 'main' } }, fakeEnv({ responses: { ...top, 'git status --porcelain=v1 --branch': { stdout: '## dev\n M a.js\n' } } }));
  assert.equal(s.fixable, false);
});

// ---------------------------------------------------------------- orquestrador
function fakeAdapter(id, { initial = true, applyOk = true, verifyAfter = true, fixable = true } = {}) {
  let applied = false;
  return {
    id, label: id, section: id, fields: [], isConfigured: () => true, configId: (p) => p[id]?.v ?? null,
    async getState() {
      const match = applied ? verifyAfter : initial;
      return { id, label: id, configured: true, match, status: match ? 'ok' : 'mismatch', fixable, summary: match ? 'novo' : 'velho', observedId: 'velho', fields: [], issues: [] };
    },
    plan: () => [{ op: 'x', from: 'velho', to: 'novo', scope: 'local', description: `trocar ${id}`, command: 'x' }],
    async apply() { applied = applyOk; return { ok: applyOk, message: applyOk ? 'ok' : 'falhou' }; },
  };
}
function contextWith(adapters) {
  const reg = createRegistry(adapters);
  const dir = tmp();
  const projects = new ProjectManager({ file: path.join(dir, 'c.json'), registry: reg });
  const a = projects.create({ name: 'Antigo', directory: DIR });
  const b = projects.create({ name: 'Novo', directory: DIR });
  projects.setActive(a.id);
  const env = fakeEnv();
  const ctx = new ContextService({ projects, registry: reg, createEnv: async () => env, logger: new Logger(), history: new History(path.join(dir, 'h.jsonl')), cache: new TtlCache() });
  return { ctx, projects, a, b };
}

test('troca: sucesso verificado ativa o projeto', async () => {
  const { ctx, projects, b } = contextWith([fakeAdapter('s1', { initial: false }), fakeAdapter('s2', { initial: true })]);
  const r = await ctx.apply(b.id);
  assert.equal(r.outcome, 'success');
  assert.equal(projects.getActive().id, b.id);
  assert.equal(r.steps.length, 1, 'só altera o que diverge');
});

test('troca: comando com exit 0 mas estado não confere = não verificado', async () => {
  const { ctx, b } = contextWith([fakeAdapter('s1', { initial: false, verifyAfter: false }), fakeAdapter('s2', { initial: false })]);
  const r = await ctx.apply(b.id);
  assert.equal(r.outcome, 'partial');
  assert.equal(r.message, 'Contexto parcialmente aplicado.');
  assert.match(r.rollback, /Nenhuma alteração foi revertida/);
});

test('troca: falha total mantém o projeto anterior ativo', async () => {
  const { ctx, projects, a, b } = contextWith([fakeAdapter('s1', { initial: false, applyOk: false })]);
  const r = await ctx.apply(b.id);
  assert.equal(r.outcome, 'failed');
  assert.equal(projects.getActive().id, a.id);
});

test('status: estado inconsistente aponta o projeto que o recurso realmente usa', async () => {
  const { ctx, projects, a, b } = contextWith([fakeAdapter('s1', { initial: false })]);
  projects.update(a.id, { });
  projects.data.projects.find((p) => p.id === a.id).s1 = { v: 'velho' };
  const s = await ctx.status(b.id);
  assert.equal(s.overall, 'inconsistent');
  assert.equal(s.integrations[0].observedProject.name, 'Antigo');
});

// ---------------------------------------------------------------- servidor
test('servidor: exige token, bloqueia Host/Origin estranhos, só serve arquivos fixos', async () => {
  const app = createApp({ dataDir: tmp(), port: 1 });
  const call = (url, headers = {}, method = 'GET') => new Promise((resolve) => {
    const res = { status: 0, headers: {}, body: '', writeHead(s, h) { this.status = s; this.headers = h; }, end(b) { this.body = b; resolve(this); } };
    const req = Object.assign((async function* () {})(), { method, url, headers: { host: '127.0.0.1:1', ...headers } });
    app.handler(req, res);
  });
  assert.equal((await call('/api/bootstrap')).status, 401);
  assert.equal((await call('/api/bootstrap', { 'x-ps-token': app.token })).status, 200);
  assert.equal((await call('/', { host: 'evil.com:1' })).status, 403);
  assert.equal((await call('/api/bootstrap', { 'x-ps-token': app.token, origin: 'https://evil.com' })).status, 403);
  assert.equal((await call('/../package.json')).status, 404);
  assert.equal((await call('/%2e%2e/src/app.js')).status, 404);
  const home = await call('/');
  assert.match(home.headers['Content-Security-Policy'], /script-src 'self'/);
  assert.ok(home.body.includes(app.token));
});

test('correções: avisos trazem correção montada no servidor, só se a ferramenta existir', async () => {
  const { describeFix, FIXES } = await import('../src/lib/fixes.js');
  const p = { directory: DIR, supabase: { projectRef: 'abcdefghijklmnopqrst' }, github: { repository: 'dono/repo' } };
  const s = await supabase.getState(p, fakeEnv({ tools: ['git', 'powershell', 'winget'] }));
  assert.equal(s.issues.find((i) => i.fix)?.fix, 'install-supabase');
  const d = describeFix('install-supabase', p, fakeEnv({ tools: ['powershell'] }));
  assert.equal(d.kind, 'run');
  assert.equal(describeFix('install-gh', p, fakeEnv({ tools: [] })), null, 'sem winget não oferece');
  assert.equal(describeFix('rm -rf', p, fakeEnv()), null);
  assert.deepEqual(FIXES['git-remote-set'].steps(p)[0].args, ['remote', 'set-url', 'origin', 'https://github.com/dono/repo.git']);
  assert.deepEqual(FIXES['supabase-link'].steps(p)[0].args, ['link', '--project-ref', 'abcdefghijklmnopqrst']);
});
