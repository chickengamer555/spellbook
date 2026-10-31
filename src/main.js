import './style.css';
import spells2014 from './data/spells-2014.json';
import spells2024 from './data/spells-2024.json';

const EDITIONS = {
  2014: { spells: spells2014, source: 'SRD 5.1', credit: 'System Reference Document 5.1' },
  2024: { spells: spells2024, source: 'SRD 5.2', credit: 'System Reference Document 5.2' },
};
const CLASSES = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard'];
const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation'];
const FLAGS = {
  concentration: { label: 'Concentration', test: (s) => s.concentration },
  ritual: { label: 'Ritual', test: (s) => s.ritual },
  bonus: { label: 'Bonus Action', test: (s) => s.cast === 'Bonus Action' },
  reaction: { label: 'Reaction', test: (s) => s.cast === 'Reaction' },
  noMaterial: { label: 'No material', test: (s) => !s.components.includes('M') },
};

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ord = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] || 'th');
const levelShort = (n) => (n === 0 ? 'Cantrip' : ord(n));

// Character level at which a class can first cast a spell of a given level.
// Full casters and Warlocks (Pact Magic, then Mystic Arcanum) gain a new spell level every odd level;
// Paladins and Rangers follow the half-caster table, which starts at level 2 in 2014 and level 1 in 2024.
const HALF_CASTER = { 2014: [null, 2, 5, 9, 13, 17], 2024: [null, 1, 5, 9, 13, 17] };
function unlockFor(cls, level, edition) {
  if (cls === 'Paladin' || cls === 'Ranger') return HALF_CASTER[edition][level] ?? null;
  return level === 0 ? 1 : 2 * level - 1;
}
// Earliest character level among the selected class, or among every class that has the spell.
function unlock(s, cls = state.cls) {
  const lv = (cls ? [cls] : s.classes).map((c) => unlockFor(c, s.level, state.edition)).filter((x) => x != null);
  return lv.length ? Math.min(...lv) : null;
}

function levelLine(s, edition) {
  if (s.level === 0) return `${s.school} cantrip`;
  return edition === '2024' ? `Level ${s.level} ${s.school}` : `${ord(s.level)}-level ${s.school.toLowerCase()}`;
}

/* ---------- state, mirrored in the URL hash so a filtered list can be shared ---------- */
const state = {
  edition: '2014', view: 'table', sort: 'name', q: '', charLevel: null,
  cls: null, levels: new Set(), schools: new Set(), flags: new Set(), open: null,
};

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  if (Object.hasOwn(EDITIONS, p.get('ed'))) state.edition = p.get('ed');
  else { try { const e = localStorage.getItem('spellbook-edition'); if (Object.hasOwn(EDITIONS, e)) state.edition = e; } catch {} }
  const v = p.get('view') || (() => { try { return localStorage.getItem('spellbook-view'); } catch { return null; } })();
  if (v === 'table' || v === 'cards') state.view = v;
  state.sort = ['name', 'level', 'unlock', 'school'].includes(p.get('sort')) ? p.get('sort') : 'name';
  state.q = p.get('q') || '';
  state.cls = CLASSES.includes(p.get('class')) ? p.get('class') : null;
  state.levels = new Set((p.get('level') || '').split(',').filter((x) => /^\d$/.test(x)).map(Number));
  state.schools = new Set((p.get('school') || '').split(',').filter((x) => SCHOOLS.includes(x)));
  state.charLevel = /^([1-9]|1\d|20)$/.test(p.get('char') || '') ? Number(p.get('char')) : null;
  state.flags = new Set((p.get('only') || '').split(',').filter((x) => Object.hasOwn(FLAGS, x)));
  state.open = p.get('spell');
}

function writeHash() {
  const p = new URLSearchParams();
  p.set('ed', state.edition);
  if (state.view !== 'table') p.set('view', state.view);
  if (state.sort !== 'name') p.set('sort', state.sort);
  if (state.q) p.set('q', state.q);
  if (state.cls) p.set('class', state.cls);
  if (state.levels.size) p.set('level', [...state.levels].sort().join(','));
  if (state.schools.size) p.set('school', [...state.schools].join(','));
  if (state.charLevel) p.set('char', state.charLevel);
  if (state.flags.size) p.set('only', [...state.flags].join(','));
  if (state.open) p.set('spell', state.open);
  history.replaceState(null, '', '#' + p.toString().replace(/%2C/g, ','));
  try {
    localStorage.setItem('spellbook-edition', state.edition);
    localStorage.setItem('spellbook-view', state.view);
  } catch {}
}

