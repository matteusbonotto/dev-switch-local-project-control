// Project Switcher — UI. Todo conteúdo dinâmico entra via textContent (nunca innerHTML).
const TOKEN = document.querySelector('meta[name="ps-token"]')?.content ?? '';

const S = {
  app: null, integrations: [], settings: {}, projects: [], activeProjectId: null,
  selectedId: null, view: 'project', search: '',
  statuses: {}, logs: [], logSeq: 0, logTab: 'events', logOpen: true,
  health: null, history: null,
};

// ---------------------------------------------------------------- API
async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: { 'x-ps-token': TOKEN, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error?.message ?? `Erro ${res.status}`), { field: data.error?.field });
  return data;
}

// ---------------------------------------------------------------- DOM helpers
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  add(el, children);
  return el;
}
function set(el, ...children) { el.replaceChildren(); add(el, children); return el; }
function add(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
const ICONS = {
  check: '<path d="M20 6 9 17l-5-5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', minus: '<path d="M5 12h14"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  branch: '<circle cx="6" cy="5" r="2.5"/><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="7" r="2.5"/><path d="M6 7.5v9M18 9.5a6 6 0 0 1-6 6H8"/>',
  repo: '<path d="M4 19.5V5a2 2 0 0 1 2-2h14v15H6.5A2.5 2.5 0 0 0 4 20.5 2.5 2.5 0 0 0 6.5 23H20v-5"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>', flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  terminal: '<path d="m4 17 6-5-6-5M12 19h8"/>', code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M3 21v-5h5"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>', trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>', loader: '<path d="M21 12a9 9 0 1 1-6.2-8.6"/>', scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/>',
};
function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('class', `i ${cls}`);
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] ?? ''; // constantes internas
  return s;
}
const STATUS = {
  ok: ['OK', 'check', 'ok'], warning: ['Atenção', 'alert', 'warn'], mismatch: ['Divergente', 'x', 'err'], error: ['Erro', 'x', 'err'],
  unavailable: ['Indisponível', 'minus', 'muted'], 'not-configured': ['Não configurado', 'minus', 'muted'], missing: ['Ausente', 'x', 'err'],
};
const OVERALL = {
  consistent: ['Verificado', 'check', 'ok'], inconsistent: ['Contexto inconsistente', 'alert', 'err'],
  attention: ['Verificação incompleta', 'alert', 'warn'], error: ['Erro', 'x', 'err'],
};
const badge = ([text, ic, tone], big) => h('span', { class: `badge tone-${tone}${big ? ' big' : ''}` }, icon(ic), text);
const spinner = () => icon('loader', 'spin');
const time = (iso) => new Date(iso).toLocaleTimeString('pt-BR');
const dateTime = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const project = (id) => S.projects.find((p) => p.id === id);
const integrationIcon = (id) => S.integrations.find((i) => i.id === id)?.icon ?? 'info';

function toast(msg, err = false) {
  const t = h('div', { class: `toast${err ? ' err' : ''}`, role: 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), err ? 6000 : 3000);
}
async function guard(fn) {
  try { return await fn(); } catch (e) { toast(e.message, true); return undefined; }
}

