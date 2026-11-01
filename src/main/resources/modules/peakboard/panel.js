// Seite "PeakBoard": Scoreboard ansehen und verwalten. Aenderungen landen zuerst im Entwurf und werden mit einem Klick veroeffentlicht.
export default async function mount(root, ctx) {
  const { h } = ctx;
  const L = (de, en) => ctx.t({ de, en });
  let st, tab = 'display', rankObj = '', newObj = false, newTeam = false;
  const set = (...kids) => root.replaceChildren(...kids.filter(k => k != null && k !== false));
  const SLOT = { sidebar: L('Seitenleiste', 'Sidebar'), list: L('Tab-Liste', 'Player list'), below_name: L('Unter dem Namen', 'Below name') };
  const COLOR = { black: '#000', dark_blue: '#00a', dark_green: '#0a0', dark_aqua: '#0aa', dark_red: '#a00', dark_purple: '#a0a', gold: '#fa0', gray: '#aaa', dark_gray: '#555', blue: '#55f', green: '#5f5', aqua: '#5ff', red: '#f55', light_purple: '#f5f', yellow: '#ff5', white: '#fff' };
  const draft = () => st.draft, liveM = () => st.live;

  async function load() { st = await ctx.api('state'); }
  async function queue(ops, confirm) {
    try { st = await ctx.api('draft', { method: 'POST', body: { ops, confirmForeign: !!confirm } }); render(); return true; }
    catch (e) {
      if (e.foreign || /Bitte bestaetigen/.test(e.message || '')) { if (await ctx.confirm(e.message)) return queue(ops, true); return false; }
      ctx.toast(e.message, 'bad'); return false;
    }
  }
  const op = (type, args) => ({ type, args });

  if (!document.getElementById('pb-style')) {
    const s = document.createElement('style'); s.id = 'pb-style';
    s.textContent = `
.pb-bar{position:sticky;top:60px;z-index:5;background:var(--panel);border:2px solid var(--warn);padding:10px 14px;margin:12px 0;animation:pbpop .3s}
@keyframes pbpop{from{transform:translateY(-8px);opacity:0}to{transform:none;opacity:1}}
.pb-ops{max-height:180px;overflow:auto;margin:8px 0}.pb-op{display:flex;gap:8px;align-items:center;padding:3px 0;font-size:13px}
.pb-side{background:rgba(0,0,0,.55);color:#fff;font-family:inherit;width:230px;padding:4px 0;border:1px solid #000;box-shadow:4px 4px 0 rgba(0,0,0,.4);min-height:60px}
.pb-side .t{text-align:center;padding:2px 6px 4px;font-weight:bold}.pb-side .r{display:flex;justify-content:space-between;gap:10px;padding:0 6px;font-size:13px}.pb-side .r b{color:#f55;font-weight:normal}
.pb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px;margin-top:12px}
.pb-tile{background:var(--panel);border:2px solid var(--line);padding:14px;transition:transform .2s,border-color .2s}.pb-tile:hover{transform:translateY(-4px);border-color:var(--accent)}
.pb-top{display:flex;justify-content:space-between;font-size:13px;color:var(--dim)}
.pb-bar2{height:14px;background:var(--panel2);margin:5px 0;position:relative}.pb-bar2 i{display:block;height:100%;background:var(--accent);width:0;transition:width .7s}
.pb-cell{width:90px;padding:3px 6px}.pb-changed{border-color:var(--warn)}
.pb-swatch{display:inline-block;width:14px;height:14px;border:2px solid var(--line);vertical-align:-2px}
.pb-chip{display:inline-flex;gap:6px;align-items:center;background:var(--panel2);border:2px solid var(--line);padding:1px 8px;margin:2px;font-size:13px}
.pb-dgrid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:20px;align-items:start}@media(max-width:960px){.pb-dgrid{grid-template-columns:1fr}}
.pb-preview{position:sticky;top:70px}
.pb-mc{background:rgba(0,0,0,.62);color:#fff;margin-top:10px;padding:5px 0 7px;border:1px solid #000;box-shadow:4px 4px 0 rgba(0,0,0,.4);font-family:Consolas,'Courier New',monospace;font-size:14px;min-height:60px;overflow:hidden}
.pb-mc-t{text-align:center;padding:2px 8px 5px;min-height:22px;white-space:pre}.pb-mc-r{padding:0 8px;white-space:pre;overflow:hidden;text-overflow:clip;min-height:19px}
.pb-tools{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:6px 0}.pb-sw{width:20px;height:20px;border:2px solid var(--line);cursor:pointer;padding:0}.pb-sw:hover{transform:scale(1.2)}
.pb-chips{display:flex;flex-wrap:wrap;gap:2px}button.pb-chip{cursor:pointer;color:inherit;font-family:inherit}button.pb-chip:hover{border-color:var(--accent)}`;
    document.head.appendChild(s);
  }

  // ---------- Entwurf-Leiste ----------
  function draftBar() {
    if (!st.ops.length && !st.draftError) return null;
    return h('div', { class: 'pb-bar' },
      h('div', { class: 'row' }, h('b', {}, st.ops.length + ' ' + L('Änderung(en) im Entwurf', 'change(s) in the draft')), h('span', { class: 'sub' }, L('Noch nichts davon gilt im Spiel.', 'None of this is live yet.')), h('span', { class: 'grow' }),
        h('button', { class: 'px-btn primary', disabled: !!st.draftError, onclick: async () => { if (await ctx.confirm(L('Alle Änderungen jetzt im Spiel anwenden? Vorher wird der Stand gesichert.', 'Apply all changes in the game now? The current state is backed up first.'))) { try { st = await ctx.api('publish', { method: 'POST', body: '' }); ctx.toast(L('Veröffentlicht', 'Published'), 'good'); render(); } catch (e) { ctx.toast(e.message, 'bad'); } } } }, L('Veröffentlichen', 'Publish')),
        h('button', { class: 'px-btn danger', onclick: async () => { if (await ctx.confirm(L('Den ganzen Entwurf verwerfen?', 'Discard the whole draft?'))) { st = await ctx.api('draft', { method: 'DELETE' }); render(); } } }, L('Verwerfen', 'Discard'))),
      st.draftError ? h('div', { style: 'color:var(--bad)' }, st.draftError) : null,
      h('div', { class: 'pb-ops' }, st.ops.map((o, i) => h('div', { class: 'pb-op' }, h('button', { class: 'px-btn small ghost', onclick: async () => { try { st = await ctx.api('draft/' + i, { method: 'DELETE' }); render(); } catch (e) { ctx.toast(e.message, 'bad'); } } }, '×'), o.foreign ? h('span', { class: 'tag warn' }, L('Fremd', 'Foreign')) : null, o.text))));
  }

  // ---------- Sidebar-Vorschau ----------
  function sidebarView(model) {
    const name = model.slots.sidebar, o = model.objectives.find(x => x.name === name);
    if (!o) return h('div', { class: 'pb-side' }, h('div', { class: 't' }, L('(leer)', '(empty)')));
    const rows = Object.entries(o.scores).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 15);
    return h('div', { class: 'pb-side' }, h('div', { class: 't' }, o.display || o.name), rows.map(([e, v]) => h('div', { class: 'r' }, h('span', {}, e), h('b', {}, v))));
  }

  // ---------- Uebersicht ----------
  function objectiveForm() {
    const name = h('input', { placeholder: L('name (a-z, 0-9, _)', 'name (a-z, 0-9, _)') }), crit = h('input', { list: 'pb-crit', value: 'dummy' }), disp = h('input', { placeholder: L('Anzeigename', 'Display name') });
    const render = h('select', {}, st.lists.render.map(r => h('option', { value: r }, r)));
    return h('div', { class: 'card' }, h('datalist', { id: 'pb-crit' }, st.lists.criteria.map(c => h('option', { value: c }))),
      h('h2', { style: 'margin-top:0' }, L('Neues Objective', 'New objective')),
      h('div', { class: 'row' }, h('div', {}, h('label', {}, 'Name'), name), h('div', {}, h('label', {}, L('Kriterium', 'Criteria')), crit), h('div', {}, h('label', {}, L('Anzeigename', 'Display name')), disp), h('div', {}, h('label', {}, L('Darstellung', 'Render')), render)),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'px-btn primary', onclick: async () => { if (await queue([op('objective.create', { name: name.value.trim(), criteria: crit.value.trim(), display: disp.value.trim(), render: render.value })])) { newObj = false; render(); } } }, L('In den Entwurf', 'Add to draft')),
        h('button', { class: 'px-btn ghost', onclick: () => { newObj = false; render(); } }, L('Abbrechen', 'Cancel'))));
  }

  function objectiveTile(o) {
    const top = Object.entries(o.scores).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const where = Object.entries(draft().slots).filter(([, v]) => v === o.name).map(([k]) => SLOT[k]);
    return h('div', { class: 'pb-tile' },
      h('div', { class: 'row' }, h('b', {}, o.display || o.name), o.owned ? null : h('span', { class: 'tag warn', title: L('Nicht von PeakBoard angelegt: Änderungen müssen bestätigt werden', 'Not created by PeakBoard: changes need confirmation') }, L('Fremd', 'Foreign'))),
      h('div', { class: 'pb-top' }, h('span', {}, o.name + ' · ' + o.criteria), h('span', {}, Object.keys(o.scores).length + ' ' + L('Einträge', 'entries'))),
      where.length ? h('div', { style: 'margin:6px 0' }, where.map(w => h('span', { class: 'chip good' }, w))) : null,
      top.length ? top.map(([e, v]) => h('div', { class: 'pb-top' }, h('span', {}, e), h('b', {}, v))) : h('div', { class: 'sub' }, L('Noch keine Punkte.', 'No scores yet.')),
      h('div', { class: 'row', style: 'margin-top:10px' },
        Object.keys(SLOT).map(s => h('button', { class: 'px-btn small' + (draft().slots[s] === o.name ? ' active' : ''), onclick: () => queue([op('slot.set', { slot: s, objective: draft().slots[s] === o.name ? '' : o.name })]) }, SLOT[s])),
        h('button', { class: 'px-btn small', onclick: async () => { const d = prompt(L('Neuer Anzeigename', 'New display name'), o.display || o.name); if (d != null) queue([op('objective.display', { name: o.name, display: d })]); } }, '✎'),
        h('button', { class: 'px-btn small danger', onclick: async () => { if (await ctx.confirm(L('Objective "' + o.name + '" löschen (im Entwurf)?', 'Delete objective "' + o.name + '" (in the draft)?'))) queue([op('objective.delete', { name: o.name })]); } }, '×')));
  }

  function overview() {
    const m = draft();
    return h('div', {},
      h('div', { class: 'row', style: 'align-items:flex-start;gap:24px' },
        h('div', {}, h('h2', { style: 'margin-top:0' }, L('Seitenleiste (Vorschau)', 'Sidebar (preview)')), sidebarView(m), h('p', { class: 'sub', style: 'max-width:230px' }, L('So sieht es nach dem Veröffentlichen aus.', 'This is how it looks after publishing.'))),
        h('div', { class: 'grow' }, h('h2', { style: 'margin-top:0' }, L('Anzeige-Plätze', 'Display slots')),
          Object.keys(SLOT).map(s => h('div', { class: 'row', style: 'margin:6px 0' }, h('span', { style: 'min-width:150px' }, SLOT[s]),
            h('select', { style: 'width:auto', onchange: ev => queue([op('slot.set', { slot: s, objective: ev.target.value })]) }, h('option', { value: '' }, L('(leer)', '(empty)')), m.objectives.map(o => h('option', { value: o.name, selected: m.slots[s] === o.name }, o.display || o.name))))))),
      h('div', { class: 'row', style: 'margin-top:16px' }, h('h2', { style: 'margin:0' }, 'Objectives (' + m.objectives.length + ')'), h('button', { class: 'px-btn primary', onclick: () => { newObj = true; render(); } }, '+ ' + L('Neues Objective', 'New objective'))),
      newObj ? objectiveForm() : null,
      m.objectives.length ? h('div', { class: 'pb-grid' }, m.objectives.map(objectiveTile)) : h('div', { class: 'empty', style: 'margin-top:12px' }, L('Noch keine Objectives.', 'No objectives yet.')));
  }

  // ---------- Tabelle ----------
  function table() {
    const m = draft(), lv = liveM();
    const entries = [...new Set(m.objectives.flatMap(o => Object.keys(o.scores)))].sort((a, b) => a.localeCompare(b));
    const liveVal = (o, e) => lv.objectives.find(x => x.name === o.name)?.scores[e];
    const ent = h('input', { list: 'pb-online', placeholder: L('Spieler/Eintrag', 'Player/entry'), style: 'max-width:200px' });
    const obj = h('select', { style: 'width:auto' }, m.objectives.map(o => h('option', { value: o.name }, o.display || o.name)));
    const val = h('input', { type: 'number', value: 0, style: 'width:100px' });
    return h('div', {}, h('datalist', { id: 'pb-online' }, st.online.map(n => h('option', { value: n }))),
      h('div', { class: 'card' }, h('div', { class: 'row' }, ent, obj, val, h('button', { class: 'px-btn primary', disabled: !m.objectives.length, onclick: () => ent.value.trim() && queue([op('score.set', { objective: obj.value, entry: ent.value.trim(), value: String(val.value) })]) }, L('Punkte setzen', 'Set score')))),
      entries.length ? h('div', { class: 'card', style: 'overflow:auto' }, h('table', {}, h('tr', {}, h('th', {}, L('Eintrag', 'Entry')), m.objectives.map(o => h('th', {}, o.display || o.name))),
        entries.map(e => h('tr', {}, h('td', {}, e), m.objectives.map(o => {
          const v = o.scores[e], changed = v !== liveVal(o, e);
          const inp = h('input', { class: 'pb-cell' + (changed ? ' pb-changed' : ''), type: 'number', value: v ?? '', placeholder: '–', onchange: ev => { const x = ev.target.value; queue([x === '' ? op('score.reset', { objective: o.name, entry: e }) : op('score.set', { objective: o.name, entry: e, value: x })]); } });
          return h('td', {}, inp);
        }))))) : h('div', { class: 'empty' }, L('Noch keine Punktestände.', 'No scores yet.')));
  }

  // ---------- Teams ----------
  function teamForm() {
    const name = h('input', { placeholder: 'name' }), disp = h('input', { placeholder: L('Anzeigename', 'Display name') });
    const color = h('select', {}, h('option', { value: '' }, L('(keine)', '(none)')), st.lists.colors.map(c => h('option', { value: c }, c)));
    return h('div', { class: 'card' }, h('div', { class: 'row' }, name, disp, color, h('button', { class: 'px-btn primary', onclick: async () => { if (await queue([op('team.create', { name: name.value.trim(), display: disp.value.trim(), color: color.value })])) { newTeam = false; render(); } } }, L('In den Entwurf', 'Add to draft')), h('button', { class: 'px-btn ghost', onclick: () => { newTeam = false; render(); } }, L('Abbrechen', 'Cancel'))));
  }
  function teams() {
    const m = draft();
    const mem = h('datalist', { id: 'pb-online' }, st.online.map(n => h('option', { value: n })));
    return h('div', {}, mem, h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, 'Teams (' + m.teams.length + ')'), h('button', { class: 'px-btn primary', onclick: () => { newTeam = true; render(); } }, '+ ' + L('Neues Team', 'New team'))), newTeam ? teamForm() : null,
      m.teams.length ? h('div', { class: 'pb-grid' }, m.teams.map(t => {
        const add = h('input', { list: 'pb-online', placeholder: L('Spieler hinzufügen', 'Add player'), style: 'max-width:170px' });
        const setv = (key, value) => queue([op('team.set', { name: t.name, key, value: String(value) })]);
        return h('div', { class: 'pb-tile' }, h('div', { class: 'row' }, h('span', { class: 'pb-swatch', style: 'background:' + (COLOR[t.color] || 'transparent') }), h('b', {}, t.display || t.name), t.owned ? null : h('span', { class: 'tag warn' }, L('Fremd', 'Foreign'))),
          h('div', { class: 'pb-top' }, h('span', {}, t.name), h('span', {}, t.members.length + ' ' + L('Mitglieder', 'members'))),
          h('div', { style: 'margin:8px 0' }, t.members.map(e => h('span', { class: 'pb-chip' }, e, h('a', { style: 'cursor:pointer', onclick: () => queue([op('team.remove', { name: t.name, entry: e })]) }, '×')))),
          h('div', { class: 'row' }, add, h('button', { class: 'px-btn small', onclick: () => add.value.trim() && queue([op('team.add', { name: t.name, entry: add.value.trim() })]) }, '+')),
          h('div', { class: 'row', style: 'margin-top:8px' }, h('select', { style: 'width:auto', onchange: ev => setv('color', ev.target.value) }, h('option', { value: '' }, L('(keine Farbe)', '(no color)')), st.lists.colors.map(c => h('option', { value: c, selected: t.color === c }, c))),
            h('label', { class: 'row', style: 'margin:0' }, h('input', { type: 'checkbox', style: 'width:auto', checked: t.friendlyFire, onchange: ev => setv('friendlyFire', ev.target.checked) }), L('Friendly Fire', 'Friendly fire'))),
          h('div', { class: 'row', style: 'margin-top:8px' }, h('input', { value: t.prefix, placeholder: L('Präfix', 'Prefix'), style: 'max-width:110px', maxlength: 16, onchange: ev => setv('prefix', ev.target.value) }), h('input', { value: t.suffix, placeholder: L('Suffix', 'Suffix'), style: 'max-width:110px', maxlength: 16, onchange: ev => setv('suffix', ev.target.value) })),
          h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { class: 'px-btn small danger', onclick: async () => { if (await ctx.confirm(L('Team "' + t.name + '" löschen (im Entwurf)?', 'Delete team "' + t.name + '" (in the draft)?'))) queue([op('team.delete', { name: t.name })]); } }, L('Löschen', 'Delete'))));
      })) : h('div', { class: 'empty', style: 'margin-top:12px' }, L('Noch keine Teams.', 'No teams yet.')));
  }

  // ---------- Rangliste ----------
  function ranking() {
    const m = draft();
    if (!m.objectives.length) return h('div', { class: 'empty' }, L('Noch keine Objectives.', 'No objectives yet.'));
    if (!m.objectives.some(o => o.name === rankObj)) rankObj = m.objectives[0].name;
    const o = m.objectives.find(x => x.name === rankObj), rows = Object.entries(o.scores).sort((a, b) => b[1] - a[1]).slice(0, 12), max = Math.max(1, ...rows.map(r => Math.abs(r[1])));
    const bars = rows.map(([e, v]) => { const fill = h('i', {}); requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = Math.max(2, Math.abs(v) / max * 100) + '%'; })); return h('div', {}, h('div', { class: 'pb-top' }, h('span', {}, e), h('b', {}, v)), h('div', { class: 'pb-bar2' }, fill)); });
    return h('div', { class: 'card' }, h('select', { style: 'width:auto', onchange: ev => { rankObj = ev.target.value; render(); } }, m.objectives.map(x => h('option', { value: x.name, selected: x.name === rankObj }, x.display || x.name))), h('div', { style: 'margin-top:12px' }, rows.length ? bars : h('div', { class: 'empty' }, L('Noch keine Punkte.', 'No scores yet.'))));
  }

  // ---------- Anzeige: eigene Seitenleiste pro Spieler ----------
  // Der Editor baut sich einmal auf und bleibt stehen; Tippen aendert nur "work". So zerstoert das regelmaessige Neuzeichnen der anderen Reiter nichts.
  let ds = null, work = null, pageIdx = 0, dirty = false, prevPlayer = '', prev = null, lastInput = null, frameNo = 0, prevTimer = null, dispEl = null;
  const clone = o => JSON.parse(JSON.stringify(o));
  const spansEl = spans => (spans || []).map(s => h('span', { style: (s.c ? 'color:' + s.c + ';' : '') + (s.f & 1 ? 'font-weight:bold;' : '') + (s.f & 2 ? 'font-style:italic;' : '') + (s.f & 12 ? 'text-decoration:' + (s.f & 4 ? 'underline ' : '') + (s.f & 8 ? 'line-through' : '') + ';' : '') }, s.t));
  const MCCOL = [['0', '#000000'], ['1', '#0000AA'], ['2', '#00AA00'], ['3', '#00AAAA'], ['4', '#AA0000'], ['5', '#AA00AA'], ['6', '#FFAA00'], ['7', '#AAAAAA'], ['8', '#555555'], ['9', '#5555FF'], ['a', '#55FF55'], ['b', '#55FFFF'], ['c', '#FF5555'], ['d', '#FF55FF'], ['e', '#FFFF55'], ['f', '#FFFFFF']];

  async function loadDisplay() {
    ds = await ctx.api('display'); work = clone(ds.display); dirty = false;
    pageIdx = Math.max(0, Math.min(pageIdx, work.pages.length - 1));
  }

  function buildDisplay() {
    const bar = h('div', {}), settings = h('div', {}), tpls = h('div', {}), pagesBar = h('div', {}), editor = h('div', {});
    const pvTitle = h('div', { class: 'pb-mc-t' }), pvLines = h('div', {}), pvNote = h('div', { class: 'sub', style: 'margin-top:8px' });
    const pvSel = h('select', { style: 'width:100%', onchange: ev => { prevPlayer = ev.target.value; refreshPreview(); } });
    const touch = () => { dirty = true; drawBar(); schedulePreview(); };
    const page = () => work.pages[pageIdx];

    function paintPreview() {
      if (!prev) { pvTitle.replaceChildren(); pvLines.replaceChildren(h('div', { class: 'sub' }, L('Keine Seite.', 'No page.'))); return; }
      pvTitle.replaceChildren(...spansEl(prev.title[frameNo % Math.max(1, prev.title.length)]));
      pvLines.replaceChildren(...prev.lines.map(l => h('div', { class: 'pb-mc-r' }, ...(l.length ? spansEl(l) : [' ']))));
    }
    async function refreshPreview() {
      pvSel.replaceChildren(h('option', { value: '' }, L('Beispielwerte', 'Sample values')), ...ds.online.map(n => h('option', { value: n, selected: n === prevPlayer }, L('Echte Werte von ', 'Live values of ') + n)));
      pvSel.value = ds.online.includes(prevPlayer) ? prevPlayer : '';
      if (!page()) { prev = null; paintPreview(); return; }
      try { prev = await ctx.api('display/preview', { method: 'POST', body: { page: page(), player: pvSel.value } }); paintPreview(); }
      catch (e) { pvLines.replaceChildren(h('div', { style: 'color:var(--bad)' }, e.message)); }
      pvNote.textContent = work.pages.length > 1 ? L('Seite ' + (pageIdx + 1) + ' von ' + work.pages.length + ' · wechselt alle ' + work.rotateSeconds + ' s', 'Page ' + (pageIdx + 1) + ' of ' + work.pages.length + ' · changes every ' + work.rotateSeconds + ' s') : '';
    }
    function schedulePreview() { clearTimeout(prevTimer); prevTimer = setTimeout(refreshPreview, 350); }

    function drawBar() {
      bar.replaceChildren(h('div', { class: 'row', style: 'align-items:center' },
        h('label', { class: 'row', style: 'margin:0;gap:8px' }, h('input', { type: 'checkbox', style: 'width:auto', checked: work.enabled, onchange: ev => { work.enabled = ev.target.checked; touch(); } }), h('b', {}, L('Anzeige rechts für alle Spieler einschalten', 'Show the sidebar display to all players'))),
        h('span', { class: 'grow' }),
        dirty ? h('span', { class: 'tag warn' }, L('Nicht gespeichert', 'Unsaved')) : null,
        h('button', { class: 'px-btn primary', disabled: !dirty, onclick: save }, L('Speichern und anwenden', 'Save and apply')),
        h('button', { class: 'px-btn ghost', disabled: !dirty, onclick: async () => { await loadDisplay(); drawAll(); refreshPreview(); } }, L('Verwerfen', 'Discard'))));
    }
    async function save() {
      try { ds = await ctx.api('display', { method: 'POST', body: work }); work = clone(ds.display); dirty = false; ctx.toast(L('Gespeichert, die Spieler sehen es jetzt', 'Saved, players see it now'), 'good'); drawAll(); }
      catch (e) { ctx.toast(e.message, 'bad'); }
    }
    function num(label, key, min, max, hint) {
      return h('div', {}, h('label', {}, label), h('input', { type: 'number', min, max, value: work[key], style: 'width:90px', onchange: ev => { work[key] = Math.max(min, Math.min(max, +ev.target.value || min)); ev.target.value = work[key]; touch(); } }), hint ? h('div', { class: 'sub' }, hint) : null);
    }
    function drawSettings() {
      settings.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'row', style: 'align-items:flex-start;gap:20px' },
        num(L('Seitenwechsel (Sek.)', 'Page change (sec.)'), 'rotateSeconds', 3, 300),
        num(L('Aktualisieren (Ticks)', 'Refresh (ticks)'), 'refreshTicks', 5, 200, L('20 Ticks = 1 Sekunde', '20 ticks = 1 second')),
        num(L('Titel-Tempo (Ticks)', 'Title speed (ticks)'), 'titleFrameTicks', 5, 100),
        h('label', { class: 'row', style: 'margin:0;gap:8px;align-self:center' }, h('input', { type: 'checkbox', style: 'width:auto', checked: work.mirrorMain, onchange: ev => { work.mirrorMain = ev.target.checked; touch(); } }),
          h('span', {}, L('Teams und Tab-Anzeige vom normalen Scoreboard übernehmen', 'Copy teams and tab display from the normal scoreboard'))))));
    }
    function drawTemplates() {
      tpls.replaceChildren(h('h2', {}, L('Vorlagen', 'Templates')), h('div', { class: 'pb-grid', style: 'margin-top:6px' }, ds.templates.map(t => h('div', { class: 'pb-tile' },
        h('b', {}, L(t.nameDe, t.nameEn)), h('p', { class: 'sub', style: 'min-height:48px' }, L(t.descDe, t.descEn)),
        h('button', { class: 'px-btn small', onclick: async () => { if (work.pages.length && !(await ctx.confirm(L('Die aktuelle Anzeige durch diese Vorlage ersetzen? (Erst beim Speichern gilt es im Spiel.)', 'Replace the current display with this template? (It only applies in the game once you save.)')))) return; const keep = work.enabled; work = clone(t.model); work.enabled = keep || work.enabled; pageIdx = 0; dirty = true; drawAll(); refreshPreview(); } }, L('Übernehmen', 'Use'))))));
    }
    function drawPages() {
      pagesBar.replaceChildren(h('div', { class: 'row' },
        work.pages.map((p, i) => h('button', { class: 'px-btn ' + (i === pageIdx ? 'active' : ''), onclick: () => { pageIdx = i; drawPages(); drawEditor(); refreshPreview(); } }, (i + 1) + ' ' + p.name)),
        work.pages.length < ds.limits.pages ? h('button', { class: 'px-btn primary', onclick: () => { work.pages.push({ name: L('Seite ', 'Page ') + (work.pages.length + 1), title: ['<gradient:gold:yellow><b>PeakVerse</b></gradient>'], lines: ['&7Hallo &f%player%'], permission: '' }); pageIdx = work.pages.length - 1; touch(); drawPages(); drawEditor(); } }, '+ ' + L('Seite', 'Page')) : null));
    }
    function field(arr, i, max, ph) {
      return h('input', { value: arr[i], maxlength: max, placeholder: ph || '', style: 'flex:1;min-width:0', onfocus: ev => { lastInput = ev.target; }, oninput: ev => { arr[i] = ev.target.value; touch(); } });
    }
    function insert(text) {
      const el = lastInput;
      if (!el || !el.isConnected) { ctx.toast(L('Erst in ein Textfeld klicken.', 'Click into a text field first.'), 'bad'); return; }
      const a = el.selectionStart ?? el.value.length, b = el.selectionEnd ?? a;
      el.value = el.value.slice(0, a) + text + el.value.slice(b); el.focus(); el.setSelectionRange(a + text.length, a + text.length); el.dispatchEvent(new Event('input'));
    }
    const noBlur = ev => ev.preventDefault();
    function toolbar() {
      const btn = (label, text, title, style) => h('button', { class: 'px-btn small', title, style: style || '', onmousedown: noBlur, onclick: () => insert(text) }, label);
      return h('div', { class: 'pb-tools' },
        MCCOL.map(([c, hex]) => h('button', { class: 'pb-sw', title: '&' + c, style: 'background:' + hex, onmousedown: noBlur, onclick: () => insert('&' + c) })),
        btn('B', '<b>', L('Fett', 'Bold'), 'font-weight:bold'), btn('I', '<i>', L('Kursiv', 'Italic'), 'font-style:italic'), btn('U', '<u>', L('Unterstrichen', 'Underline'), 'text-decoration:underline'),
        btn(L('Verlauf', 'Gradient'), '<gradient:#ff8800:#ffee55></gradient>', L('Farbverlauf: Text zwischen die Tags schreiben', 'Colour gradient: type the text between the tags')),
        btn(L('Regenbogen', 'Rainbow'), '<rainbow></rainbow>', L('Regenbogen-Farben', 'Rainbow colours')),
        btn(L('Zurücksetzen', 'Reset'), '&r', L('Farbe und Stil zurücksetzen', 'Reset colour and style')));
    }
    function chips() {
      const first = ds.objectives[0] || 'Kills';
      return h('div', { class: 'pb-chips' }, ds.catalog.map(e => { const key = e.key.replace('NAME', first); return h('button', { class: 'pb-chip', title: L(e.de, e.en) + ' (' + (e.sample) + ')', onmousedown: noBlur, onclick: () => insert('%' + key + '%') }, '%' + e.key + '%'); }));
    }
    function drawEditor() {
      const p = page();
      if (!p) { editor.replaceChildren(h('div', { class: 'empty' }, L('Noch keine Seite. Wähle oben eine Vorlage oder lege eine Seite an.', 'No page yet. Pick a template above or add a page.'))); return; }
      const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; touch(); drawEditor(); };
      const del = (arr, i) => { arr.splice(i, 1); touch(); drawEditor(); };
      editor.replaceChildren(h('div', { class: 'card' },
        h('div', { class: 'row' },
          h('div', {}, h('label', {}, L('Name der Seite', 'Page name')), h('input', { value: p.name, maxlength: 30, oninput: ev => { p.name = ev.target.value; touch(); }, onchange: drawPages })),
          h('div', {}, h('label', {}, L('Nur für Spieler mit Recht (leer = alle)', 'Only for players with permission (empty = all)')), h('input', { value: p.permission, placeholder: 'z. B. mein.recht', style: 'width:200px', oninput: ev => { p.permission = ev.target.value; touch(); } })),
          h('span', { class: 'grow' }),
          h('button', { class: 'px-btn small', disabled: pageIdx === 0, onclick: () => { move(work.pages, pageIdx, -1); pageIdx--; drawPages(); } }, '←'),
          h('button', { class: 'px-btn small', disabled: pageIdx >= work.pages.length - 1, onclick: () => { move(work.pages, pageIdx, 1); pageIdx++; drawPages(); } }, '→'),
          h('button', { class: 'px-btn small danger', onclick: async () => { if (await ctx.confirm(L('Diese Seite löschen?', 'Delete this page?'))) { work.pages.splice(pageIdx, 1); pageIdx = Math.max(0, pageIdx - 1); touch(); drawPages(); drawEditor(); } } }, L('Seite löschen', 'Delete page'))),
        h('h3', {}, L('Titel', 'Title'), ' ', h('span', { class: 'sub' }, L('Mehrere Bilder ergeben eine Animation.', 'Several frames make an animation.'))),
        p.title.map((t, i) => h('div', { class: 'row', style: 'margin:4px 0' }, h('span', { class: 'sub', style: 'min-width:54px' }, L('Bild ', 'Frame ') + (i + 1)), field(p.title, i, 60), p.title.length > 1 ? h('button', { class: 'px-btn small ghost', onclick: () => del(p.title, i) }, '×') : null)),
        p.title.length < ds.limits.frames ? h('button', { class: 'px-btn small', onclick: () => { p.title.push(p.title[p.title.length - 1] || ''); touch(); drawEditor(); } }, '+ ' + L('Bild', 'Frame')) : null,
        h('h3', {}, L('Zeilen', 'Lines'), ' ', h('span', { class: 'sub' }, p.lines.length + '/' + ds.limits.lines)),
        toolbar(),
        p.lines.map((t, i) => h('div', { class: 'row', style: 'margin:4px 0' }, field(p.lines, i, ds.limits.text, L('Leere Zeile = Abstand', 'Empty line = gap')),
          h('button', { class: 'px-btn small ghost', onclick: () => move(p.lines, i, -1) }, '↑'), h('button', { class: 'px-btn small ghost', onclick: () => move(p.lines, i, 1) }, '↓'), h('button', { class: 'px-btn small ghost', onclick: () => del(p.lines, i) }, '×'))),
        p.lines.length < ds.limits.lines ? h('button', { class: 'px-btn small', onclick: () => { p.lines.push(''); touch(); drawEditor(); } }, '+ ' + L('Zeile', 'Line')) : null,
        h('h3', {}, L('Platzhalter (anklicken zum Einfügen)', 'Placeholders (click to insert)')), chips(),
        h('p', { class: 'sub' }, L('Jeder Spieler kann die Anzeige mit /board für sich aus- und einschalten. Zähler für Events sind Objectives (Reiter Übersicht), die du mit %score:NAME% anzeigst.', 'Every player can switch the display off and on for themselves with /board. Event counters are objectives (Overview tab), shown with %score:NAME%.'))));
    }
    function drawAll() { drawBar(); drawSettings(); drawTemplates(); drawPages(); drawEditor(); }

    const el = h('div', {}, h('div', { class: 'pb-dgrid' },
      h('div', {}, bar, settings, tpls, h('h2', {}, L('Seiten', 'Pages')), pagesBar, editor),
      h('div', { class: 'pb-preview' }, h('h2', { style: 'margin-top:0' }, L('So sieht es im Spiel aus', 'How it looks in game')), pvSel,
        h('div', { class: 'pb-mc' }, pvTitle, pvLines), pvNote)));
    el._start = () => { drawAll(); refreshPreview(); };
    el._tick = () => { if (prev && prev.title.length > 1) { frameNo++; paintPreview(); } };
    el._timerMs = () => Math.max(250, (work ? work.titleFrameTicks : 10) * 50);
    return el;
  }

  function mountDisplay() {
    if (!dispEl) { dispEl = buildDisplay(); dispEl._start(); runFrames(); }
    return dispEl;
  }
  function runFrames() {
    setTimeout(() => {
      if (!root.isConnected) return;
      if (dispEl && tab === 'display') dispEl._tick();
      runFrames();
    }, dispEl ? dispEl._timerMs() : 500);
  }

  function render() {
    set(h('h1', {}, 'PeakBoard'), h('p', { class: 'sub' }, L('Anzeige für die Spieler, Scoreboard und Teams verwalten.', 'Manage the player display, scoreboard and teams.')),
      h('div', { class: 'row' }, [['display', L('Anzeige', 'Display')], ['overview', L('Übersicht', 'Overview')], ['table', L('Tabelle', 'Table')], ['teams', 'Teams'], ['rank', L('Rangliste', 'Ranking')]].map(([k, l]) => h('button', { class: 'px-btn ' + (tab === k ? 'active' : ''), onclick: () => { tab = k; render(); } }, l))),
      tab === 'display' ? null : draftBar(), h('div', { style: 'margin-top:14px' }, tab === 'display' ? mountDisplay() : tab === 'overview' ? overview() : tab === 'table' ? table() : tab === 'teams' ? teams() : ranking()));
  }

  // Punkte laufen im Spiel weiter: alle 5 Sekunden aktualisieren, solange man nichts eintippt. Der Anzeige-Editor wird nie von aussen neu gezeichnet.
  const timer = setInterval(async () => {
    if (!root.isConnected) { clearInterval(timer); return; }
    if (tab === 'display') return;
    if (root.contains(document.activeElement) && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
    try { await load(); render(); } catch { /* egal */ }
  }, 5000);
  ctx.on(async d => { if (d.module === 'peakboard' && tab !== 'display' && !root.contains(document.activeElement)) { await load(); render(); } });
  await load();
  await loadDisplay();
  render();
}