/* ---------- filtering: each facet counts against every other filter but itself ---------- */
function matchesQuery(s, q) {
  if (!q) return 0;
  const n = s.name.toLowerCase();
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  const hay = [s.desc.join(' '), s.damage && s.damage.type, s.save, s.school, s.area].join(' ').toLowerCase();
  return hay.includes(q) ? 3 : -1;
}

function filtered(skip) {
  const q = state.q.trim().toLowerCase();
  const out = [];
  for (const s of EDITIONS[state.edition].spells) {
    const rank = matchesQuery(s, q);
    if (rank < 0) continue;
    if (skip !== 'class' && state.cls && !s.classes.includes(state.cls)) continue;
    if (skip !== 'level' && state.levels.size && !state.levels.has(s.level)) continue;
    if (skip !== 'school' && state.schools.size && !state.schools.has(s.school)) continue;
    if (state.charLevel && !(unlock(s, skip === 'class' ? null : state.cls) <= state.charLevel)) continue;
    if (skip !== 'flags') { let ok = true; for (const f of state.flags) if (!FLAGS[f].test(s)) { ok = false; break; } if (!ok) continue; }
    out.push({ s, rank });
  }
  return out;
}

function sorted(list) {
  const by = {
    name: (a, b) => a.s.name.localeCompare(b.s.name),
    level: (a, b) => a.s.level - b.s.level || a.s.name.localeCompare(b.s.name),
    unlock: (a, b) => (unlock(a.s) ?? 99) - (unlock(b.s) ?? 99) || a.s.level - b.s.level || a.s.name.localeCompare(b.s.name),
    school: (a, b) => a.s.school.localeCompare(b.s.school) || a.s.level - b.s.level || a.s.name.localeCompare(b.s.name),
  }[state.sort];
  return list.sort((a, b) => (state.q ? a.rank - b.rank : 0) || by(a, b)).map((x) => x.s);
}

/* ---------- small renderers shared by table, cards, peek and drawer ---------- */
function effect(s) {
  const bits = [];
  if (s.damage && s.damage.dice) bits.push(`${s.damage.dice} ${s.damage.type.toLowerCase()}`);
  else if (s.damage) bits.push(`${s.damage.type} damage`);
  if (s.heal) bits.push(`Heals ${s.heal.replace(' + MOD', ' + mod')}`);
  if (s.save) bits.push(`${s.save.slice(0, 3)} save`);
  else if (s.attack) bits.push(`${s.attack[0].toUpperCase() + s.attack.slice(1)} attack`);
  if (s.area) bits.push(s.area);
  return bits;
}

const comps = (s) => s.components.join(', ');
const tags = (s) => (s.concentration ? '<span class="pill" title="Concentration">Conc.</span>' : '')
  + (s.ritual ? '<span class="pill" title="Can be cast as a ritual">Ritual</span>' : '');