// ---------------------------------------------------------------- tema
function applyTheme() {
  const t = S.settings.theme ?? 'system';
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

// ---------------------------------------------------------------- dados
async function loadBootstrap() {
  const b = await api('GET', '/api/bootstrap');
  Object.assign(S, { app: b.app, integrations: b.integrations, settings: b.settings, projects: b.projects, activeProjectId: b.activeProjectId });
  if (b.warning) toast(b.warning, true);
  if (!S.selectedId || !project(S.selectedId)) S.selectedId = S.activeProjectId ?? S.projects[0]?.id ?? null;
  applyTheme();
}

async function loadStatus(id, fresh = false) {
  if (!id) return;
  const prev = S.statuses[id];
  S.statuses[id] = { ...prev, loading: true };
  renderAll();
  try {
    const data = await api('GET', `/api/projects/${id}/status${fresh ? '?fresh=1' : ''}`);
    S.statuses[id] = { data, loading: false };
  } catch (e) {
    S.statuses[id] = { ...prev, loading: false, error: e.message };
  }
  renderAll();
}

// ---------------------------------------------------------------- render: topbar
function renderTop() {
  const pill = document.getElementById('active-pill');
  set(pill);
  const active = project(S.activeProjectId);
  pill.className = 'active-pill';
  if (!active) {
    add(pill, [h('span', { class: 'lbl' }, 'ATIVO'), h('span', { class: 'name muted' }, 'Nenhum projeto ativo')]);
  } else {
    const st = S.statuses[active.id];
    const ov = st?.data?.overall;
    if (ov === 'inconsistent' || ov === 'error') pill.classList.add('tone-err');
    else if (ov === 'attention') pill.classList.add('tone-warn');
    add(pill, [h('span', { class: 'lbl' }, '● ATIVO'), h('span', { class: 'name' }, active.name),
      st?.loading && !st.data ? h('span', { class: 'badge tone-muted' }, spinner(), 'verificando') : ov ? badge(OVERALL[ov]) : null]);
  }
  pill.title = 'Ir para o projeto ativo';
  pill.onclick = () => { if (active) select(active.id); };

  const nav = document.getElementById('top-actions');
  const btn = (view, ic, label) => h('button', { class: 'icon-btn', title: label, 'aria-label': label, 'aria-current': S.view === view ? 'page' : null, onclick: () => go(view) }, icon(ic));
  const themeNext = { system: 'dark', dark: 'light', light: 'system' };
  const themeIcon = { system: 'monitor', dark: 'moon', light: 'sun' }[S.settings.theme ?? 'system'];
  set(nav, 
    btn('health', 'pulse', 'Health check'), btn('history', 'history', 'Histórico'), btn('settings', 'settings', 'Configurações'),
    h('button', { class: 'icon-btn opt', title: `Tema: ${S.settings.theme}`, 'aria-label': 'Alternar tema', onclick: () => saveSettings({ theme: themeNext[S.settings.theme ?? 'system'] }) }, icon(themeIcon)),
  );
  const nt = document.getElementById('nav-toggle');
  nt.replaceChildren(icon('menu'));
  nt.onclick = () => document.getElementById('app').classList.toggle('nav-open');
}

// ---------------------------------------------------------------- render: sidebar
function renderSidebar() {
  const side = document.getElementById('sidebar');
  let input = side.querySelector('#search');
  if (!input) {
    input = h('input', { id: 'search', type: 'text', placeholder: 'Buscar projeto…', 'aria-label': 'Buscar projeto', autocomplete: 'off',
      oninput: (e) => { S.search = e.target.value; renderList(); },
      onkeydown: (e) => { if (e.key === 'Enter') { const f = filtered()[0]; if (f) select(f.id); } if (e.key === 'Escape') { e.target.value = ''; S.search = ''; renderList(); } } });
    side.append(
      h('div', { class: 'search' }, icon('search'), input, h('kbd', null, 'Ctrl K')),
      h('ul', { class: 'proj-list', id: 'proj-list' }),
      h('div', { class: 'side-foot' },
        h('button', { class: 'btn primary', onclick: () => openProjectForm() }, icon('plus'), 'Novo projeto'),
        h('button', { class: 'btn', onclick: () => openScan() }, icon('scan'), 'Importar de uma pasta')),
    );
  }
  renderList();
}
function filtered() {
  const q = S.search.trim().toLowerCase();
  const list = S.projects.filter((p) => !q || [p.name, p.directory, p.github?.repository, p.supabase?.projectRef, p.firebase?.projectId]
    .some((v) => v?.toLowerCase().includes(q)));
  return list.sort((a, b) => (b.favorite - a.favorite) || a.name.localeCompare(b.name, 'pt-BR'));
}
function renderList() {
  const ul = document.getElementById('proj-list');
  const list = filtered();
  const item = (p) => {
    const active = p.id === S.activeProjectId;
    return h('li', { class: `proj-item${p.id === S.selectedId ? ' selected' : ''}${active ? ' active' : ''}` },
      h('button', { class: 'proj-main', onclick: () => select(p.id), 'aria-current': p.id === S.selectedId ? 'true' : null },
        h('span', { class: 'dot', 'aria-hidden': 'true' }, active ? '●' : '○'),
        h('span', { class: 'nm' }, p.name),
        active ? h('span', { class: 'badge active-tag' }, 'ATIVO') : h('span'),
        h('span', { class: 'sub' }, p.github?.repository ?? p.directory)),
      h('button', { class: `star${p.favorite ? ' on' : ''}`, title: p.favorite ? 'Remover dos favoritos' : 'Favoritar', 'aria-label': 'Favorito', 'aria-pressed': String(!!p.favorite),
        onclick: () => guard(async () => { Object.assign(p, await api('PUT', `/api/projects/${p.id}`, { favorite: !p.favorite })); renderList(); }) }, icon('star')));
  };
  const fav = list.filter((p) => p.favorite), rest = list.filter((p) => !p.favorite);
  set(ul, 
    fav.length ? h('li', { class: 'group-title' }, '★ Favoritos') : null, fav.map(item),
    fav.length && rest.length ? h('li', { class: 'group-title' }, 'Projetos') : null, rest.map(item),
    !list.length ? h('li', { class: 'muted small group-title' }, S.projects.length ? 'Nenhum resultado.' : 'Nenhum projeto ainda.') : null,
  );
}

// ---------------------------------------------------------------- render: main
function renderMain() {
  const main = document.getElementById('main');
  let content;
  if (S.view === 'health') content = viewHealth();
  else if (S.view === 'history') content = viewHistory();
  else if (S.view === 'settings') content = viewSettings();
  else if (!S.projects.length) content = viewWelcome();
  else content = viewProject(project(S.selectedId) ?? S.projects[0]);
  set(main, content);
}

function viewWelcome() {
  return h('div', { class: 'page' }, h('div', { class: 'card empty' },
    h('h1', null, 'Nenhum projeto cadastrado'),
    h('p', { class: 'muted' }, 'Cadastre um projeto a partir da pasta dele — Git, GitHub, Supabase e Firebase são detectados automaticamente.'),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn primary', onclick: () => openProjectForm() }, icon('plus'), 'Novo projeto'),
      h('button', { class: 'btn', onclick: () => openScan() }, icon('scan'), 'Importar de uma pasta'))));
}

