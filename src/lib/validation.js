import path from 'node:path';

export class AppError extends Error {
  constructor(message, status = 400, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
}
export const notFound = (msg) => new AppError(msg, 404);
export const conflict = (msg) => new AppError(msg, 409);

const CONTROL = /[\u0000-\u001f\u007f]/;

export const validators = {
  githubRepository(v) {
    const [owner, repo] = v.split('/');
    return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/.test(v) && repo !== '.' && repo !== '..' && owner
      ? null : 'Use o formato dono/repositório (ex.: matteusbonotto/bonotroll).';
  },
  githubAccount: (v) => (/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(v) ? null : 'Login do GitHub inválido.'),
  supabaseRef: (v) => (/^[a-z]{20}$/.test(v) ? null : 'O project ref do Supabase tem 20 letras minúsculas.'),
  firebaseProjectId: (v) => (/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(v) ? null : 'Project ID do Firebase inválido (6–30 caracteres, minúsculas, números e hífen).'),
  gitBranch(v) {
    const ok = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,199}$/.test(v) && !v.includes('..') && !v.includes('//')
      && !v.endsWith('/') && !v.endsWith('.') && !v.endsWith('.lock');
    return ok ? null : 'Nome de branch inválido.';
  },
};

function str(value, field, max = 400) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new AppError(`Campo "${field}" deve ser texto.`, 400, { field });
  const v = value.trim();
  if (v.length > max || CONTROL.test(v)) throw new AppError(`Campo "${field}" inválido.`, 400, { field });
  return v;
}

export function validateName(value) {
  const v = str(value, 'name', 80);
  if (!v) throw new AppError('Informe o nome do projeto.', 400, { field: 'name' });
  return v;
}

export function validateDirectory(value, field = 'directory') {
  const v = str(value, field);
  if (!v) throw new AppError('Informe o diretório do projeto.', 400, { field });
  const isWin = process.platform === 'win32';
  const abs = isWin ? /^(?:[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/.test(v) : path.isAbsolute(v);
  if (!abs) throw new AppError('O diretório precisa ser um caminho absoluto (ex.: C:\\Projetos\\MeuApp).', 400, { field });
  const resolved = path.resolve(v);
  return resolved.length > 3 ? resolved.replace(/[\\/]+$/, '') : resolved;
}

// Valida uma seção de integração a partir da definição de campos do adapter.
function validateSection(adapter, value) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new AppError(`Configuração de ${adapter.label} inválida.`);
  const out = {};
  for (const f of adapter.fields) {
    const v = str(value[f.key], `${adapter.section}.${f.key}`, 200);
    if (!v) continue;
    const msg = validators[f.validator]?.(v);
    if (msg) throw new AppError(`${adapter.label} — ${f.label}: ${msg}`, 400, { field: `${adapter.section}.${f.key}` });
    out[f.key] = v;
  }
  return Object.keys(out).length ? out : null;
}

// Aceita apenas chaves conhecidas: qualquer outra (inclusive "token") é descartada.
export function sanitizeProjectInput(input, registry) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError('Dados do projeto inválidos.');
  const out = {};
  if ('name' in input) out.name = validateName(input.name);
  if ('directory' in input) out.directory = validateDirectory(input.directory);
  if ('favorite' in input) out.favorite = input.favorite === true;
  for (const a of registry.list()) if (a.section in input) out[a.section] = validateSection(a, input[a.section]);
  return out;
}

export const DEFAULT_SETTINGS = {
  theme: 'system',
  terminal: 'auto',
  editor: 'code',
  projectsRoot: '',
  skipConfirmForLocal: false,
  integrations: {},
};

const ENUMS = {
  theme: ['system', 'dark', 'light'],
  terminal: ['auto', 'wt', 'pwsh', 'powershell', 'cmd', 'gitBash'],
  editor: ['code', 'none'],
};

export function sanitizeSettings(input, current, registry) {
  if (!input || typeof input !== 'object') throw new AppError('Configurações inválidas.');
  const out = { ...DEFAULT_SETTINGS, ...current };
  for (const [k, values] of Object.entries(ENUMS)) {
    if (k in input) {
      if (!values.includes(input[k])) throw new AppError(`Valor inválido para ${k}.`, 400, { field: k });
      out[k] = input[k];
    }
  }
  if ('projectsRoot' in input) out.projectsRoot = input.projectsRoot ? validateDirectory(input.projectsRoot, 'projectsRoot') : '';
  if ('skipConfirmForLocal' in input) out.skipConfirmForLocal = input.skipConfirmForLocal === true;
  if (input.integrations && typeof input.integrations === 'object') {
    out.integrations = {};
    for (const a of registry.list()) out.integrations[a.id] = input.integrations[a.id] !== false;
  }
  return out;
}
