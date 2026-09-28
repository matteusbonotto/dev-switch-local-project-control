import crypto from 'node:crypto';
import { conflict } from './validation.js';
import { describeFix } from './fixes.js';

// Orquestra: estado real → plano (dry run) → aplicação → verificação.
export class ContextService {
  constructor({ projects, registry, createEnv, logger, history, cache }) {
    Object.assign(this, { projects, registry, createEnv, logger, history, cache });
    this.busy = false;
  }

  adapters() {
    const enabled = this.projects.settings().integrations ?? {};
    return this.registry.list().filter((a) => enabled[a.id] !== false);
  }

  #matchProject(adapter, observedId, selfId) {
    if (!observedId) return null;
    const p = this.projects.list().find((x) => x.id !== selfId && adapter.configId(x)?.toLowerCase() === observedId.toLowerCase());
    return p ? { id: p.id, name: p.name } : null;
  }

  async status(projectId, { fresh = false } = {}) {
    const project = this.projects.get(projectId);
    if (fresh) this.cache.clear();
    const env = await this.createEnv();
    const integrations = await Promise.all(this.adapters().map(async (a) => {
      let s;
      try { s = await a.getState(project, env); } catch (err) {
        s = { id: a.id, label: a.label, configured: a.isConfigured(project), match: null, status: 'error', fields: [], issues: [{ level: 'error', message: `Falha inesperada: ${err.message}` }] };
      }
      if (s.match === false) s.observedProject = this.#matchProject(a, s.observedId, project.id);
      for (const i of s.issues) i.fix = i.fix ? describeFix(i.fix, project, env) : null;
      return s;
    }));
    return summarize(project, integrations, env.isDir(project.directory));
  }

  async plan(projectId) {
    const project = this.projects.get(projectId);
    const status = await this.status(projectId, { fresh: true });
    const changes = [], blocked = [], unchanged = [];
    for (const s of status.integrations.filter((x) => x.configured)) {
      if (s.match === true) { unchanged.push({ integration: s.id, label: s.label, summary: s.summary }); continue; }
      const adapter = this.registry.get(s.id);
      if (s.match === false && s.fixable) {
        changes.push(...adapter.plan(project, s).map((c) => ({ ...c, integration: s.id, label: s.label })));
      } else {
        const why = s.issues.find((i) => i.level === 'error') ?? s.issues.find((i) => i.level === 'warning');
        blocked.push({ integration: s.id, label: s.label, reason: why?.message ?? 'Não foi possível verificar esta integração.', hint: why?.hint ?? null });
      }
    }
    const active = this.projects.getActive();
    const settings = this.projects.settings();
    return {
      project: { id: project.id, name: project.name },
      current: active ? { id: active.id, name: active.name } : null,
      status, changes, blocked, unchanged,
      requiresConfirmation: !settings.skipConfirmForLocal || changes.some((c) => c.scope === 'global') || blocked.length > 0,
    };
  }

  async apply(projectId) {
    if (this.busy) throw conflict('Já existe uma troca de contexto em andamento.');
    this.busy = true;
    try {
      const project = this.projects.get(projectId);
      const previous = this.projects.getActive();
      const log = (scope, level, msg, cmd) => this.logger.event(scope, level, msg, cmd);
      log('Contexto', 'info', `Troca iniciada: ${previous?.name ?? '—'} → ${project.name}`);

      const plan = await this.plan(projectId);
      const env = await this.createEnv();
      const steps = [];
      for (const change of plan.changes) {
        log(change.label, 'info', `${change.description}…`);
        let r;
        try { r = await this.registry.get(change.integration).apply(project, change, env); } catch (err) { r = { ok: false, message: err.message }; }
        log(change.label, r.ok ? 'success' : 'error', r.ok ? `Comando executado (${r.message})` : `Falhou: ${r.message}`, r.logId);
        steps.push({ integration: change.integration, label: change.label, description: change.description, ok: r.ok, message: r.message, logId: r.logId ?? null });
      }
      for (const b of plan.blocked) log(b.label, 'warning', `Não corrigido automaticamente: ${b.reason}`);

      // Nunca confiar só no exit code: consulta de novo e compara.
      log('Verificação', 'info', 'Consultando o estado real novamente…');
      const after = await this.status(projectId, { fresh: true });
      const results = after.integrations.filter((s) => s.configured).map((s) => {
        const before = plan.status.integrations.find((b) => b.id === s.id);
        const verified = s.match === true;
        log(s.label, verified ? 'success' : 'error', verified ? `Verificado: ${s.summary ?? 'ok'}` : `Não corresponde ao projeto (${s.summary ?? 'sem valor'})`);
        return { integration: s.id, label: s.label, verified, before: before?.summary ?? null, after: s.summary ?? null, step: steps.find((x) => x.integration === s.id) ?? null };
      });

      const ok = results.filter((r) => r.verified).length;
      const outcome = ok === results.length ? 'success' : ok > 0 ? 'partial' : 'failed';
      const message = outcome === 'success'
        ? (results.length ? `Você está trabalhando no ${project.name}.` : `${project.name} ativado (nenhuma integração configurada para verificar).`)
        : outcome === 'partial' ? 'Contexto parcialmente aplicado.' : 'Não foi possível aplicar o contexto.';
      if (outcome !== 'failed') this.projects.setActive(project.id);
      const applied = steps.filter((s) => s.ok).length;
      const rollback = outcome === 'success' ? null : applied
        ? 'Nenhuma alteração foi revertida automaticamente: as integrações já alteradas continuam apontando para o novo projeto.'
        : 'Nenhuma alteração foi aplicada.';
      log('Contexto', outcome === 'success' ? 'success' : outcome === 'partial' ? 'warning' : 'error', message);

      const rec = {
        id: crypto.randomUUID(), ts: new Date().toISOString(), outcome,
        from: previous ? { id: previous.id, name: previous.name } : null,
        to: { id: project.id, name: project.name },
        integrations: results.map(({ label, verified, before, after }) => ({ label, verified, before, after })),
      };
      this.history.append(rec);
      return { ...rec, message, steps, results, blocked: plan.blocked, rollback, status: after, activeProjectId: this.projects.data.activeProjectId };
    } finally {
      this.busy = false;
    }
  }
}

export function summarize(project, integrations, directoryExists) {
  const relevant = integrations.filter((s) => s.configured);
  const bad = relevant.filter((s) => s.match === false);
  const unknown = relevant.filter((s) => s.match === null);
  let overall, headline;
  if (!directoryExists) [overall, headline] = ['error', 'Diretório do projeto não encontrado.'];
  else if (bad.length) [overall, headline] = ['inconsistent', `Contexto inconsistente: ${bad.map((s) => s.label).join(', ')} não corresponde ao projeto.`];
  else if (unknown.length) [overall, headline] = ['attention', `Não foi possível verificar: ${unknown.map((s) => s.label).join(', ')}.`];
  else if (!relevant.length) [overall, headline] = ['attention', 'Nenhuma integração configurada para este projeto.'];
  else [overall, headline] = ['consistent', 'Todas as integrações configuradas correspondem ao projeto.'];
  return { projectId: project.id, projectName: project.name, directory: project.directory, directoryExists, checkedAt: new Date().toISOString(), overall, headline, integrations };
}