function renderRichText(paras) {
  const html = [];
  let table = null;
  for (const p of paras) {
    if (p.startsWith('|')) {
      const cells = p.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      if (!table) { table = { head: cells, rows: [] }; continue; }
      table.rows.push(cells);
      continue;
    }
    if (table) { html.push(tableHtml(table)); table = null; }
    const body = esc(p).replace(/\*\*\*(.+?)\*\*\*/g, '<strong>$1</strong>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html.push(`<p>${body}</p>`);
  }
  if (table) html.push(tableHtml(table));
  return html.join('');
}

const tableHtml = (t) => `<table class="mini"><thead><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>`
  + `<tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

function statGrid(s) {
  return `<dl class="stats">
    <div><dt>Casting time</dt><dd>${esc(s.cast)}</dd></div>
    <div><dt>Range</dt><dd>${esc(s.range)}</dd></div>
    <div><dt>Duration</dt><dd>${s.concentration ? 'Conc., ' : ''}${esc(s.duration)}</dd></div>
    <div><dt>Components</dt><dd>${esc(comps(s))}</dd></div>
  </dl>`;
}

/* ---------- sidebar ---------- */
function renderSidebar() {
  const forClass = filtered('class');
  const total = forClass.length;
  const count = (c) => forClass.filter(({ s }) => s.classes.includes(c) && (!state.charLevel || unlockFor(c, s.level, state.edition) <= state.charLevel)).length;
  $('classes').innerHTML = [`<li><button type="button" class="facet-row" data-class="" aria-pressed="${!state.cls}"><span>All classes</span><span class="num">${total}</span></button></li>`]
    .concat(CLASSES.map((c) => `<li><button type="button" class="facet-row" data-class="${c}" aria-pressed="${state.cls === c}"><span>${c}</span><span class="num">${count(c)}</span></button></li>`)).join('');

  const forSchool = filtered('school');
  $('schools').innerHTML = SCHOOLS.map((sc) => {
    const n = forSchool.filter(({ s }) => s.school === sc).length;
    return `<li><label class="check"><input type="checkbox" data-school="${sc}" ${state.schools.has(sc) ? 'checked' : ''}><span>${sc}</span><span class="num">${n}</span></label></li>`;
  }).join('');

  const forFlags = filtered('flags');
  $('flags').innerHTML = Object.entries(FLAGS).map(([k, f]) => {
    const n = forFlags.filter(({ s }) => f.test(s)).length;
    return `<li><label class="check"><input type="checkbox" data-flag="${k}" ${state.flags.has(k) ? 'checked' : ''}><span>${f.label}</span><span class="num">${n}</span></label></li>`;
  }).join('');

  $('credit').innerHTML = `Spell text from the ${EDITIONS[state.edition].credit} by Wizards of the Coast LLC, licensed under <a href="https://creativecommons.org/licenses/by/4.0/" rel="noopener">CC BY 4.0</a>. Data via <a href="https://github.com/5e-bits/5e-database" rel="noopener">5e-bits</a>.`;
}

/* ---------- the level ladder: the spell-slot levels as columns, sized by how many spells each holds ---------- */
function renderLadder() {
  const pool = filtered('level');
  const counts = Array.from({ length: 10 }, (_, l) => pool.filter(({ s }) => s.level === l).length);
  const max = Math.max(1, ...counts);
  $('ladder').innerHTML = counts.map((n, l) => {
    const on = state.levels.has(l);
    const h = n ? Math.max(4, Math.round((n / max) * 100)) : 0;
    return `<button type="button" class="rung${on ? ' on' : ''}${state.levels.size && !on ? ' dim' : ''}" data-level="${l}" aria-pressed="${on}" aria-label="${levelShort(l)}${l ? ' level' : 's'}: ${n} spells">
      <span class="rung-n num">${n}</span>
      <span class="rung-track"><span class="rung-bar" style="height:${h}%"></span></span>
      <span class="rung-l" aria-hidden="true">${l ? levelShort(l) : '<span class="long">Cantrip</span><span class="short">0</span>'}</span>
    </button>`;
  }).join('');
  $('clear-levels').hidden = !state.levels.size;
}

/* ---------- results ---------- */
function renderTable(list) {
  const rows = list.map((s) => `<tr data-id="${s.id}">
      <td class="name-cell"><button type="button" class="spell-link" data-id="${s.id}">${esc(s.name)}</button>${tags(s)}</td>
      <td class="num">${s.level === 0 ? '<span class="muted">Cantrip</span>' : s.level}</td>
      <td class="num">${unlock(s) ?? '—'}</td>
      <td>${s.school}</td>
      <td>${esc(s.cast)}</td>
      <td>${esc(s.range)}</td>
      <td>${esc(s.duration)}</td>
      <td class="muted">${esc(comps(s))}</td>
      <td class="muted">${effect(s).slice(0, 2).map(esc).join(' · ') || '—'}</td>
      <td class="line2">${[s.school, s.cast, s.range, s.duration].map(esc).join(' · ')}${unlock(s) ? ` · <span class="nowrap">char. level ${unlock(s)}</span>` : ''}</td>
    </tr>`).join('');
  return `<div class="table-wrap"><table class="spells">
    <thead><tr>
      <th scope="col">Name</th><th scope="col" class="num">Level</th><th scope="col" class="num" title="Character level at which ${state.cls ? `a ${state.cls}` : 'the earliest class'} can cast it">Char. level</th><th scope="col">School</th><th scope="col">Casting time</th>
      <th scope="col">Range</th><th scope="col">Duration</th><th scope="col">Components</th><th scope="col">Effect</th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderCards(list) {
  return `<ul class="cards">${list.map((s) => {
    const fx = effect(s);
    return `<li class="card">
      <button type="button" class="card-hit" data-id="${s.id}" aria-label="Read ${esc(s.name)} in full"></button>
      <div class="card-head">
        <h3>${esc(s.name)}</h3>
        <span class="lvl num" aria-hidden="true">${s.level === 0 ? 'C' : s.level}</span>
      </div>
      <p class="card-sub">${levelLine(s, state.edition)}${s.ritual ? ' (ritual)' : ''}${unlock(s) ? ` · character level ${unlock(s)}` : ''}</p>
      ${statGrid(s)}
      ${fx.length ? `<p class="fx">${fx.map(esc).join(' · ')}</p>` : ''}
      <p class="summary">${esc(s.summary)}</p>
      <p class="card-classes">${s.classes.join(', ')}</p>
    </li>`;
  }).join('')}</ul>`;
}

// Sidebar and ladder are rebuilt on every change; put keyboard focus back on the same control.
function focusKey() {
  const a = document.activeElement;
  if (!a || !a.dataset) return null;
  for (const k of ['class', 'level', 'school', 'flag']) if (a.dataset[k] !== undefined) return `[data-${k}="${a.dataset[k]}"]`;
  return null;
}

function render() {
  const refocus = focusKey();
  render_();
  if (refocus) document.querySelector(refocus)?.focus();
}

function render_() {
  const list = sorted(filtered());
  const ed = EDITIONS[state.edition];
  const scope = [state.cls, state.levels.size ? [...state.levels].sort().map(levelShort).join(', ') + (state.levels.size === 1 && !state.levels.has(0) ? ' level' : '') : null,
    state.charLevel ? `castable by character level ${state.charLevel}` : null, ...state.schools, ...[...state.flags].map((f) => FLAGS[f].label)].filter(Boolean);
  $('title').textContent = state.cls ? `${state.cls} spells` : 'Spells';
  $('subline').textContent = `${list.length} of ${ed.spells.length} spells in the ${ed.source}`
    + (scope.length ? ` · ${scope.join(' · ')}` : '') + (state.q ? ` · matching “${state.q.trim()}”` : '');

  $('results').innerHTML = list.length
    ? (state.view === 'table' ? renderTable(list) : renderCards(list))
    : `<div class="empty"><p>No spells match these filters.</p><button type="button" class="text-btn" id="reset">Clear all filters</button></div>`;

  $('results').dataset.verifyEdition = state.edition;
  $('results').dataset.verifyCount = list.length;
  for (const b of document.querySelectorAll('[data-edition]')) b.setAttribute('aria-pressed', b.dataset.edition === state.edition);
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-selected', b.dataset.view === state.view);
  $('sort').value = state.sort;
  $('char-level').value = state.charLevel || '';
  if ($('q').value !== state.q) $('q').value = state.q;
  renderSidebar();
  renderLadder();
  writeHash();
}

/* ---------- peek (hover on a name) and drawer (click) ---------- */
const byId = (id) => EDITIONS[state.edition].spells.find((s) => s.id === id);
const peek = $('peek');
let peekTimer;

function showPeek(btn) {
  const s = byId(btn.dataset.id);
  if (!s) return;
  peek.innerHTML = `<p class="peek-name">${esc(s.name)}</p><p class="peek-sub">${levelLine(s, state.edition)}</p>
    <p>${esc(s.summary)}</p>${effect(s).length ? `<p class="fx">${effect(s).map(esc).join(' · ')}</p>` : ''}`;
  peek.hidden = false;
  const r = btn.getBoundingClientRect();
  const w = peek.offsetWidth, h = peek.offsetHeight;
  let top = r.bottom + 6;
  if (top + h > innerHeight - 8) top = r.top - h - 6;
  peek.style.left = Math.min(r.left, innerWidth - w - 12) + 'px';
  peek.style.top = Math.max(8, top) + 'px';
}
const hidePeek = () => { clearTimeout(peekTimer); peek.hidden = true; };

let lastFocus = null;
function openDrawer(id) {
  const s = byId(id);
  if (!s) { state.open = null; return; }
  hidePeek();
  state.open = id;
  lastFocus = document.activeElement;
  const d = $('drawer');
  d.innerHTML = `<div class="drawer-head">
      <div><h2 id="d-name">${esc(s.name)}</h2><p class="card-sub">${levelLine(s, state.edition)}${s.ritual ? ' (ritual)' : ''}</p></div>
      <button type="button" class="icon-btn" id="drawer-close" aria-label="Close">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="drawer-body">
      ${statGrid(s)}
      ${s.castFull !== s.cast ? `<p class="note"><strong>Trigger.</strong> ${esc(s.castFull.replace(/^[^,]+,\s*/, ''))}</p>` : ''}
      ${s.material ? `<p class="note"><strong>Material.</strong> ${esc(s.material)}</p>` : ''}
      ${effect(s).length ? `<p class="fx">${effect(s).map(esc).join(' · ')}</p>` : ''}
      <div class="prose">${renderRichText(s.desc)}</div>
      ${s.higher.length ? `<h3>${s.level === 0 ? 'Cantrip upgrade' : 'At higher levels'}</h3><div class="prose">${renderRichText(s.higher)}</div>` : ''}
      <dl class="meta"><div><dt>Classes</dt><dd>${s.classes.map((c) => `${c} <span class="muted">(level ${unlockFor(c, s.level, state.edition)})</span>`).join(', ')}</dd></div><div><dt>Source</dt><dd>${EDITIONS[state.edition].source}</dd></div></dl>
    </div>`;
  d.hidden = false; $('scrim').hidden = false;
  document.body.classList.add('locked');
  d.focus();
  writeHash();
}
function closeDrawer() {
  if ($('drawer').hidden) return;
  $('drawer').hidden = true; $('scrim').hidden = true;
  document.body.classList.remove('locked');
  state.open = null;
  writeHash();
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

/* ---------- events ---------- */
const setFilters = (open) => {
  document.body.classList.toggle('filters-open', open);
  $('filters-open').setAttribute('aria-expanded', open);
};

document.addEventListener('click', (e) => {
  const t = e.target.closest('button, input');
  if (!t) return;
  if (t.dataset.class !== undefined) { state.cls = t.dataset.class || null; render(); }
  else if (t.dataset.level !== undefined) {
    const l = Number(t.dataset.level);
    state.levels.has(l) ? state.levels.delete(l) : state.levels.add(l);
    render();
  } else if (t.dataset.school) { t.checked ? state.schools.add(t.dataset.school) : state.schools.delete(t.dataset.school); render(); }
  else if (t.dataset.flag) { t.checked ? state.flags.add(t.dataset.flag) : state.flags.delete(t.dataset.flag); render(); }
  else if (t.dataset.edition) { state.edition = t.dataset.edition; render(); }
  else if (t.dataset.view) { state.view = t.dataset.view; render(); }
  else if (t.dataset.id) openDrawer(t.dataset.id);
  else if (t.id === 'clear-levels') { state.levels.clear(); render(); }
  else if (t.id === 'reset') { Object.assign(state, { q: '', cls: null, charLevel: null }); state.levels.clear(); state.schools.clear(); state.flags.clear(); render(); }
  else if (t.id === 'drawer-close') closeDrawer();
  else if (t.id === 'filters-open') setFilters(true);
  else if (t.id === 'filters-close') setFilters(false);
});

// A click anywhere on a table row opens the spell, not only the name.
$('results').addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr && !e.target.closest('button')) openDrawer(tr.dataset.id);
});
$('scrim').addEventListener('click', () => { closeDrawer(); });
$('brand').addEventListener('click', (e) => { e.preventDefault(); $('main').scrollIntoView(); });

$('q').addEventListener('input', (e) => { state.q = e.target.value; render(); });
$('sort').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
$('char-level').addEventListener('change', (e) => { state.charLevel = Number(e.target.value) || null; render(); });

const canHover = matchMedia('(hover: hover)').matches;
$('results').addEventListener('mouseover', (e) => {
  const b = e.target.closest('.spell-link');
  if (!b || !canHover) return;
  clearTimeout(peekTimer);
  peekTimer = setTimeout(() => showPeek(b), 120);
});
$('results').addEventListener('mouseout', (e) => { if (e.target.closest('.spell-link')) hidePeek(); });
$('results').addEventListener('focusin', (e) => { const b = e.target.closest('.spell-link'); if (b) showPeek(b); });
$('results').addEventListener('focusout', hidePeek);
addEventListener('scroll', hidePeek, { passive: true });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!$('drawer').hidden) closeDrawer(); else if (document.body.classList.contains('filters-open')) setFilters(false); else hidePeek(); }
  if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); $('q').focus(); }
});

readHash();
render();
if (state.open) openDrawer(state.open);