function viewProject(p) {
  const st = S.statuses[p.id];
  const data = st?.data;
  const isActive = p.id === S.activeProjectId;
  const ov = data?.overall;

  const hero = h('section', { class: 'card hero' },
    h('div', { class: 'hero-top' },
      h('div', null,
        h('div', { class: 'eyebrow' }, isActive ? h('span', { class: 'badge active-tag' }, '● PROJETO ATIVO') : h('span', { class: 'badge tone-muted' }, '○ Não ativo')),
        h('h1', null, p.name),
        h('div', { class: 'dirline' }, icon('folder'), h('span', { class: 'mono' }, p.directory),
          h('button', { class: 'btn ghost sm', title: 'Copiar caminho', onclick: () => navigator.clipboard.writeText(p.directory).then(() => toast('Caminho copiado.')) }, icon('copy'), 'Copiar'))),
      h('div', { class: 'hero-right' },
        st?.loading ? h('span', { class: 'badge tone-muted big' }, spinner(), 'Verificando estado real…') : ov ? badge(OVERALL[ov], true) : null,
        data ? h('span', { class: 'small muted' }, `verificado às ${time(data.checkedAt)}`) : null,
        h('div', { class: 'row-actions' },
          h('button', { class: 'btn', onclick: () => loadStatus(p.id, true), disabled: st?.loading }, icon('refresh'), 'Verificar'),
          !isActive ? h('button', { class: 'btn primary', onclick: () => openSwitch(p.id) }, icon('swap'), 'Trocar para este projeto')
            : ov === 'inconsistent' ? h('button', { class: 'btn danger-fill', onclick: () => openSwitch(p.id) }, icon('refresh'), 'Corrigir automaticamente') : null))),
    data ? h('div', { class: 'glance' }, data.integrations.filter((s) => s.configured).map((s) =>
      h('div', { class: 'glance-item' }, h('span', { class: `badge tone-${STATUS[s.status][2]}`, title: STATUS[s.status][0] }, icon(STATUS[s.status][1])), h('b', null, s.label),
        h('span', { class: 'v', title: s.summary ?? '' }, s.summary ?? '—')))) : null,
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn', onclick: () => openIn(p, 'folder') }, icon('folder'), 'Abrir pasta'),
      h('button', { class: 'btn', onclick: () => openIn(p, 'terminal') }, icon('terminal'), 'Terminal'),
      S.settings.editor !== 'none' ? h('button', { class: 'btn', onclick: () => openIn(p, 'editor') }, icon('code'), 'VS Code') : null),
  );

  let banner = null;
  if (st?.error) banner = h('div', { class: 'banner tone-err' }, h('span', { class: 'bi' }, icon('x')), h('div', null, h('h2', null, 'Falha ao consultar o estado'), st.error));
  else if (ov === 'inconsistent' || ov === 'error') {
    const bad = data.integrations.filter((s) => s.configured && s.match !== true);
    banner = h('div', { class: 'banner tone-err', role: 'alert' }, h('span', { class: 'bi' }, icon('alert')),
      h('div', { class: 'grow' },
        h('h2', null, ov === 'error' ? 'ERRO NO PROJETO' : '⚠ CONTEXTO INCONSISTENTE'),
        h('div', null, data.headline),
        h('ul', null, data.integrations.filter((s) => s.configured).map((s) => h('li', null,
          h('b', null, s.label), ' → ',
          s.match === true ? `✓ ${p.name}` : s.observedProject ? `✕ ${s.observedProject.name} (${s.summary})` : `✕ ${s.summary ?? 'nenhum'}${s.match === null ? ' (não verificado)' : ''}`)))),
      bad.some((s) => s.match === false) ? h('button', { class: 'btn danger-fill', onclick: () => openSwitch(p.id) }, 'Corrigir automaticamente') : null);
  } else if (ov === 'attention') {
    banner = h('div', { class: 'banner tone-warn' }, h('span', { class: 'bi' }, icon('alert')), h('div', null, h('h2', null, 'Verificação incompleta'), data.headline));
  }

  const cards = S.integrations.filter((m) => S.settings.integrations?.[m.id] !== false).map((m) => integrationCard(p, m, data?.integrations.find((s) => s.id === m.id), st?.loading));

  return h('div', { class: 'page' }, hero, banner,
    h('div', { class: 'section-title' }, 'Integrações'), h('div', { class: 'cards' }, cards),
    h('div', { class: 'section-title' }, 'Projeto'),
    h('section', { class: 'card panel' },
      h('dl', { class: 'kv' }, h('dt', null, 'Nome'), h('dd', null, p.name), h('dt', null, 'Diretório'), h('dd', { class: 'mono' }, p.directory)),
      h('div', { class: 'row-actions', style: null }, h('span'),
        h('button', { class: 'btn sm', onclick: () => openBasicEdit(p) }, icon('edit'), 'Editar nome/diretório'),
        isActive ? h('button', { class: 'btn sm', onclick: () => guard(async () => { await api('POST', '/api/deactivate', {}); S.activeProjectId = null; renderAll(); }) }, 'Desmarcar como ativo') : null,
        h('button', { class: 'btn sm danger', onclick: () => confirmDelete(p) }, icon('trash'), 'Excluir projeto'))));
}

function integrationCard(p, meta, s, loading) {
  const cfg = p[meta.section];
  const cfgText = cfg ? meta.fields.filter((f) => cfg[f.key]).map((f) => `${f.label}: ${cfg[f.key]}`).join(' · ') : 'Sem configuração';
  let body;
  if (!s && loading) body = [h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' }), h('div', { class: 'skeleton' })];
  else if (!s) body = h('p', { class: 'muted small' }, 'Clique em Verificar para consultar o estado.');
  else body = [
    s.fields.length ? h('dl', { class: 'kv' }, s.fields.map((f) => [
      h('dt', null, f.label),
      h('dd', { class: f.mono ? 'mono' : null },
        f.match === true ? h('span', { class: 'ok-mark', 'aria-label': 'corresponde' }, '✓ ') : f.match === false ? h('span', { class: 'bad-mark', 'aria-label': 'diverge' }, '✕ ') : null,
        f.value ?? h('span', { class: 'muted' }, '—'),
        f.match === false ? h('span', { class: 'exp' }, `esperado: ${f.expected}`) : null)])) : null,
    s.observedProject ? h('div', { class: 'points' }, `Aponta para o projeto ${s.observedProject.name}`) : null,
    s.issues.length ? h('ul', { class: 'issues' }, s.issues.map((i) => h('li', { class: `lv-${i.level}` },
      icon(i.level === 'info' ? 'info' : 'alert'), h('div', null, i.message, i.hint && !i.fix ? h('code', null, i.hint) : null,
        i.fix ? h('div', { class: 'fix-row' }, h('button', { class: 'btn sm primary', onclick: () => openFix(p, s, i.fix) }, icon('check'), `Corrigir: ${i.fix.label}`)) : null)))) : null,
    s.tool ? h('div', { class: 'small muted' }, s.tool.installed ? `${s.tool.label ?? 'CLI'} ${s.tool.version ? `v${s.tool.version}` : ''}` : `${s.tool.label ?? 'CLI'} não encontrada`) : null,
  ];
  return h('article', { class: `card icard st-${s?.status ?? 'none'}` },
    h('div', { class: 'icard-head' }, h('span', { class: 'ic' }, icon(meta.icon)), h('h3', null, meta.label),
      s ? badge(STATUS[s.status]) : loading ? h('span', { class: 'badge tone-muted' }, spinner()) : null),
    h('div', { class: 'icard-body' }, body),
    h('div', { class: 'icard-foot' }, h('span', { class: 'cfg', title: cfgText }, cfgText),
      s?.status === 'mismatch' && s.fixable ? h('button', { class: 'btn sm primary', onclick: () => openSwitch(p.id) }, icon('check'), 'Corrigir') : null,
      h('button', { class: 'btn sm', onclick: () => openSectionEdit(p, meta) }, icon('edit'), cfg ? 'Editar' : 'Configurar')));
}

// ---------------------------------------------------------------- health / history / settings
function viewHealth() {
  if (!S.health) { loadHealth(false); return h('div', { class: 'page' }, h('div', { class: 'card panel' }, spinner(), ' Executando diagnóstico…')); }
  const groups = {};
  for (const c of S.health.checks) (groups[c.group] ??= []).push(c);
  return h('div', { class: 'page' },
    h('div', { class: 'hero-top' }, h('div', null, h('h1', null, 'Health check'), h('div', { class: 'small muted' }, `executado às ${time(S.health.checkedAt)}`)),
      h('div', { class: 'hero-right' }, h('button', { class: 'btn primary', onclick: () => loadHealth(true), disabled: S.health.loading }, S.health.loading ? spinner() : icon('refresh'), 'Executar diagnóstico novamente'))),
    Object.entries(groups).map(([g, list]) => h('section', { class: 'card panel' }, h('h2', null, g),
      h('table', { class: 'table' }, h('tbody', null, list.map((c) => h('tr', null,
        h('td', null, badge(STATUS[c.status] ?? STATUS.warning)), h('td', null, h('b', null, c.label)),
        h('td', { class: 'mono' }, c.value ?? ''),
        h('td', { class: 'small muted' }, c.detail ?? '',
          c.hint?.command ? h('code', { class: 'mono' }, ` ${c.hint.command}`) : null,
          c.hint?.url ? [' ', h('a', { href: c.hint.url, target: '_blank', rel: 'noopener noreferrer' }, 'Como instalar')] : null))))))));
}
async function loadHealth(force) {
  if (S.health) S.health.loading = true;
  renderMain();
  const r = await guard(() => api('GET', `/api/health${force ? '?refresh=1' : ''}`));
  S.health = r ?? S.health ?? { checks: [], checkedAt: new Date().toISOString() };
  S.health.loading = false;
  if (S.view === 'health') renderMain();
}

function viewHistory() {
  if (!S.history) { guard(async () => { S.history = (await api('GET', '/api/history')).items; renderMain(); }); return h('div', { class: 'page' }, h('div', { class: 'card panel' }, spinner(), ' Carregando…')); }
  const O = { success: ['Verificado', 'check', 'ok'], partial: ['Parcial', 'alert', 'warn'], failed: ['Falhou', 'x', 'err'] };
  return h('div', { class: 'page' }, h('h1', null, 'Histórico de trocas'),
    h('section', { class: 'card panel' }, !S.history.length ? h('p', { class: 'muted' }, 'Nenhuma troca de contexto registrada.') :
      h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Quando'), h('th', null, 'Troca'), h('th', null, 'Resultado'), h('th', null, 'Integrações'))),
        h('tbody', null, S.history.map((r) => h('tr', null,
          h('td', { class: 'small' }, dateTime(r.ts)), h('td', null, `${r.from?.name ?? '—'} → `, h('b', null, r.to.name)),
          h('td', null, badge(O[r.outcome])),
          h('td', { class: 'small' }, r.integrations.map((i) => h('div', null, `${i.verified ? '✓' : '✕'} ${i.label}: ${i.after ?? '—'}`)))))))));
}

