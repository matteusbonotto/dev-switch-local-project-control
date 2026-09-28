import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { sanitize, truncate } from './sanitize.js';
import { AppError, notFound, sanitizeProjectInput, sanitizeSettings, DEFAULT_SETTINGS } from './validation.js';

export function writeJsonAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  fs.renameSync(tmp, file);
}

function readJson(file) {
  try {
    return { data: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    if (e.code === 'ENOENT') return { data: null };
    // Arquivo corrompido: preserva uma cópia em vez de sobrescrever silenciosamente.
    const backup = `${file}.corrupt-${Date.now()}`;
    try { fs.copyFileSync(file, backup); } catch {}
    return { data: null, warning: `Configuração ilegível; cópia salva em ${backup}` };
  }
}

export class ProjectManager {
  constructor({ file, registry, defaults = {} }) {
    this.file = file;
    this.registry = registry;
    const { data, warning } = readJson(file);
    this.loadWarning = warning ?? null;
    this.data = { version: 1, activeProjectId: null, settings: { ...DEFAULT_SETTINGS, ...defaults }, projects: [] };
    if (data) {
      this.data.activeProjectId = data.activeProjectId ?? null;
      try { this.data.settings = sanitizeSettings(data.settings ?? {}, this.data.settings, registry); } catch {}
      for (const p of data.projects ?? []) {
        try {
          const clean = sanitizeProjectInput(p, registry);
          this.data.projects.push(stripNulls({ id: String(p.id || crypto.randomUUID()), createdAt: p.createdAt, updatedAt: p.updatedAt, favorite: false, ...clean }));
        } catch { /* projeto inválido é ignorado */ }
      }
      if (!this.data.projects.some((p) => p.id === this.data.activeProjectId)) this.data.activeProjectId = null;
    }
  }

  save() { writeJsonAtomic(this.file, this.data); }
  list() { return this.data.projects; }
  settings() { return this.data.settings; }
  get(id) {
    const p = this.data.projects.find((x) => x.id === id);
    if (!p) throw notFound('Projeto não encontrado.');
    return p;
  }
  getActive() { return this.data.projects.find((p) => p.id === this.data.activeProjectId) ?? null; }

  #checkName(name, selfId) {
    if (this.data.projects.some((p) => p.id !== selfId && p.name.toLowerCase() === name.toLowerCase()))
      throw new AppError(`Já existe um projeto chamado "${name}".`, 409, { field: 'name' });
  }

  create(input) {
    const clean = sanitizeProjectInput(input, this.registry);
    if (!clean.name) throw new AppError('Informe o nome do projeto.', 400, { field: 'name' });
    if (!clean.directory) throw new AppError('Informe o diretório do projeto.', 400, { field: 'directory' });
    this.#checkName(clean.name);
    const now = new Date().toISOString();
    const project = stripNulls({ id: crypto.randomUUID(), favorite: false, ...clean, createdAt: now, updatedAt: now });
    this.data.projects.push(project);
    this.save();
    return project;
  }

  update(id, patch) {
    const p = this.get(id);
    const clean = sanitizeProjectInput(patch, this.registry);
    if (clean.name) this.#checkName(clean.name, id);
    Object.assign(p, clean, { updatedAt: new Date().toISOString() });
    stripNulls(p);
    this.save();
    return p;
  }

  remove(id) {
    this.get(id);
    this.data.projects = this.data.projects.filter((p) => p.id !== id);
    if (this.data.activeProjectId === id) this.data.activeProjectId = null;
    this.save();
  }

  setActive(id) {
    if (id !== null) this.get(id);
    this.data.activeProjectId = id;
    this.save();
  }

  updateSettings(patch) {
    this.data.settings = sanitizeSettings(patch, this.data.settings, this.registry);
    this.save();
    return this.data.settings;
  }

  exportData() {
    return {
      format: 'project-switcher', version: 1, exportedAt: new Date().toISOString(),
      settings: this.data.settings,
      projects: this.data.projects.map(({ id, createdAt, updatedAt, ...rest }) => rest),
    };
  }

  importData(payload, mode = 'merge') {
    if (!payload || payload.format !== 'project-switcher' || !Array.isArray(payload.projects))
      throw new AppError('Arquivo não reconhecido: esperado um export do Project Switcher.');
    const result = { added: 0, skipped: [], errors: [] };
    const incoming = [];
    for (const raw of payload.projects.slice(0, 500)) {
      try {
        const clean = sanitizeProjectInput(raw, this.registry);
        if (!clean.name || !clean.directory) throw new Error('nome e diretório são obrigatórios');
        incoming.push(clean);
      } catch (e) { result.errors.push(`${raw?.name ?? '?'}: ${e.message}`); }
    }
    if (mode === 'replace') { this.data.projects = []; this.data.activeProjectId = null; }
    const now = new Date().toISOString();
    for (const clean of incoming) {
      if (this.data.projects.some((p) => p.name.toLowerCase() === clean.name.toLowerCase())) { result.skipped.push(clean.name); continue; }
      this.data.projects.push(stripNulls({ id: crypto.randomUUID(), favorite: false, ...clean, createdAt: now, updatedAt: now }));
      result.added++;
    }
    this.save();
    return result;
  }
}

function stripNulls(obj) {
  for (const k of Object.keys(obj)) if (obj[k] == null) delete obj[k];
  return obj;
}

// Log técnico (comandos) + eventos legíveis. Tudo passa por sanitize().
export class Logger {
  constructor({ file, max = 800 } = {}) {
    this.file = file; this.max = max; this.entries = []; this.seq = 0;
  }
  #push(entry) {
    entry.seq = ++this.seq;
    entry.ts = new Date().toISOString();
    this.entries.push(entry);
    if (this.entries.length > this.max) this.entries.shift();
    if (this.file) {
      try {
        fs.mkdirSync(path.dirname(this.file), { recursive: true });
        if (fs.existsSync(this.file) && fs.statSync(this.file).size > 2 * 1024 * 1024) fs.renameSync(this.file, `${this.file}.1`);
        fs.appendFileSync(this.file, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
      } catch {}
    }
    return entry.seq;
  }
  command(r) {
    return this.#push({
      type: 'command', tool: r.tool ?? null, command: sanitize(r.command), cwd: r.cwd ?? null,
      exitCode: r.exitCode ?? null, durationMs: r.durationMs ?? 0, timedOut: !!r.timedOut, error: r.error ?? null,
      stdout: truncate(sanitize(r.stdout ?? '')), stderr: truncate(sanitize(r.stderr ?? '')),
    });
  }
  event(scope, level, message, commandId = null) {
    return this.#push({ type: 'event', scope, level, message: sanitize(message), commandId });
  }
  since(seq = 0) { return this.entries.filter((e) => e.seq > seq); }
}

export class History {
  constructor(file) { this.file = file; }
  append(rec) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, `${JSON.stringify(rec)}\n`, { mode: 0o600 });
  }
  list(limit = 100) {
    try {
      return fs.readFileSync(this.file, 'utf8').trim().split('\n').slice(-limit).reverse()
        .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    } catch { return []; }
  }
}

export class TtlCache {
  constructor() { this.map = new Map(); }
  wrap(key, ttl, fn) {
    const hit = this.map.get(key);
    if (hit && hit.expires > Date.now()) return hit.promise;
    const promise = Promise.resolve().then(fn);
    this.map.set(key, { promise, expires: Date.now() + ttl });
    promise.catch(() => this.map.delete(key));
    return promise;
  }
  clear(prefix = '') { for (const k of [...this.map.keys()]) if (k.startsWith(prefix)) this.map.delete(k); }
}
