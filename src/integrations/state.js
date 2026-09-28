// Estrutura comum do estado de uma integração.
// match: true = estado real corresponde ao projeto | false = diverge | null = não foi possível verificar
export function createState(adapter, project) {
  return {
    id: adapter.id, label: adapter.label,
    configured: adapter.isConfigured(project),
    match: null, status: 'ok', fixable: false,
    summary: null, observedId: null,
    fields: [], issues: [], tool: null,
  };
}

export function field(s, label, value, { expected, mono = true } = {}) {
  const match = expected == null ? null : value != null && String(value).toLowerCase() === String(expected).toLowerCase();
  s.fields.push({ label, value: value ?? null, expected: expected ?? null, match, mono });
  return match;
}

// fix: id de uma correção em lib/fixes.js (vira botão "Corrigir" na UI)
export function issue(s, level, message, hint = null, fix = null) {
  s.issues.push({ level, message, hint, fix });
}

export function combine(values) {
  const v = values.filter((x) => x !== undefined);
  if (!v.length) return null;
  if (v.includes(false)) return false;
  if (v.includes(null)) return null;
  return true;
}

export function finalize(s) {
  const serious = s.issues.some((i) => i.level === 'error');
  if (!s.configured) s.status = 'not-configured';
  else if (s.match === false) s.status = 'mismatch';
  else if (s.match === null) s.status = s.tool && !s.tool.installed ? 'unavailable' : serious ? 'error' : 'warning';
  else s.status = s.issues.some((i) => i.level === 'error' || i.level === 'warning') ? 'warning' : 'ok';
  return s;
}

export function toolInfo(t) {
  return t ? { installed: !!t.installed, version: t.version ?? null, label: t.label } : { installed: false, version: null };
}

export const firstLine = (t) => String(t ?? '').split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? '';

export function explain(r, fallback) {
  if (r.error === 'not-installed') return 'CLI não encontrada.';
  if (r.timedOut) return 'O comando excedeu o tempo limite.';
  return firstLine(r.stderr) || firstLine(r.stdout) || fallback;
}