function viewSettings() {
  const s = S.settings;
  const sel = (key, label, opts) => h('div', { class: 'field' }, h('label', { for: `set-${key}` }, label),
    h('select', { id: `set-${key}`, onchange: (e) => saveSettings({ [key]: e.target.value }) }, opts.map(([v, t]) => h('option', { value: v, selected: s[key] === v }, t))));
  const rootInput = h('input', { type: 'text', id: 'set-root', value: s.projectsRoot ?? '', placeholder: 'C:\\Projetos' });
  return h('div', { class: 'page' }, h('h1', null, 'Configurações'),
    h('section', { class: 'card panel form' },
      sel('theme', 'Tema', [['system', 'Sistema'], ['dark', 'Escuro'], ['light', 'Claro']]),
      sel('terminal', 'Terminal preferido', [['auto', 'Automático (Windows Terminal → PowerShell 7 → PowerShell → CMD)'], ['wt', 'Windows Terminal'], ['pwsh', 'PowerShell 7'], ['powershell', 'Windows PowerShell'], ['cmd', 'Prompt de Comando'], ['gitBash', 'Git Bash']]),
      sel('editor', 'Editor', [['code', 'VS Code'], ['none', 'Nenhum']]),
      h('div', { class: 'field' }, h('label', { for: 'set-root' }, 'Pasta padrão de projetos'),
        h('div', { class: 'inline' }, rootInput, h('button', { class: 'btn', onclick: () => saveSettings({ projectsRoot: rootInput.value }) }, 'Salvar')),
        h('span', { class: 'help' }, 'Usada em "Importar de uma pasta".')),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.skipConfirmForLocal, onchange: (e) => saveSettings({ skipConfirmForLocal: e.target.checked }) }),
        'Não pedir confirmação quando todas as alterações forem locais ao diretório (mudanças globais, como conta do gh, sempre pedem)'),
      h('fieldset', { class: 'fieldset' }, h('legend', null, 'Integrações habilitadas'),
        S.integrations.map((m) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.integrations?.[m.id] !== false,
          onchange: (e) => saveSettings({ integrations: { ...Object.fromEntries(S.integrations.map((x) => [x.id, s.integrations?.[x.id] !== false])), [m.id]: e.target.checked } }) }),
        h('b', null, m.label), h('span', { class: 'muted small' }, ` — ${m.description}`))))),
    h('section', { class: 'card panel form' }, h('h2', null, 'Backup'),
      h('p', { class: 'muted small' }, 'O arquivo contém apenas referências (nomes, diretórios, IDs). Nenhum token ou credencial é exportado.'),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn', onclick: exportConfig }, 'Exportar configuração'),
        h('button', { class: 'btn', onclick: () => importConfig('merge') }, 'Importar (mesclar)'),
        h('button', { class: 'btn danger', onclick: () => importConfig('replace') }, 'Importar (substituir tudo)'))),
    h('p', { class: 'small muted' }, `Project Switcher v${S.app?.version} · dados em `, h('span', { class: 'mono' }, S.app?.dataDir ?? '')));
}
async function saveSettings(patch) {
  const r = await guard(() => api('PUT', '/api/settings', patch));
  if (r) { S.settings = r; applyTheme(); renderAll(); toast('Configurações salvas.'); }
}
async function exportConfig() {
  const data = await guard(() => api('GET', '/api/export'));
  if (!data) return;
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: `project-switcher-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(a.href);
}
function importConfig(mode) {
  const input = h('input', { type: 'file', accept: 'application/json,.json' });
  input.onchange = () => guard(async () => {
    const file = input.files[0];
    if (!file) return;
    if (mode === 'replace' && !confirm('Substituir TODOS os projetos cadastrados pelos do arquivo?')) return;
    const r = await api('POST', '/api/import', { data: JSON.parse(await file.text()), mode });
    await loadBootstrap();
    renderAll();
    toast(`${r.added} projeto(s) importado(s)${r.skipped.length ? `, ${r.skipped.length} já existente(s)` : ''}${r.errors.length ? `, ${r.errors.length} inválido(s)` : ''}.`);
  });
  input.click();
}

// ---------------------------------------------------------------- logs
function renderLogs() {
  const el = document.getElementById('logs');
  el.classList.toggle('collapsed', !S.logOpen);
  const tab = (id, label) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(S.logTab === id), onclick: () => { S.logTab = id; S.logOpen = true; renderLogs(); } }, label);
  const events = S.logs.filter((e) => e.type === 'event');
  const cmds = S.logs.filter((e) => e.type === 'command');
  const LV = { success: 'check', error: 'x', warning: 'alert', info: 'info' };
  const body = h('div', { class: 'logs-body', id: 'logs-body' },
    S.logTab === 'events'
      ? (events.length ? events.map((e) => h('div', { class: `log-row lv-${e.level}` }, h('span', { class: 'ts' }, time(e.ts)), h('span', { class: 'sc' }, e.scope),
        h('span', { class: 'lvi' }, icon(LV[e.level] ?? 'info')), h('span', { class: 'msg' }, e.message),
        e.commandId ? h('button', { class: 'link', onclick: () => showCommand(e.commandId) }, 'Ver detalhes') : h('span'))) : h('div', { class: 'muted' }, 'Sem eventos ainda.'))
      : (cmds.length ? cmds.map((c) => h('button', { class: 'cmd-row', onclick: () => showCommand(c.seq) }, h('span', { class: 'muted' }, time(c.ts)),
        h('span', null, `> ${c.command}`), h('span', { class: c.exitCode === 0 ? 'ok-mark' : 'bad-mark' }, c.exitCode === 0 ? '✓ 0' : `✕ ${c.exitCode ?? c.error}`),
        h('span', { class: 'muted' }, `${c.durationMs} ms`))) : h('div', { class: 'muted' }, 'Nenhum comando executado ainda.')));
  set(el, 
    h('div', { class: 'logs-head', role: 'tablist' }, h('b', { class: 'small' }, 'Terminal / Logs'), tab('events', `Eventos (${events.length})`), tab('commands', `Comandos (${cmds.length})`),
      h('button', { class: 'icon-btn', style: null, 'aria-label': S.logOpen ? 'Recolher logs' : 'Expandir logs', title: S.logOpen ? 'Recolher' : 'Expandir', onclick: () => { S.logOpen = !S.logOpen; renderLogs(); } }, icon('chevron'))),
    body);
  body.scrollTop = body.scrollHeight;
}
async function pollLogs() {
  try {
    const { entries } = await api('GET', `/api/logs?since=${S.logSeq}`);
    if (entries.length) {
      S.logs.push(...entries);
      S.logs = S.logs.slice(-600);
      S.logSeq = entries.at(-1).seq;
      renderLogs();
      onLiveEntries?.(entries);
    }
  } catch { /* servidor offline: tenta de novo */ }
}
let onLiveEntries = null;
function showCommand(seq) {
  const c = S.logs.find((e) => e.seq === seq);
  const d = document.getElementById('detail');
  if (!c) return toast('Detalhes do comando não estão mais disponíveis.', true);
  set(d, 
    h('div', { class: 'modal-head' }, h('h2', null, 'Detalhes do comando'), h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onclick: () => d.close() }, icon('x'))),
    h('div', { class: 'modal-body' },
      h('dl', { class: 'kv' }, h('dt', null, 'Comando'), h('dd', { class: 'mono' }, c.command), h('dt', null, 'Diretório'), h('dd', { class: 'mono' }, c.cwd ?? '—'),
        h('dt', null, 'Exit code'), h('dd', null, String(c.exitCode ?? c.error ?? '—'), c.timedOut ? ' (tempo esgotado)' : ''), h('dt', null, 'Duração'), h('dd', null, `${c.durationMs} ms`)),
      h('div', null, h('b', null, 'stdout'), h('pre', { class: 'out' }, c.stdout || '(vazio)')),
      h('div', null, h('b', null, 'stderr'), h('pre', { class: 'out' }, c.stderr || '(vazio)')),
      h('p', { class: 'small muted' }, 'Tokens e segredos são removidos da saída antes de serem registrados.')));
  d.showModal();
}

// ---------------------------------------------------------------- modal genérico
function modal(title) {
  const d = document.getElementById('modal');
  const body = h('div', { class: 'modal-body' });
  const foot = h('div', { class: 'modal-foot' });
  const close = h('button', { class: 'icon-btn', 'aria-label': 'Fechar', onclick: () => d.close() }, icon('x'));
  set(d, h('div', { class: 'modal-head' }, h('h2', null, title), close), body, foot);
  if (!d.open) d.showModal();
  return {
    d, body: (...c) => set(body, c), foot: (...c) => set(foot, c),
    lock: (v) => { close.disabled = v; d.oncancel = v ? (e) => e.preventDefault() : null; },
    close: () => d.close(),
  };
}
const cancelBtn = (m, label = 'Cancelar') => h('button', { class: 'btn', onclick: () => m.close() }, label);

// ---------------------------------------------------------------- correções
function openFix(p, s, fix) {
  const m = modal(fix.label);
  const terminal = fix.kind === 'terminal';
  m.body(
    h('p', null, `${s.label} · ${p.name}`),
    fix.commands.length ? [h('p', { class: 'small muted' }, terminal ? 'Um terminal será aberto no diretório do projeto executando:' : 'Será executado:'),
      h('pre', { class: 'out' }, fix.commands.join('\n'))] : h('p', null, 'Um terminal será aberto no diretório do projeto.'),
    h('p', { class: 'small muted' }, terminal
      ? 'O processo é interativo (navegador, senha ou perguntas). Quando terminar, clique em Verificar.'
      : 'Depois de executar, o estado real é consultado de novo para confirmar a correção. Instalações podem pedir permissão de administrador.'));
  const run = h('button', { class: 'btn primary', onclick: () => executeFix(m, p, s, fix) }, icon('check'), terminal ? 'Abrir terminal' : 'Executar e verificar');
  m.foot(cancelBtn(m), run);
}

async function executeFix(m, p, s, fix) {
  const live = h('div', { class: 'live', 'aria-live': 'polite' });
  m.lock(true);
  m.body(h('p', null, spinner(), ` ${fix.label}… isso pode levar alguns minutos.`), live);
  m.foot();
  onLiveEntries = (entries) => {
    for (const e of entries.filter((x) => x.type === 'event')) live.append(h('div', { class: `lv-${e.level}` }, `${time(e.ts)}  ${e.scope}  ${e.message}`));
    live.scrollTop = live.scrollHeight;
  };
  const fast = setInterval(pollLogs, 500);
  let res;
  try { res = await api('POST', `/api/projects/${p.id}/fix`, { integration: s.id, fix: fix.id }); } catch (e) { res = { ok: false, message: e.message }; }
  clearInterval(fast);
  await pollLogs();
  onLiveEntries = null;
  m.lock(false);
  if (res.status) { S.statuses[p.id] = { data: res.status }; S.health = null; renderAll(); }
  const tone = res.kind === 'terminal' ? 'info' : res.ok ? 'ok' : 'err';
  m.body(
    h('div', { class: `banner tone-${tone}`, role: 'alert' }, h('span', { class: 'bi' }, icon(res.ok ? (res.kind === 'terminal' ? 'info' : 'check') : 'x')),
      h('div', null, h('h2', null, res.kind === 'terminal' ? 'TERMINAL ABERTO' : res.ok ? 'CORRIGIDO E VERIFICADO' : 'NÃO CORRIGIDO'), res.message)),
    res.results?.length ? h('ul', { class: 'checks' }, res.results.map((r) => h('li', { class: r.ok ? 'ok' : 'bad' },
      h('span', { class: r.ok ? 'ok-mark' : 'bad-mark' }, r.ok ? '✓ ' : '✕ '), h('code', null, r.command), r.error ? h('div', { class: 'small' }, r.error) : null,
      r.logId ? h('button', { class: 'btn ghost sm', onclick: () => showCommand(r.logId) }, 'Ver log') : null))) : null,
    live);
  m.foot(res.kind === 'terminal' ? h('button', { class: 'btn primary', onclick: () => { m.close(); loadStatus(p.id, true); } }, icon('refresh'), 'Já concluí — verificar') : null, cancelBtn(m, 'Fechar'));
}

// ---------------------------------------------------------------- troca de contexto
async function openSwitch(id) {
  const p = project(id);
  const m = modal(`Trocar contexto → ${p.name}`);
  m.body(h('p', null, spinner(), ' Consultando o estado real e calculando as alterações (dry run)…'));
  m.foot(cancelBtn(m));
  let plan;
  try { plan = await api('GET', `/api/projects/${id}/plan`); } catch (e) {
    m.body(h('div', { class: 'banner tone-err' }, h('span', { class: 'bi' }, icon('x')), h('div', null, h('h2', null, 'Não foi possível calcular o plano'), e.message)));
    return;
  }
  S.statuses[id] = { data: plan.status };
  renderAll();
  if (!plan.requiresConfirmation) return runApply(m, p, plan);

  const nothing = !plan.changes.length && !plan.blocked.length;
  m.body(
    h('div', { class: 'compare' },
      h('div', { class: 'side' }, h('div', { class: 'lbl' }, 'ATUAL'), h('div', { class: 'nm' }, plan.current?.name ?? 'Nenhum')),
      h('span', { class: 'arrow-mid' }, icon('arrow')),
      h('div', { class: 'side' }, h('div', { class: 'lbl' }, 'NOVO'), h('div', { class: 'nm' }, p.name))),
    plan.changes.length ? [h('b', null, 'Alterações que serão realizadas'), plan.changes.map((c) => h('div', { class: 'change' },
      icon(integrationIcon(c.integration)), h('b', null, c.label),
      h('div', { class: 'ft' }, c.from ?? 'nenhum', h('span', { class: 'arrow' }, '→'), c.to),
      h('div', { class: 'meta' }, c.scope === 'global' ? h('span', { class: 'badge tone-warn' }, 'GLOBAL — afeta todos os terminais') : h('span', { class: 'badge tone-accent' }, 'local — somente este diretório'),
        h('code', { class: 'small muted' }, c.command))))] : null,
    plan.unchanged.length ? [h('b', null, 'Nenhuma alteração necessária'), h('ul', { class: 'checks' }, plan.unchanged.map((u) => h('li', null, h('span', { class: 'ok-mark' }, '✓'), `${u.label}: ${u.summary ?? 'ok'}`)))] : null,
    plan.blocked.length ? [h('b', null, 'Não pode ser corrigido automaticamente'), plan.blocked.map((b) => h('div', { class: 'banner tone-warn' }, h('span', { class: 'bi' }, icon('alert')),
      h('div', null, h('b', null, b.label), h('div', null, b.reason), b.hint ? h('code', { class: 'mono small' }, b.hint) : null)))] : null,
    nothing ? h('p', null, 'Tudo já corresponde a este projeto. Ele será marcado como ativo após a verificação.') : null,
    h('p', { class: 'small muted' }, 'Após aplicar, o estado real é consultado novamente e comparado com o projeto antes de confirmar a troca.'));
  m.foot(cancelBtn(m), h('button', { class: 'btn primary', onclick: () => runApply(m, p, plan) }, icon('check'), plan.changes.length ? 'Aplicar e verificar' : 'Ativar e verificar'));
}

async function runApply(m, p, plan) {
  m.lock(true);
  const live = h('div', { class: 'live', 'aria-live': 'polite' });
  m.body(h('p', null, spinner(), h('b', null, ' Aplicando…')),
    h('ul', { class: 'checks' }, plan.changes.map((c) => h('li', null, spinner(), `${c.label}: ${c.description}`))), live);
  m.foot(h('button', { class: 'btn', disabled: true }, 'Aguarde…'));
  onLiveEntries = (entries) => {
    for (const e of entries.filter((x) => x.type === 'event')) live.append(h('div', { class: `lv-${e.level}` }, `${time(e.ts)}  ${e.scope}  ${e.message}`));
    live.scrollTop = live.scrollHeight;
  };
  const fast = setInterval(pollLogs, 400);
  let res;
  try { res = await api('POST', `/api/projects/${p.id}/apply`, {}); } catch (e) { res = { error: e.message }; }
  clearInterval(fast);
  await pollLogs();
  onLiveEntries = null;
  m.lock(false);
  if (res.error) {
    m.body(h('div', { class: 'banner tone-err' }, h('span', { class: 'bi' }, icon('x')), h('div', null, h('h2', null, 'Falha na troca de contexto'), res.error)));
    m.foot(cancelBtn(m, 'Fechar'));
    return;
  }
  S.activeProjectId = res.activeProjectId;
  S.statuses[p.id] = { data: res.status };
  S.history = null;
  renderAll();
  const tone = { success: 'ok', partial: 'warn', failed: 'err' }[res.outcome];
  const title = { success: 'VERIFICADO', partial: 'CONTEXTO PARCIALMENTE APLICADO', failed: 'TROCA NÃO CONCLUÍDA' }[res.outcome];
  m.body(
    h('div', { class: `banner tone-${tone}`, role: 'alert' }, h('span', { class: 'bi' }, icon(res.outcome === 'success' ? 'check' : res.outcome === 'partial' ? 'alert' : 'x')),
      h('div', null, h('h2', null, title), h('div', null, res.message))),
    res.results.length ? h('table', { class: 'table' }, h('thead', null, h('tr', null, h('th', null, 'Integração'), h('th', null, 'Antes'), h('th', null, 'Depois'), h('th', null, 'Verificação'))),
      h('tbody', null, res.results.map((r) => h('tr', null, h('td', null, h('b', null, r.label)), h('td', { class: 'mono' }, r.before ?? '—'), h('td', { class: 'mono' }, r.after ?? '—'),
        h('td', null, r.verified ? h('span', { class: 'ok-mark' }, '✓ confere') : h('span', { class: 'bad-mark' }, '✕ não confere'),
          r.step && !r.step.ok ? h('div', { class: 'small' }, r.step.message, ' ', r.step.logId ? h('button', { class: 'link', onclick: () => showCommand(r.step.logId) }, 'Ver detalhes') : null) : null))))) : null,
    res.blocked.length ? h('div', { class: 'small' }, h('b', null, 'Exigem ação manual: '), res.blocked.map((b) => `${b.label} (${b.reason})`).join('; ')) : null,
    res.rollback ? h('p', { class: 'small' }, h('b', null, 'Rollback: '), res.rollback) : null);
  const prev = res.from && res.from.id !== p.id ? project(res.from.id) : null;
  m.foot(
    res.outcome !== 'success' && prev ? h('button', { class: 'btn', onclick: () => openSwitch(prev.id) }, `Voltar para ${prev.name}`) : null,
    res.outcome !== 'success' ? h('button', { class: 'btn', onclick: () => openSwitch(p.id) }, icon('refresh'), 'Tentar novamente') : null,
    h('button', { class: 'btn primary', onclick: () => m.close() }, 'Fechar'));
}

// ---------------------------------------------------------------- formulários
function fieldInput(id, label, value, { placeholder, help } = {}) {
  const input = h('input', { type: 'text', id, value: value ?? '', placeholder: placeholder ?? '', autocomplete: 'off', spellcheck: 'false' });
  const err = h('span', { class: 'err', 'aria-live': 'polite' });
  return { input, err, el: h('div', { class: 'field' }, h('label', { for: id }, label), input, help ? h('span', { class: 'help' }, help) : null, err) };
}
function dirField(value, onDetect) {
  const f = fieldInput('f-directory', 'Diretório', value, { placeholder: 'C:\\Projetos\\MeuApp', help: 'Cole o caminho completo ou escolha a pasta.' });
  const pick = h('button', { class: 'btn', type: 'button', onclick: () => guard(async () => {
    pick.disabled = true;
    try { const r = await api('POST', '/api/pick-directory', {}); if (r.directory) { f.input.value = r.directory; onDetect?.(); } } finally { pick.disabled = false; }
  }) }, icon('folder'), 'Escolher…');
  f.el.replaceChild(h('div', { class: 'inline' }, f.input, pick, onDetect ? h('button', { class: 'btn', type: 'button', onclick: onDetect }, icon('scan'), 'Detectar') : null), f.input);
  return f;
}
function showFieldError(fields, e) {
  const f = fields[e.field];
  if (f) { f.err.textContent = e.message; f.input.focus(); } else toast(e.message, true);
}

function openSectionEdit(p, meta) {
  const m = modal(`${meta.label} — ${p.name}`);
  const cur = p[meta.section] ?? {};
  const fields = {};
  const els = meta.fields.map((f) => { const x = fieldInput(`f-${f.key}`, f.label, cur[f.key], f); fields[`${meta.section}.${f.key}`] = x; return x.el; });
  m.body(h('p', { class: 'muted small' }, meta.description), els);
  const save = async (value) => {
    try {
      Object.assign(p, await api('PUT', `/api/projects/${p.id}`, { [meta.section]: value }));
      if (value === null) delete p[meta.section];
      m.close(); toast('Salvo.'); loadStatus(p.id, true);
    } catch (e) { showFieldError(fields, e); }
  };
  m.foot(p[meta.section] ? h('button', { class: 'btn danger', onclick: () => save(null) }, 'Remover configuração') : null, h('span', { style: null }),
    cancelBtn(m), h('button', { class: 'btn primary', onclick: () => save(Object.fromEntries(meta.fields.map((f) => [f.key, fields[`${meta.section}.${f.key}`].input.value]))) }, 'Salvar'));
  els[0]?.querySelector('input')?.focus();
}

function openBasicEdit(p) {
  const m = modal(`Editar ${p.name}`);
  const name = fieldInput('f-name', 'Nome', p.name);
  const dir = dirField(p.directory);
  const fields = { name, directory: dir };
  m.body(name.el, dir.el);
  m.foot(cancelBtn(m), h('button', { class: 'btn primary', onclick: async () => {
    try { Object.assign(p, await api('PUT', `/api/projects/${p.id}`, { name: name.input.value, directory: dir.input.value })); m.close(); renderAll(); loadStatus(p.id, true); } catch (e) { showFieldError(fields, e); }
  } }, 'Salvar'));
}

function openProjectForm() {
  const m = modal('Novo projeto');
  const fields = {};
  const checks = h('ul', { class: 'checks' });
  const name = fieldInput('f-name', 'Nome', '', { placeholder: 'EvangeliGO' });
  fields.name = name;
  const detect = () => guard(async () => {
    set(checks, h('li', null, spinner(), 'Detectando Git, GitHub, Supabase e Firebase…'));
    try {
      const r = await api('POST', '/api/detect', { directory: dir.input.value });
      if (!name.input.value) name.input.value = r.suggestion.name;
      for (const meta of S.integrations) for (const f of meta.fields) {
        const v = r.suggestion[meta.section]?.[f.key];
        if (v) fields[`${meta.section}.${f.key}`].input.value = v;
      }
      set(checks, ...r.checks.map((c) => h('li', null, h('span', { class: c.ok ? 'ok-mark' : 'muted' }, c.ok ? '✓' : '○'), h('b', null, c.label), h('span', { class: 'muted' }, c.detail))));
    } catch (e) { set(checks, ); showFieldError({ directory: dir }, { ...e, field: 'directory' }); }
  });
  const dir = dirField('', detect);
  fields.directory = dir;
  const sections = S.integrations.map((meta) => h('fieldset', { class: 'fieldset' }, h('legend', null, meta.label),
    meta.fields.map((f) => { const x = fieldInput(`n-${meta.section}-${f.key}`, f.label, '', f); fields[`${meta.section}.${f.key}`] = x; return x.el; })));
  m.body(dir.el, checks, name.el, h('p', { class: 'small muted' }, 'Todos os campos de integração são opcionais e podem ser editados depois, individualmente.'), sections);
  m.foot(cancelBtn(m), h('button', { class: 'btn primary', onclick: async () => {
    const body = { name: name.input.value, directory: dir.input.value };
    for (const meta of S.integrations) body[meta.section] = Object.fromEntries(meta.fields.map((f) => [f.key, fields[`${meta.section}.${f.key}`].input.value]));
    try {
      const p = await api('POST', '/api/projects', body);
      S.projects.push(p); m.close(); select(p.id); toast(`${p.name} cadastrado.`);
    } catch (e) { showFieldError(fields, e); }
  } }, 'Salvar projeto'));
  dir.input.focus();
}

function openScan() {
  const m = modal('Importar projetos de uma pasta');
  const root = fieldInput('f-root', 'Pasta que contém os projetos', S.settings.projectsRoot, { placeholder: 'C:\\Projetos' });
  const list = h('div');
  let items = [];
  const run = () => guard(async () => {
    set(list, h('p', null, spinner(), ' Procurando…'));
    items = (await api('POST', '/api/scan', { root: root.input.value })).items;
    set(list, items.length ? h('table', { class: 'table' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', null, 'Pasta'), h('th', null, 'GitHub'), h('th', null, 'Supabase'), h('th', null, 'Firebase'))),
      h('tbody', null, items.map((it, i) => h('tr', null,
        h('td', null, it.registered ? h('span', { class: 'badge tone-muted' }, 'já cadastrado') : h('input', { type: 'checkbox', 'data-i': String(i), checked: !!(it.repository || it.supabaseRef || it.firebaseProjectId), 'aria-label': `Importar ${it.name}` })),
        h('td', null, h('b', null, it.name)), h('td', { class: 'mono small' }, it.repository ?? '—'), h('td', { class: 'mono small' }, it.supabaseRef ?? '—'), h('td', { class: 'mono small' }, it.firebaseProjectId ?? '—')))))
      : h('p', { class: 'muted' }, 'Nenhuma subpasta encontrada.'));
  });
  m.body(h('div', { class: 'inline' }, root.el, h('button', { class: 'btn', onclick: run }, icon('search'), 'Procurar')), list,
    h('p', { class: 'small muted' }, 'A detecção lê apenas arquivos (.git/config, .firebaserc, supabase/.temp). A branch não é definida — edite depois se quiser.'));
  m.foot(cancelBtn(m), h('button', { class: 'btn primary', onclick: () => guard(async () => {
    const chosen = [...list.querySelectorAll('input[type=checkbox]:checked')].map((c) => items[Number(c.dataset.i)]);
    let ok = 0;
    for (const it of chosen) {
      const exists = S.projects.some((p) => p.name.toLowerCase() === it.name.toLowerCase());
      const r = await guard(() => api('POST', '/api/projects', {
        name: exists ? `${it.name} (${it.directory.split(/[\\/]/).at(-2)})` : it.name, directory: it.directory,
        github: it.repository ? { repository: it.repository } : null, supabase: it.supabaseRef ? { projectRef: it.supabaseRef } : null,
        firebase: it.firebaseProjectId ? { projectId: it.firebaseProjectId } : null }));
      if (r) { S.projects.push(r); ok++; }
    }
    m.close(); renderAll(); toast(`${ok} projeto(s) importado(s).`);
  }) }, 'Adicionar selecionados'));
  if (root.input.value) run();
}

function confirmDelete(p) {
  const m = modal('Excluir projeto');
  m.body(h('p', null, 'Excluir ', h('b', null, p.name), ' do Project Switcher?'),
    h('p', { class: 'small muted' }, 'Apenas o cadastro é removido. Nenhum arquivo, repositório ou configuração das CLIs é alterado.'));
  m.foot(cancelBtn(m), h('button', { class: 'btn danger-fill', onclick: () => guard(async () => {
    await api('DELETE', `/api/projects/${p.id}`);
    S.projects = S.projects.filter((x) => x.id !== p.id);
    if (S.activeProjectId === p.id) S.activeProjectId = null;
    S.selectedId = S.activeProjectId ?? S.projects[0]?.id ?? null;
    m.close(); renderAll(); toast('Projeto excluído.');
  }) }, 'Excluir'));
}

async function openIn(p, target) {
  const r = await guard(() => api('POST', `/api/projects/${p.id}/open`, { target }));
  if (r) toast({ folder: 'Pasta aberta.', terminal: 'Terminal aberto.', editor: 'VS Code aberto.' }[target]);
}

// ---------------------------------------------------------------- navegação
function select(id) {
  S.selectedId = id;
  S.view = 'project';
  document.getElementById('app').classList.remove('nav-open');
  const st = S.statuses[id];
  renderAll();
  if (!st || (!st.loading && Date.now() - new Date(st.data?.checkedAt ?? 0) > 60000)) loadStatus(id);
}
function go(view) {
  S.view = S.view === view ? 'project' : view;
  if (view === 'history') S.history = null;
  renderAll();
}
function renderAll() { renderTop(); renderSidebar(); renderMain(); }

document.addEventListener('keydown', (e) => {
  const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName ?? '');
  if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) { e.preventDefault(); document.getElementById('search')?.focus(); }
  else if (e.key.toLowerCase() === 'r' && !typing && !e.ctrlKey && !document.querySelector('dialog[open]') && S.view === 'project' && S.selectedId) loadStatus(S.selectedId, true);
});
window.addEventListener('focus', () => { const a = S.activeProjectId; const st = a && S.statuses[a]; if (st && !st.loading && Date.now() - new Date(st.data?.checkedAt ?? 0) > 60000) loadStatus(a); });

(async function init() {
  try { await loadBootstrap(); } catch (e) {
    document.getElementById('main').replaceChildren(h('div', { class: 'banner tone-err' }, h('div', null, h('h2', null, 'Não foi possível conectar ao agente local'), e.message)));
    return;
  }
  renderAll();
  renderLogs();
  if (S.activeProjectId) await loadStatus(S.activeProjectId);
  if (S.selectedId && S.selectedId !== S.activeProjectId) loadStatus(S.selectedId);
  setInterval(pollLogs, 2000);
  pollLogs();
})();
