// Seite "PeakBoard": Scoreboard ansehen und verwalten. Aenderungen landen zuerst im Entwurf und werden mit einem Klick veroeffentlicht.
export default async function mount(root, ctx) {
  const { h } = ctx;
  const L = (de, en) => ctx.t({ de, en });
  let st, tab = 'scene', rankObj = '', newObj = false, newTeam = false;
  const set = (...kids) => root.replaceChildren(...kids.filter(k => k != null && k !== false));
  const SLOT = { sidebar: L('Seitenleiste', 'Sidebar'), list: L('Tab-Liste', 'Player list'), below_name: L('Unter dem Namen', 'Below name') };
  const COLOR = { black: '#000', dark_blue: '#00a', dark_green: '#0a0', dark_aqua: '#0aa', dark_red: '#a00', dark_purple: '#a0a', gold: '#fa0', gray: '#aaa', dark_gray: '#555', blue: '#55f', green: '#5f5', aqua: '#5ff', red: '#f55', light_purple: '#f5f', yellow: '#ff5', white: '#fff' };
  const draft = () => st.draft, liveM = () => st.live;

  async function load() { st = await ctx.api('state'); }
  // Zeichnet nur neu, wenn sich wirklich etwas geaendert hat: sonst starten Animationen (Siegertreppchen, Balken) alle 5 Sekunden von vorn
  const sig = () => JSON.stringify([st.live, st.draft, st.ops, st.online, st.draftError]);
  async function refresh() { const before = st ? sig() : ''; await load(); if (sig() !== before) render(); }
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
.pb-ops{max-height:104px;overflow:auto;margin:8px 0}.pb-op{display:flex;gap:8px;align-items:center;padding:3px 0;font-size:13px}
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
.pb-chips{display:flex;flex-wrap:wrap;gap:2px}button.pb-chip{cursor:pointer;color:inherit;font-family:inherit}button.pb-chip:hover{border-color:var(--accent)}
.pb-sw.on{outline:3px solid var(--accent);outline-offset:1px}.pb-sw.none{background:var(--panel2);color:var(--dim);font-size:12px;line-height:14px}
.pb-sort{cursor:pointer;user-select:none}.pb-sort:hover{color:var(--accent)}
.pbs-wrap{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(300px,1fr);gap:22px;align-items:start}@media(max-width:1000px){.pbs-wrap{grid-template-columns:1fr}}
.pbs-insp{position:sticky;top:70px;max-height:calc(100vh - 90px);overflow:auto}
.pb-head{display:inline-block;width:20px;height:20px;flex:none;background:var(--skin);position:relative;image-rendering:pixelated;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35);background-image:linear-gradient(var(--hair) 0 32%,transparent 32%),linear-gradient(90deg,transparent 22%,#fff 22% 36%,#35a 36% 44%,transparent 44% 56%,#35a 56% 64%,#fff 64% 78%,transparent 78%);background-size:100% 100%,100% 34%;background-position:0 0,0 52%;background-repeat:no-repeat}
.pbs-scene{position:relative;height:420px;overflow:hidden;border:4px solid #000;box-shadow:6px 6px 0 rgba(0,0,0,.45),0 0 40px rgba(111,140,255,.25);background:linear-gradient(#4a86e8 0,#8fc0ff 55%,#cfe8ff 100%);cursor:default;image-rendering:pixelated;transition:background .6s}
.pbs-scene.night{background:linear-gradient(#070b24 0,#182a5c 60%,#2d4a86 100%)}
.pbs-sun{position:absolute;right:18%;top:26px;width:46px;height:46px;background:#ffe45a;box-shadow:0 0 0 6px rgba(255,228,90,.35),0 0 60px 20px rgba(255,228,90,.35);animation:pbsun 6s ease-in-out infinite alternate}
.night .pbs-sun{background:#e9eefc;box-shadow:0 0 0 6px rgba(233,238,252,.2),0 0 50px 12px rgba(180,200,255,.3)}
@keyframes pbsun{to{transform:translateY(6px) scale(1.04)}}
.pbs-cloud{position:absolute;width:90px;height:24px;background:#fff;opacity:.9;box-shadow:24px -14px 0 #fff,52px -6px 0 #fff,-18px 6px 0 -2px #fff;animation:pbcloud linear infinite}.night .pbs-cloud{background:#8fa0d0;box-shadow:24px -14px 0 #8fa0d0,52px -6px 0 #8fa0d0,-18px 6px 0 -2px #8fa0d0;opacity:.35}
@keyframes pbcloud{from{margin-left:-140px}to{margin-left:110%}}
.pbs-hills{position:absolute;left:0;right:0;bottom:30%;height:30%;background:linear-gradient(135deg,transparent 0 22%,#3c8a3a 22% 40%,transparent 40%),linear-gradient(225deg,transparent 0 30%,#357f33 30% 52%,transparent 52%),linear-gradient(135deg,transparent 0 55%,#3c8a3a 55% 75%,transparent 75%);opacity:.9}.night .pbs-hills{filter:brightness(.4)}
.pbs-tree{position:absolute;width:30px;height:70px;z-index:0}.pbs-tree i{position:absolute;left:11px;bottom:0;width:8px;height:30px;background:#7a4a1f}.pbs-tree b{position:absolute;left:0;bottom:24px;width:30px;height:34px;background:#2f9a3a;box-shadow:0 -12px 0 -4px #3cb04a,inset -6px -6px 0 rgba(0,0,0,.16)}.night .pbs-tree{filter:brightness(.45)}
.pbs-ground{position:absolute;left:0;right:0;bottom:0;height:32%;background:repeating-linear-gradient(90deg,#5fae3c 0 24px,#55a335 24px 48px);border-top:8px solid #3f8a2a}
.pbs-ground:before{content:'';position:absolute;left:0;right:0;top:0;bottom:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.14) 0 4px,transparent 4px 28px),linear-gradient(transparent 55%,#7a4a1f 55%);}
.night .pbs-ground{filter:brightness(.5)}
.pbs-hot{position:absolute;cursor:pointer;transition:outline-color .15s,transform .15s,box-shadow .2s;outline:2px dashed rgba(255,255,255,.0);outline-offset:3px;animation:pbpulse 2.8s ease-in-out infinite}
@keyframes pbpulse{0%,100%{outline-color:rgba(255,255,255,0)}50%{outline-color:rgba(255,255,255,.55)}}
.pbs-hot:hover{outline-color:#fff;animation:none;box-shadow:0 0 22px rgba(255,255,255,.35)}.pbs-hot.on{outline:3px solid var(--accent);outline-offset:3px;animation:none;box-shadow:0 0 26px rgba(111,140,255,.55)}
.pbs-pen{position:absolute;right:-9px;top:-11px;width:20px;height:20px;line-height:20px;text-align:center;background:var(--accent);color:#000;font-size:12px;opacity:0;transform:scale(.4);transition:.15s;pointer-events:none}.pbs-hot:hover>.pbs-pen,.pbs-hot.on>.pbs-pen{opacity:1;transform:none}
.pbs-tab{top:12px;left:50%;transform:translateX(-50%);min-width:250px;background:rgba(20,20,20,.62);color:#fff;padding:5px 12px 7px;z-index:3;font-size:13px;text-shadow:1px 1px 0 #3f3f3f;font-family:Consolas,'Courier New',monospace}
.pbs-tab:hover{transform:translateX(-50%) scale(1.03)}.pbs-cap{text-align:center;opacity:.75;font-size:11px;margin-bottom:4px;letter-spacing:1px;text-transform:uppercase}.pbs-trow{display:flex;justify-content:space-between;gap:22px;align-items:center;padding:1px 0}.pbs-tn{display:flex;gap:6px;align-items:center}.pbs-trow b{color:#ffd86b;font-weight:normal}
.pbs-empty{opacity:.75;text-align:center;font-size:12px;border-top:1px dashed rgba(255,255,255,.4);margin-top:4px;padding-top:4px}
.pbs-side{right:12px;top:92px;z-index:3}.pbs-side .pb-side{width:210px;box-shadow:none;font-family:Consolas,'Courier New',monospace;text-shadow:1px 1px 0 #3f3f3f}.pbs-side:hover{transform:scale(1.03)}
.pbs-chars{position:absolute;left:5%;right:40%;bottom:46px;display:flex;justify-content:space-around;align-items:flex-end;z-index:2}
.pbs-char{position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;padding:4px 8px 0;outline:2px dashed transparent;transition:transform .15s,filter .15s;animation:pbbob 2.4s ease-in-out infinite}
@keyframes pbbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.pbs-char:hover{outline-color:#fff;filter:brightness(1.15);animation-play-state:paused}.pbs-char.on{outline:3px solid var(--accent);box-shadow:0 0 26px rgba(111,140,255,.55)}
.pbs-nt{background:rgba(0,0,0,.5);padding:1px 8px;font-size:13px;white-space:nowrap;font-family:Consolas,'Courier New',monospace;text-shadow:1px 1px 0 #3f3f3f}
.pbs-below{position:static;font-size:12px;color:#fff;background:rgba(0,0,0,.35);padding:0 6px;margin:2px 0 4px;text-shadow:1px 1px 0 #3f3f3f;animation:none}.pbs-below.empty{opacity:.7;border:1px dashed #fff;font-size:11px}.pbs-bv{color:#ffd86b}
.pbs-torso{position:relative;width:34px;height:44px;margin-top:-2px;box-shadow:inset 0 -6px 0 rgba(0,0,0,.18),inset 0 0 0 1px rgba(0,0,0,.3)}
.pbs-torso i{position:absolute;top:0;width:10px;height:38px;box-shadow:inset 0 -6px 0 rgba(0,0,0,.2),inset 0 0 0 1px rgba(0,0,0,.3);filter:brightness(.92)}.pbs-torso i:first-child{left:-11px}.pbs-torso i:last-child{right:-11px}
.pbs-legs{display:flex;gap:2px;width:34px}.pbs-legs i{display:block;flex:1;height:34px;background:#3a3f9a;box-shadow:inset 0 -8px 0 #2a2d6a,inset 0 0 0 1px rgba(0,0,0,.3)}
.pbs-hotbar{position:absolute;left:50%;bottom:6px;transform:translateX(-50%);display:flex;gap:2px;background:rgba(30,30,30,.7);padding:3px;z-index:3;border:2px solid #111}.pbs-slot{width:30px;height:30px;background:rgba(120,120,120,.35);border:2px solid #555;display:flex;align-items:center;justify-content:center}.pbs-slot.on{border-color:#fff}.pbs-slot i{display:block;width:16px;height:16px;box-shadow:inset -3px -3px 0 rgba(0,0,0,.25)}
.pbs-tog{position:absolute;left:10px;top:10px;z-index:4;width:34px;height:34px;background:rgba(0,0,0,.45);color:#fff;border:2px solid rgba(255,255,255,.5);font-size:18px;cursor:pointer;transition:.2s}.pbs-tog:hover{background:var(--accent);color:#000;transform:rotate(20deg)}
.pbs-note{position:absolute;left:52px;top:18px;font-size:11px;color:#fff;background:rgba(0,0,0,.45);padding:1px 8px;z-index:3}
.pbs-teams{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px;padding:10px 12px;background:var(--panel);border:2px solid var(--line)}
.pbs-tchip{display:inline-flex;gap:8px;align-items:center;background:linear-gradient(90deg,color-mix(in srgb,var(--c) 45%,transparent),transparent);border:2px solid var(--c);color:inherit;font-family:inherit;padding:3px 10px;cursor:pointer;transition:transform .15s,box-shadow .15s}.pbs-tchip:hover{transform:translateY(-2px);box-shadow:0 4px 14px color-mix(in srgb,var(--c) 50%,transparent)}.pbs-tchip span{background:rgba(0,0,0,.35);padding:0 6px;font-size:12px}
.pbs-opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.pbs-opt{border:2px solid var(--line);background:var(--panel2);padding:10px;cursor:pointer;transition:border-color .15s,transform .15s,box-shadow .15s}.pbs-opt:hover{border-color:var(--accent);transform:translateY(-3px);box-shadow:0 6px 16px rgba(0,0,0,.3)}.pbs-opt.on{border-color:var(--good);box-shadow:0 0 0 2px var(--good) inset,0 0 18px rgba(80,200,120,.25)}
.pbs-list{margin:6px 0 10px 18px;padding:0}.pbs-list li{margin:4px 0}
.pbt-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-top:16px;align-items:start}
.pbt-col{background:var(--panel);border:2px solid var(--line);min-height:170px;transition:border-color .15s,background .15s,transform .15s,box-shadow .2s}.pbt-col.over{border-color:var(--accent);background:var(--panel2);transform:scale(1.02);box-shadow:0 0 28px rgba(111,140,255,.45)}
.pbt-head{display:flex;gap:8px;align-items:center;padding:10px 12px;border-bottom:3px solid var(--line);background:linear-gradient(90deg,color-mix(in srgb,var(--c,#888) 38%,transparent),transparent)}.pbt-list{display:flex;flex-direction:column;gap:7px;padding:12px;min-height:100px}
.pbt-chip{display:flex;align-items:center;gap:8px;background:var(--panel2);border:2px solid var(--line);padding:5px 10px 5px 6px;cursor:grab;user-select:none;transition:transform .15s,border-color .15s,box-shadow .15s;animation:pbpop2 .3s}.pbt-chip:hover{border-color:var(--accent);transform:translateX(4px) rotate(-1deg);box-shadow:0 4px 12px rgba(0,0,0,.3)}.pbt-chip:active{cursor:grabbing}.pbt-chip.drag{opacity:.35;transform:scale(.95)}
@keyframes pbpop2{from{transform:scale(.8);opacity:0}to{transform:none;opacity:1}}
.pbt-dot{display:inline-block;width:9px;height:9px;background:#4c4;border-radius:50%;margin-right:6px;box-shadow:0 0 8px #4c4}.pbt-chip .pbt-dot{margin:0 0 0 auto}.pbt-hint{color:var(--dim);text-align:center;font-size:13px;padding:26px 0;border:2px dashed var(--line);animation:pbblink 2.4s ease-in-out infinite}
@keyframes pbblink{50%{opacity:.5}}
.pbr-row{display:flex;gap:12px;align-items:center;padding:6px 8px;cursor:pointer;transition:background .15s,transform .15s}.pbr-row:hover{background:var(--panel2);transform:translateX(4px)}.pbr-rank{min-width:34px;text-align:center;font-size:19px}
.pbr-podium{display:flex;justify-content:center;align-items:flex-end;gap:10px;margin:6px 0 18px;height:170px}.pbr-pod{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;cursor:pointer;width:118px}
.pbr-pod .blk{width:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:2px;padding-top:8px;border:3px solid #000;box-shadow:inset 0 -10px 0 rgba(0,0,0,.2),inset 0 6px 0 rgba(255,255,255,.25);transform-origin:bottom;animation:pbrise .8s cubic-bezier(.2,1.2,.4,1) both}
@keyframes pbrise{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.pbr-pod.p1 .blk{height:100px;background:#e8b923}.pbr-pod.p2 .blk{height:72px;background:#b8c0c8;animation-delay:.12s}.pbr-pod.p3 .blk{height:54px;background:#c07a3a;animation-delay:.24s}
.pbr-pod .nm{font-weight:bold;max-width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:4px}.pbr-pod .pt{color:var(--dim);font-size:13px}.pbr-pod .blk b{color:#000;font-size:20px}
.pb-tile{position:relative;overflow:hidden}.pb-tile:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(var(--accent),var(--accent2,var(--accent)))}
table tr:hover td{background:rgba(111,140,255,.08)}`;
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

  // ---------- Spielansicht: sieht aus wie das Minecraft-Bild, man klickt an, was man aendern will ----------
  let sel = null, tq = '', tOnline = false, tSort = { col: '', dir: 1 }, bulkObj = '', bulkVal = 10, teamSel = '', rankQ = '', tableObj = '';
  const ci = (a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' });
  const CRIT = {
    dummy: ['Von Hand gesetzt (für Events und eigene Punkte)', 'Set by hand (events, custom points)'],
    trigger: ['Spieler ändern es selbst mit /trigger', 'Players change it with /trigger'],
    deathCount: ['Tode (zählt automatisch)', 'Deaths (automatic)'],
    playerKillCount: ['Spieler-Kills (automatisch)', 'Player kills (automatic)'],
    totalKillCount: ['Alle Kills (automatisch)', 'All kills (automatic)'],
    health: ['Leben (live)', 'Health (live)'], xp: ['XP-Punkte (live)', 'XP points (live)'], level: ['XP-Level (live)', 'XP level (live)'],
    food: ['Hunger (live)', 'Food (live)'], air: ['Luft (live)', 'Air (live)'], armor: ['Rüstung (live)', 'Armor (live)'],
    'minecraft.custom:minecraft.play_time': ['Spielzeit (automatisch)', 'Play time (automatic)'],
    'minecraft.custom:minecraft.jump': ['Sprünge (automatisch)', 'Jumps (automatic)'],
    'minecraft.custom:minecraft.walk_one_cm': ['Gelaufene Strecke (automatisch)', 'Distance walked (automatic)'],
    'minecraft.custom:minecraft.deaths': ['Tode (Statistik)', 'Deaths (statistic)'],
    'minecraft.custom:minecraft.mob_kills': ['Mob-Kills (automatisch)', 'Mob kills (automatic)'],
    'minecraft.custom:minecraft.player_kills': ['Spieler-Kills (Statistik)', 'Player kills (statistic)'],
    'minecraft.custom:minecraft.damage_dealt': ['Schaden ausgeteilt (automatisch)', 'Damage dealt (automatic)'],
    'minecraft.custom:minecraft.fish_caught': ['Gefangene Fische (automatisch)', 'Fish caught (automatic)']
  };
  const critName = c => CRIT[c] ? L(CRIT[c][0], CRIT[c][1]) : c;
  const SLOT_HELP = {
    sidebar: L('Die Liste rechts am Bildschirmrand: zeigt die Punkte der Spieler, die höchsten oben. (Ist die „Anzeige“ eingeschaltet, sieht jeder Spieler dort stattdessen seine eigene Anzeige.)', 'The list at the right edge: shows players\' points, highest first. (With the "Display" switched on, every player sees their own display there instead.)'),
    list: L('Die Zahl hinter dem Namen, wenn man die Tab-Taste gedrückt hält.', 'The number behind the name while holding the Tab key.'),
    below_name: L('Die Zahl unter dem Namen über dem Kopf der Spieler.', 'The number below the name above players\' heads.')
  };
  const NAMETAG = { always: ['Immer sichtbar', 'Always visible'], never: ['Nie sichtbar', 'Never visible'], hide_for_other_teams: ['Nur für das eigene Team', 'Own team only'], hide_for_own_team: ['Nur für andere Teams', 'Other teams only'] };
  const colorHex = c => COLOR[c] || '#fff';
  const teamOf = (m, name) => m.teams.find(t => t.members.includes(name));
  const pick = (kind, extra) => { sel = { kind, ...extra }; render(); };
  const swatches = (current, onPick) => h('div', { class: 'pb-tools' }, h('button', { class: 'pb-sw none' + (!current ? ' on' : ''), title: L('keine Farbe', 'no colour'), onclick: () => onPick('') }, '∅'),
    st.lists.colors.map(c => h('button', { class: 'pb-sw' + (current === c ? ' on' : ''), title: c, style: 'background:' + colorHex(c), onclick: () => onPick(c) })));
  const help = (de, en) => h('p', { class: 'sub' }, L(de, en));

  const hash = s => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) | 0; return Math.abs(x); };
  const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'], HAIR = ['#3b2a1a', '#1d1d1d', '#a0522d', '#d8b04a', '#6b3fa0', '#c0392b'];
  const head = (name, size) => h('span', { class: 'pb-head', style: '--skin:' + SKIN[hash(name) % SKIN.length] + ';--hair:' + HAIR[hash(name + 'h') % HAIR.length] + ';' + (size ? 'width:' + size + 'px;height:' + size + 'px;' : '') });
  let night = false;
  try { night = localStorage.getItem('pb-night') === '1'; } catch { /* egal */ }
  const ITEMS = ['#c0c0c0', '#8b5a2b', '#e33', '#4ad', '#fc4', '#5b5', '', '#a6f', ''];

  function scene() {
    const m = draft(), listObj = m.objectives.find(o => o.name === m.slots.list), belowObj = m.objectives.find(o => o.name === m.slots.below_name);
    const example = !st.online.length, names = example ? ['Steve', 'Alex'] : st.online.slice(0, 6);
    const hot = (slot, cls, kids) => h('div', { class: 'pbs-hot ' + cls + (sel && sel.kind === 'slot' && sel.slot === slot ? ' on' : ''), title: L('Anklicken zum Ändern', 'Click to edit'), onclick: ev => { ev.stopPropagation(); pick('slot', { slot }); } }, [kids].flat(Infinity), h('span', { class: 'pbs-pen' }, '✎'));
    const tabList = hot('list', 'pbs-tab', [h('div', { class: 'pbs-cap' }, SLOT.list), names.map(n => { const t = teamOf(m, n); return h('div', { class: 'pbs-trow' }, h('span', { class: 'pbs-tn' }, head(n, 12), h('span', { style: 'color:' + (t ? colorHex(t.color) : '#fff') }, (t ? t.prefix : '') + n)), listObj ? h('b', {}, listObj.scores[n] ?? 0) : null); }),
      listObj ? null : h('div', { class: 'pbs-empty' }, '+ ' + L('Zahl hinter den Namen', 'number behind names'))]);
    const side = hot('sidebar', 'pbs-side', [sidebarView(m)]);
    const shirts = ['#2f8fd0', '#d0702f', '#4aa84a', '#a04ad0', '#d04a6a', '#c9a62c'];
    const chars = names.map((n, i) => {
      const t = teamOf(m, n), shirt = t && t.color ? colorHex(t.color) : shirts[i % shirts.length];
      return h('div', { class: 'pbs-char' + (sel && sel.kind === 'player' && sel.name === n ? ' on' : ''), style: 'animation-delay:' + (i * 0.35) + 's', onclick: ev => { ev.stopPropagation(); pick('player', { name: n }); }, title: L('Spieler anklicken', 'Click the player') },
        h('div', { class: 'pbs-nt', style: 'color:' + (t ? colorHex(t.color) : '#fff') }, (t ? t.prefix : '') + n + (t ? t.suffix : '')),
        hot('below_name', 'pbs-below' + (belowObj ? '' : ' empty'), belowObj ? [h('span', { class: 'pbs-bv' }, belowObj.render === 'hearts' ? '♥ ' + (belowObj.scores[n] ?? 0) : belowObj.scores[n] ?? 0), ' ', belowObj.display || belowObj.name] : '+ ' + L('unter dem Namen', 'below name')),
        head(n, 34), h('div', { class: 'pbs-torso', style: 'background:' + shirt }, h('i', { style: 'background:' + shirt }), h('i', { style: 'background:' + shirt })),
        h('div', { class: 'pbs-legs' }, h('i', {}), h('i', {})));
    });
    const trees = [[8, 44, 1], [18, 40, 0.8], [58, 46, 0.9]].map(([x, y, s]) => h('div', { class: 'pbs-tree', style: 'left:' + x + '%;bottom:' + y + '%;transform:scale(' + s + ')' }, h('i', {}), h('b', {})));
    const clouds = [[8, 12, 1], [40, 22, 0.7], [70, 8, 1.2]].map(([x, y, s], i) => h('div', { class: 'pbs-cloud', style: 'left:' + x + '%;top:' + y + '%;transform:scale(' + s + ');animation-duration:' + (50 + i * 17) + 's' }));
    const hotbar = h('div', { class: 'pbs-hotbar' }, ITEMS.map((c, i) => h('div', { class: 'pbs-slot' + (i === 0 ? ' on' : '') }, c ? h('i', { style: 'background:' + c }) : null)));
    const teamsBar = h('div', { class: 'pbs-teams' }, h('b', {}, 'Teams'),
      m.teams.map(t => h('button', { class: 'pbs-tchip', style: '--c:' + colorHex(t.color), onclick: () => pick('team', { name: t.name }) }, t.display || t.name, h('span', {}, t.members.length))),
      h('button', { class: 'px-btn small', onclick: () => pick('newteam') }, '+ ' + L('Team', 'Team')), h('span', { class: 'grow' }), h('button', { class: 'px-btn small primary', onclick: () => { tab = 'teams'; render(); } }, L('Spieler in Teams ziehen →', 'Drag players into teams →')));
    return h('div', { class: 'pbs-wrap' },
      h('div', {},
        h('div', { class: 'pbs-scene' + (night ? ' night' : ''), onclick: () => { sel = null; render(); } },
          h('div', { class: 'pbs-sun' }), clouds, h('div', { class: 'pbs-hills' }), trees, h('div', { class: 'pbs-ground' }), tabList, side, h('div', { class: 'pbs-chars' }, chars), hotbar,
          h('button', { class: 'pbs-tog', title: L('Tag/Nacht', 'Day/night'), onclick: ev => { ev.stopPropagation(); night = !night; try { localStorage.setItem('pb-night', night ? '1' : '0'); } catch { /* egal */ } render(); } }, night ? '☀' : '☾'),
          example ? h('div', { class: 'pbs-note' }, L('Beispielspieler, bis jemand online ist', 'Example players until someone is online')) : null),
        teamsBar,
        h('div', { class: 'row', style: 'margin-top:18px' }, h('h2', { style: 'margin:0' }, L('Alle Objectives', 'All objectives') + ' (' + m.objectives.length + ')'), h('span', { class: 'sub' }, L('Ein Objective ist eine Punkte-Spalte, zum Beispiel „Kills“.', 'An objective is a column of points, for example "Kills".')), h('span', { class: 'grow' }),
          h('button', { class: 'px-btn primary', onclick: () => pick('newobj', {}) }, '+ ' + L('Neues Objective', 'New objective'))),
        m.objectives.length ? h('div', { class: 'pb-grid' }, m.objectives.map(objectiveTile)) : h('div', { class: 'empty', style: 'margin-top:12px' }, L('Noch keine Objectives. Lege das erste an, dann kannst du es rechts im Bild anzeigen.', 'No objectives yet. Create the first one, then show it on the right of the picture.'))),
      h('div', { class: 'pbs-insp' }, inspector()));
  }

  function objectiveTile(o) {
    const m = draft(), top = Object.entries(o.scores).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const where = Object.entries(m.slots).filter(([, v]) => v === o.name).map(([k]) => SLOT[k]);
    return h('div', { class: 'pb-tile' },
      h('div', { class: 'row' }, h('b', {}, o.display || o.name), o.owned ? null : h('span', { class: 'tag warn', title: L('Nicht von PeakBoard angelegt: Änderungen müssen bestätigt werden', 'Not created by PeakBoard: changes need confirmation') }, L('Fremd', 'Foreign'))),
      h('div', { class: 'pb-top' }, h('span', {}, o.name + ' · ' + critName(o.criteria)), h('span', {}, Object.keys(o.scores).length + ' ' + L('Einträge', 'entries'))),
      where.length ? h('div', { style: 'margin:6px 0' }, where.map(w => h('span', { class: 'chip good' }, w))) : null,
      top.length ? top.map(([e, v]) => h('div', { class: 'pb-top' }, h('span', {}, e), h('b', {}, v))) : h('div', { class: 'sub' }, L('Noch keine Punkte.', 'No scores yet.')),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'px-btn small', onclick: () => pick('obj', { name: o.name }) }, L('Bearbeiten', 'Edit')),
        h('button', { class: 'px-btn small', onclick: () => { tab = 'table'; tableObj = o.name; render(); } }, L('Punkte', 'Scores'))));
  }

  function inspector() {
    const m = draft();
    if (!sel) return h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, L('Was möchtest du ändern?', 'What do you want to change?')),
      h('p', {}, L('Klicke links im Bild auf etwas:', 'Click something in the picture:')),
      h('ul', { class: 'pbs-list' }, h('li', {}, h('b', {}, SLOT.sidebar), ' – ' + L('die Liste rechts', 'the list on the right')), h('li', {}, h('b', {}, SLOT.list), ' – ' + L('die Zahlen im Tab-Fenster', 'the numbers in the Tab window')),
        h('li', {}, h('b', {}, SLOT.below_name), ' – ' + L('die Zahl über dem Kopf', 'the number above heads')), h('li', {}, h('b', {}, L('Ein Spieler', 'A player')), ' – ' + L('sein Team und seine Punkte', 'their team and points'))),
      h('p', { class: 'sub' }, L('Alles, was du hier änderst, landet zuerst im Entwurf oben. Erst „Veröffentlichen“ macht es im Spiel sichtbar.', 'Everything you change goes into the draft above first. Only "Publish" makes it visible in the game.')));
    if (sel.kind === 'slot') return slotInspector(sel.slot);
    if (sel.kind === 'player') return playerInspector(sel.name);
    if (sel.kind === 'team' && m.teams.some(t => t.name === sel.name)) return teamEditor(m.teams.find(t => t.name === sel.name), () => { sel = null; });
    if (sel.kind === 'obj' && m.objectives.some(o => o.name === sel.name)) return h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, 'Objective'), objectiveEditor(m.objectives.find(o => o.name === sel.name)));
    if (sel.kind === 'newobj') return newObjForm(sel.slot);
    if (sel.kind === 'newteam') return newTeamForm();
    return h('div', { class: 'card' }, h('p', { class: 'sub' }, L('Das gibt es nicht mehr.', 'This no longer exists.')));
  }

  function slotInspector(slot) {
    const m = draft(), cur = m.objectives.find(o => o.name === m.slots[slot]);
    const card = (o, active) => h('div', { class: 'pbs-opt' + (active ? ' on' : ''), onclick: () => queue([op('slot.set', { slot, objective: o ? o.name : '' })]) },
      h('b', {}, o ? (o.display || o.name) : L('Nichts anzeigen', 'Show nothing')), o ? h('div', { class: 'sub' }, critName(o.criteria)) : h('div', { class: 'sub' }, L('Der Platz bleibt leer', 'The spot stays empty')));
    return h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, SLOT[slot]), h('p', { class: 'sub' }, SLOT_HELP[slot]),
      h('h3', {}, L('Was soll hier angezeigt werden?', 'What should be shown here?')),
      h('div', { class: 'pbs-opts' }, card(null, !cur), m.objectives.map(o => card(o, cur && cur.name === o.name))),
      h('div', { style: 'margin:10px 0' }, h('button', { class: 'px-btn small primary', onclick: () => pick('newobj', { slot }) }, '+ ' + L('Neues Objective dafür anlegen', 'Create a new objective for it'))),
      cur ? [h('h3', {}, L('Einstellungen von „', 'Settings of "') + (cur.display || cur.name) + '”'), objectiveEditor(cur)] : null);
  }

  function objectiveEditor(o) {
    const rows = Object.entries(o.scores).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const disp = h('input', { value: o.display || o.name, maxlength: 40, onchange: ev => queue([op('objective.display', { name: o.name, display: ev.target.value })]) });
    const render_ = h('select', { onchange: ev => queue([op('objective.render', { name: o.name, render: ev.target.value })]) }, st.lists.render.map(r => h('option', { value: r, selected: o.render === r }, r === 'hearts' ? L('Herzen', 'Hearts') : L('Zahl', 'Number'))));
    return h('div', {},
      h('div', { class: 'row' }, h('div', {}, h('label', {}, L('Anzeigename', 'Display name')), disp), h('div', {}, h('label', {}, L('Darstellung', 'Look')), render_)),
      h('p', { class: 'sub' }, h('b', {}, o.name), ' · ' + critName(o.criteria) + (o.owned ? '' : ' · ' + L('Fremd (nicht von PeakBoard)', 'Foreign (not from PeakBoard)'))),
      h('h3', {}, L('Die besten Punkte', 'Top scores')),
      rows.length ? rows.map(([e, v]) => h('div', { class: 'row', style: 'margin:3px 0' }, h('span', { style: 'min-width:110px' }, e),
        h('button', { class: 'px-btn small ghost', onclick: () => queue([op('score.add', { objective: o.name, entry: e, value: '-1' })]) }, '−1'),
        h('input', { type: 'number', class: 'pb-cell', value: v, onchange: ev => queue([ev.target.value === '' ? op('score.reset', { objective: o.name, entry: e }) : op('score.set', { objective: o.name, entry: e, value: ev.target.value })]) }),
        h('button', { class: 'px-btn small ghost', onclick: () => queue([op('score.add', { objective: o.name, entry: e, value: '1' })]) }, '+1'))) : h('div', { class: 'sub' }, L('Noch keine Punkte.', 'No scores yet.')),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'px-btn small', onclick: () => { tab = 'table'; tableObj = o.name; render(); } }, L('Alle Punkte bearbeiten →', 'Edit all scores →')),
        h('button', { class: 'px-btn small danger', onclick: async () => { if (await ctx.confirm(L('Objective "' + o.name + '" löschen (im Entwurf)?', 'Delete objective "' + o.name + '" (in the draft)?'))) { sel = null; queue([op('objective.delete', { name: o.name })]); } } }, L('Löschen', 'Delete'))));
  }

  function newObjForm(slot) {
    const name = h('input', { placeholder: 'kills', maxlength: 16 }), disp = h('input', { placeholder: L('z. B. Kills', 'e.g. Kills'), maxlength: 40 });
    const crit = h('select', {}, st.lists.criteria.map(c => h('option', { value: c }, critName(c))));
    const rend = h('select', {}, st.lists.render.map(r => h('option', { value: r }, r === 'hearts' ? L('Herzen', 'Hearts') : L('Zahl', 'Number'))));
    return h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, L('Neues Objective', 'New objective')),
      help('Ein Objective ist eine Spalte mit Punkten. Die Art bestimmt, woher die Punkte kommen: von Hand gesetzt oder automatisch gezählt.', 'An objective is a column of points. The kind decides where points come from: set by hand or counted automatically.'),
      h('label', {}, L('Name (kleine Buchstaben, Zahlen, _)', 'Name (lowercase letters, digits, _)')), name, h('label', {}, L('Anzeigename', 'Display name')), disp,
      h('label', {}, L('Art', 'Kind')), crit, h('label', {}, L('Darstellung', 'Look')), rend,
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'px-btn primary', onclick: async () => {
        const n = name.value.trim(), ops = [op('objective.create', { name: n, criteria: crit.value, display: disp.value.trim(), render: rend.value })];
        if (slot) ops.push(op('slot.set', { slot, objective: n }));
        if (await queue(ops)) pick(slot ? 'slot' : 'obj', slot ? { slot } : { name: n });
      } }, L('In den Entwurf', 'Add to draft')), h('button', { class: 'px-btn ghost', onclick: () => { sel = null; render(); } }, L('Abbrechen', 'Cancel'))));
  }

  function newTeamForm() {
    const name = h('input', { placeholder: 'rot', maxlength: 16 }), disp = h('input', { placeholder: L('z. B. Team Rot', 'e.g. Team Red'), maxlength: 40 });
    let color = '';
    const sw = h('div', {}), draw = () => sw.replaceChildren(swatches(color, c => { color = c; draw(); }));
    draw();
    return h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, L('Neues Team', 'New team')),
      help('Ein Team färbt die Namen seiner Mitglieder. Die Spieler ordnest du danach per Drag & Drop im Reiter „Teams“ zu.', 'A team colours its members\' names. Assign players afterwards by drag & drop in the "Teams" tab.'),
      h('label', {}, L('Name (kleine Buchstaben, Zahlen, _)', 'Name (lowercase letters, digits, _)')), name, h('label', {}, L('Anzeigename', 'Display name')), disp, h('label', {}, L('Farbe', 'Colour')), sw,
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'px-btn primary', onclick: async () => { const n = name.value.trim(); if (await queue([op('team.create', { name: n, display: disp.value.trim(), color })])) pick('team', { name: n }); } }, L('In den Entwurf', 'Add to draft')),
        h('button', { class: 'px-btn ghost', onclick: () => { sel = null; render(); } }, L('Abbrechen', 'Cancel'))));
  }

  function playerInspector(name) {
    const m = draft(), cur = teamOf(m, name);
    const teamSelect = h('select', { onchange: ev => { const target = ev.target.value; const ops = []; if (cur) ops.push(op('team.remove', { name: cur.name, entry: name })); if (target) ops.push(op('team.add', { name: target, entry: name })); if (ops.length) queue(ops); } },
      h('option', { value: '' }, L('(kein Team)', '(no team)')), m.teams.map(t => h('option', { value: t.name, selected: cur && cur.name === t.name }, t.display || t.name)));
    const has = m.objectives.filter(o => o.scores[name] !== undefined);
    return h('div', { class: 'card' }, h('h2', { style: 'margin-top:0' }, name), help('Team und Punkte dieses Spielers.', 'Team and points of this player.'),
      h('label', {}, L('Team', 'Team')), teamSelect,
      h('h3', {}, L('Punkte', 'Points')),
      m.objectives.length ? m.objectives.map(o => h('div', { class: 'row', style: 'margin:3px 0' }, h('span', { style: 'min-width:110px' }, o.display || o.name),
        h('button', { class: 'px-btn small ghost', onclick: () => queue([op('score.add', { objective: o.name, entry: name, value: '-1' })]) }, '−1'),
        h('input', { type: 'number', class: 'pb-cell', value: o.scores[name] ?? '', placeholder: '–', onchange: ev => queue([ev.target.value === '' ? op('score.reset', { objective: o.name, entry: name }) : op('score.set', { objective: o.name, entry: name, value: ev.target.value })]) }),
        h('button', { class: 'px-btn small ghost', onclick: () => queue([op('score.add', { objective: o.name, entry: name, value: '1' })]) }, '+1'),
        h('button', { class: 'px-btn small ghost', onclick: () => queue([op('score.add', { objective: o.name, entry: name, value: '10' })]) }, '+10'))) : h('div', { class: 'sub' }, L('Noch keine Objectives.', 'No objectives yet.')),
      has.length ? h('div', { style: 'margin-top:10px' }, h('button', { class: 'px-btn small danger', onclick: async () => { if (await ctx.confirm(L('Alle Punkte von ' + name + ' zurücksetzen (im Entwurf)?', 'Reset all points of ' + name + ' (in the draft)?'))) queue(has.map(o => op('score.reset', { objective: o.name, entry: name }))); } }, L('Alle Punkte zurücksetzen', 'Reset all points'))) : null);
  }

  // Teameinstellungen; wird in der Spielansicht und im Reiter "Teams" benutzt
  function teamEditor(t, onGone) {
    const setv = (key, value) => queue([op('team.set', { name: t.name, key, value: String(value) })]);
    const add = h('input', { list: 'pb-online', placeholder: L('Spieler hinzufügen', 'Add player'), style: 'max-width:170px' });
    return h('div', { class: 'card' }, h('datalist', { id: 'pb-online' }, st.online.map(n => h('option', { value: n }))),
      h('div', { class: 'row' }, h('span', { class: 'pb-swatch', style: 'background:' + colorHex(t.color) }), h('h2', { style: 'margin:0' }, t.display || t.name), t.owned ? null : h('span', { class: 'tag warn' }, L('Fremd', 'Foreign'))),
      h('label', {}, L('Farbe des Namens', 'Name colour')), swatches(t.color, c => setv('color', c)),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('div', {}, h('label', {}, L('Anzeigename', 'Display name')), h('input', { value: t.display, maxlength: 40, onchange: ev => setv('display', ev.target.value) })),
        h('div', {}, h('label', {}, L('Vor dem Namen', 'Before the name')), h('input', { value: t.prefix, style: 'max-width:110px', maxlength: 16, onchange: ev => setv('prefix', ev.target.value) })),
        h('div', {}, h('label', {}, L('Nach dem Namen', 'After the name')), h('input', { value: t.suffix, style: 'max-width:110px', maxlength: 16, onchange: ev => setv('suffix', ev.target.value) }))),
      h('label', { class: 'row', style: 'margin:8px 0 0' }, h('input', { type: 'checkbox', style: 'width:auto', checked: t.friendlyFire, onchange: ev => setv('friendlyFire', ev.target.checked) }), L('Teammitglieder dürfen sich gegenseitig schlagen', 'Team members may hit each other')),
      h('label', { class: 'row', style: 'margin:4px 0 0' }, h('input', { type: 'checkbox', style: 'width:auto', checked: t.seeInvisible, onchange: ev => setv('seeInvisible', ev.target.checked) }), L('Teammitglieder sehen sich auch unsichtbar', 'Members see each other when invisible')),
      h('label', {}, L('Namensschild über dem Kopf', 'Name tag above the head')), h('select', { onchange: ev => setv('nametag', ev.target.value) }, st.lists.visibility.map(v => h('option', { value: v, selected: t.nametag === v }, NAMETAG[v] ? L(NAMETAG[v][0], NAMETAG[v][1]) : v))),
      h('h3', {}, L('Mitglieder', 'Members') + ' (' + t.members.length + ')'),
      h('div', { style: 'margin:4px 0' }, t.members.length ? t.members.map(e => h('span', { class: 'pb-chip' }, e, h('a', { style: 'cursor:pointer', onclick: () => queue([op('team.remove', { name: t.name, entry: e })]) }, '×'))) : h('span', { class: 'sub' }, L('Noch niemand. Ziehe Spieler im Reiter „Teams“ hinein.', 'Nobody yet. Drag players in on the "Teams" tab.'))),
      h('div', { class: 'row' }, add, h('button', { class: 'px-btn small', onclick: () => add.value.trim() && queue([op('team.add', { name: t.name, entry: add.value.trim() })]) }, '+')),
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'px-btn small danger', onclick: async () => { if (await ctx.confirm(L('Team "' + t.name + '" löschen (im Entwurf)?', 'Delete team "' + t.name + '" (in the draft)?'))) { onGone && onGone(); queue([op('team.delete', { name: t.name })]); } } }, L('Team löschen', 'Delete team'))));
  }

  // ---------- Tabelle ----------
  function table() {
    const m = draft(), lv = liveM();
    if (!m.objectives.length) return h('div', { class: 'empty' }, L('Noch keine Objectives. Lege in der Spielansicht das erste an.', 'No objectives yet. Create the first one in the game view.'));
    if (tableObj && !m.objectives.some(o => o.name === tableObj)) tableObj = '';
    if (!m.objectives.some(o => o.name === bulkObj)) bulkObj = tableObj || m.objectives[0].name;
    const cols = tableObj ? m.objectives.filter(o => o.name === tableObj) : m.objectives;
    let entries = [...new Set(cols.flatMap(o => Object.keys(o.scores)))];
    const q = tq.trim().toLowerCase();
    if (q) entries = entries.filter(e => e.toLowerCase().includes(q));
    if (tOnline) entries = entries.filter(e => st.online.includes(e));
    const valOf = (o, e) => o.scores[e];
    if (tSort.col === '_name') entries.sort((a, b) => ci(a, b) * tSort.dir);
    else if (tSort.col) { const o = m.objectives.find(x => x.name === tSort.col); entries.sort((a, b) => ((valOf(o, a) ?? -Infinity) - (valOf(o, b) ?? -Infinity)) * tSort.dir || ci(a, b)); }
    else entries.sort(ci);
    const liveVal = (o, e) => lv.objectives.find(x => x.name === o.name)?.scores[e];
    const sortBtn = (col, label, tip) => h('th', { class: 'pb-sort', title: tip || '', onclick: () => { tSort = { col, dir: tSort.col === col ? -tSort.dir : (col === '_name' ? 1 : -1) }; render(); } }, label + (tSort.col === col ? (tSort.dir > 0 ? ' ▲' : ' ▼') : ''));
    const shown = entries.slice(0, 200);
    const bulk = async (kind) => {
      const o = m.objectives.find(x => x.name === bulkObj), v = String(Math.trunc(+bulkVal || 0));
      const targets = kind === 'reset' ? shown.filter(e => o.scores[e] !== undefined) : shown;
      if (!targets.length) { ctx.toast(L('Keine Einträge in der Liste.', 'No entries in the list.'), 'bad'); return; }
      const text = kind === 'add' ? L('allen ' + targets.length + ' angezeigten Einträgen ' + v + ' Punkte in „' + (o.display || o.name) + '“ dazugeben', 'add ' + v + ' points in "' + (o.display || o.name) + '" to all ' + targets.length + ' shown entries')
        : kind === 'set' ? L('bei allen ' + targets.length + ' angezeigten Einträgen „' + (o.display || o.name) + '“ auf ' + v + ' setzen', 'set "' + (o.display || o.name) + '" to ' + v + ' for all ' + targets.length + ' shown entries')
          : L('bei ' + targets.length + ' angezeigten Einträgen „' + (o.display || o.name) + '“ zurücksetzen', 'reset "' + (o.display || o.name) + '" for ' + targets.length + ' shown entries');
      if (!(await ctx.confirm(L('Jetzt im Entwurf ', 'Now in the draft: ') + text + '?'))) return;
      queue(targets.map(e => kind === 'reset' ? op('score.reset', { objective: o.name, entry: e }) : op(kind === 'add' ? 'score.add' : 'score.set', { objective: o.name, entry: e, value: v })));
    };
    const ent = h('input', { list: 'pb-online', placeholder: L('Spieler/Eintrag', 'Player/entry'), style: 'max-width:200px' });
    const obj = h('select', { style: 'width:auto' }, m.objectives.map(o => h('option', { value: o.name, selected: o.name === bulkObj }, o.display || o.name)));
    const val = h('input', { type: 'number', value: 0, style: 'width:100px' });
    return h('div', {}, h('datalist', { id: 'pb-online' }, st.online.map(n => h('option', { value: n }))),
      help('Alle Punkte auf einen Blick. Zum Sortieren auf eine Spaltenüberschrift klicken. Eine Zelle ändern = Eintrag im Entwurf.', 'All points at a glance. Click a column heading to sort. Changing a cell adds an entry to the draft.'),
      h('div', { class: 'card' }, h('div', { class: 'row' },
        h('input', { placeholder: '🔍 ' + L('Suchen', 'Search'), value: tq, style: 'max-width:200px', oninput: ev => { tq = ev.target.value; clearTimeout(table._t); table._t = setTimeout(() => { render(); const i = root.querySelector('input[placeholder^="🔍"]'); if (i) { i.focus(); i.setSelectionRange(tq.length, tq.length); } }, 250); } }),
        h('label', { class: 'row', style: 'margin:0;gap:6px' }, h('input', { type: 'checkbox', style: 'width:auto', checked: tOnline, onchange: ev => { tOnline = ev.target.checked; render(); } }), L('Nur Online-Spieler', 'Online players only')),
        h('select', { style: 'width:auto', onchange: ev => { tableObj = ev.target.value; render(); } }, h('option', { value: '' }, L('Alle Objectives', 'All objectives')), m.objectives.map(o => h('option', { value: o.name, selected: tableObj === o.name }, o.display || o.name))),
        h('span', { class: 'sub' }, shown.length + (entries.length > shown.length ? '/' + entries.length : '') + ' ' + L('Einträge', 'entries')))),
      h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, L('Mehrere auf einmal ändern', 'Change many at once')), h('p', { class: 'sub' }, L('Gilt für die Einträge, die in der Tabelle unten gerade angezeigt werden (höchstens 200).', 'Applies to the entries currently shown in the table below (at most 200).')),
        h('div', { class: 'row' }, h('select', { style: 'width:auto', onchange: ev => { bulkObj = ev.target.value; } }, m.objectives.map(o => h('option', { value: o.name, selected: o.name === bulkObj }, o.display || o.name))),
          h('input', { type: 'number', value: bulkVal, style: 'width:100px', onchange: ev => { bulkVal = ev.target.value; } }),
          h('button', { class: 'px-btn small', onclick: () => bulk('add') }, L('dazugeben', 'add')), h('button', { class: 'px-btn small', onclick: () => bulk('set') }, L('setzen auf', 'set to')), h('button', { class: 'px-btn small danger', onclick: () => bulk('reset') }, L('zurücksetzen', 'reset')))),
      h('div', { class: 'card' }, h('div', { class: 'row' }, ent, obj, val, h('button', { class: 'px-btn primary', onclick: () => ent.value.trim() && queue([op('score.set', { objective: obj.value, entry: ent.value.trim(), value: String(val.value) })]) }, L('Punkte setzen', 'Set score')))),
      shown.length ? h('div', { class: 'card', style: 'overflow:auto' }, h('table', {}, h('tr', {}, sortBtn('_name', L('Eintrag', 'Entry')), cols.map(o => sortBtn(o.name, o.display || o.name, o.name))),
        shown.map(e => h('tr', {}, h('td', {}, st.online.includes(e) ? h('span', { class: 'pbt-dot', title: 'online' }) : null, e), cols.map(o => {
          const v = o.scores[e], changed = v !== liveVal(o, e);
          return h('td', {}, h('input', { class: 'pb-cell' + (changed ? ' pb-changed' : ''), type: 'number', value: v ?? '', placeholder: '–', onchange: ev => { const x = ev.target.value; queue([x === '' ? op('score.reset', { objective: o.name, entry: e }) : op('score.set', { objective: o.name, entry: e, value: x })]); } }));
        }))))) : h('div', { class: 'empty' }, q || tOnline ? L('Nichts gefunden.', 'Nothing found.') : L('Noch keine Punktestände.', 'No scores yet.')));
  }

  // ---------- Teams: Spieler per Drag & Drop in ihr Team ziehen ----------
  let dragName = null, newTeamOpen = false;
  function teams() {
    const m = draft();
    const known = [...new Set([...st.online, ...m.objectives.flatMap(o => Object.keys(o.scores)), ...m.teams.flatMap(t => t.members)])].sort(ci);
    const free = known.filter(n => !teamOf(m, n));
    const moveTo = (n, target) => {
      const cur = teamOf(m, n);
      if ((cur && cur.name === target) || (!cur && !target)) return;
      const ops = [];
      if (cur) ops.push(op('team.remove', { name: cur.name, entry: n }));
      if (target) ops.push(op('team.add', { name: target, entry: n }));
      queue(ops);
    };
    const chip = n => h('div', { class: 'pbt-chip' + (st.online.includes(n) ? ' online' : ''), draggable: 'true', title: L('Ziehen, um das Team zu wechseln', 'Drag to change team'),
      ondragstart: ev => { dragName = n; ev.dataTransfer.setData('text/plain', n); ev.dataTransfer.effectAllowed = 'move'; ev.currentTarget.classList.add('drag'); },
      ondragend: ev => { dragName = null; ev.currentTarget.classList.remove('drag'); root.querySelectorAll('.pbt-col.over').forEach(x => x.classList.remove('over')); } },
      head(n, 22), n, st.online.includes(n) ? h('span', { class: 'pbt-dot', title: 'online' }) : null);
    const zone = (target, head, names, extra) => h('div', { class: 'pbt-col', style: extra || '',
      ondragover: ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; ev.currentTarget.classList.add('over'); },
      ondragleave: ev => { if (!ev.currentTarget.contains(ev.relatedTarget)) ev.currentTarget.classList.remove('over'); },
      ondrop: ev => { ev.preventDefault(); ev.currentTarget.classList.remove('over'); const n = dragName || ev.dataTransfer.getData('text/plain'); dragName = null; if (n) moveTo(n, target); } },
      head, h('div', { class: 'pbt-list' }, names.length ? names.map(chip) : h('div', { class: 'pbt-hint' }, L('Hierher ziehen', 'Drop here'))));
    const addName = h('input', { placeholder: L('Spieler per Name (auch offline)', 'Player by name (also offline)'), style: 'max-width:240px' });
    const addTeam = h('select', { style: 'width:auto' }, m.teams.map(t => h('option', { value: t.name }, t.display || t.name)));
    const newName = h('input', { placeholder: 'rot', maxlength: 16, style: 'max-width:130px' }), newDisp = h('input', { placeholder: L('Anzeigename', 'Display name'), maxlength: 40, style: 'max-width:170px' });
    let newColor = '';
    const newSw = h('div', {}), drawSw = () => newSw.replaceChildren(swatches(newColor, c => { newColor = c; drawSw(); }));
    drawSw();
    const editing = m.teams.find(t => t.name === teamSel);
    return h('div', {},
      help('Ziehe einen Spieler mit der Maus auf ein Team, um ihn dort aufzunehmen. Ziehe ihn zurück nach „Ohne Team“, um ihn herauszunehmen. Grüner Punkt = gerade online.', 'Drag a player onto a team to put them in it. Drag them back to "No team" to take them out. Green dot = online right now.'),
      h('div', { class: 'row' }, h('button', { class: 'px-btn primary', onclick: () => { newTeamOpen = !newTeamOpen; render(); } }, '+ ' + L('Neues Team', 'New team')),
        h('span', { class: 'grow' }), addName, m.teams.length ? [addTeam, h('button', { class: 'px-btn small', onclick: () => addName.value.trim() && addTeam.value && queue([op('team.add', { name: addTeam.value, entry: addName.value.trim() })]) }, L('Aufnehmen', 'Add'))] : null),
      newTeamOpen ? h('div', { class: 'card' }, h('div', { class: 'row' }, newName, newDisp, h('button', { class: 'px-btn primary', onclick: async () => { if (await queue([op('team.create', { name: newName.value.trim(), display: newDisp.value.trim(), color: newColor })])) { newTeamOpen = false; render(); } } }, L('In den Entwurf', 'Add to draft')), h('button', { class: 'px-btn ghost', onclick: () => { newTeamOpen = false; render(); } }, L('Abbrechen', 'Cancel'))), newSw) : null,
      h('div', { class: 'pbt-board' },
        zone('', h('div', { class: 'pbt-head' }, h('b', {}, L('Ohne Team', 'No team')), h('span', { class: 'sub' }, free.length)), free, 'border-style:dashed'),
        m.teams.map(t => zone(t.name, h('div', { class: 'pbt-head', style: '--c:' + colorHex(t.color) + ';border-color:' + colorHex(t.color) }, h('span', { class: 'pb-swatch', style: 'background:' + colorHex(t.color) }), h('b', {}, t.display || t.name), t.owned ? null : h('span', { class: 'tag warn' }, L('Fremd', 'Foreign')), h('span', { class: 'sub' }, t.members.length), h('span', { class: 'grow' }),
          h('button', { class: 'px-btn small ghost', title: L('Einstellungen', 'Settings'), onclick: () => { teamSel = teamSel === t.name ? '' : t.name; render(); } }, '⚙')), t.members.slice().sort(ci)))),
      m.teams.length ? null : h('div', { class: 'empty', style: 'margin-top:12px' }, L('Noch keine Teams. Lege oben das erste an.', 'No teams yet. Create the first one above.')),
      editing ? h('div', { style: 'margin-top:14px' }, teamEditor(editing, () => { teamSel = ''; })) : null);
  }

  // ---------- Rangliste ----------
  function ranking() {
    const m = draft();
    if (!m.objectives.length) return h('div', { class: 'empty' }, L('Noch keine Objectives.', 'No objectives yet.'));
    if (!m.objectives.some(o => o.name === rankObj)) rankObj = m.objectives[0].name;
    const o = m.objectives.find(x => x.name === rankObj), q = rankQ.trim().toLowerCase();
    const all = Object.entries(o.scores).sort((a, b) => b[1] - a[1] || ci(a[0], b[0])).map(([e, v], i) => [e, v, i + 1]);
    const rows = all.filter(([e]) => !q || e.toLowerCase().includes(q)).slice(0, 15), max = Math.max(1, ...all.map(r => Math.abs(r[1])));
    const medal = i => i === 1 ? '🥇' : i === 2 ? '🥈' : i === 3 ? '🥉' : i + '.';
    const onSide = m.slots.sidebar === o.name;
    const bars = rows.map(([e, v, rank]) => { const t = teamOf(m, e), fill = h('i', {}); requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = Math.max(2, Math.abs(v) / max * 100) + '%'; }));
      return h('div', { class: 'pbr-row', onclick: () => pick2(e) }, h('span', { class: 'pbr-rank' }, medal(rank)), h('div', { style: 'flex:1;min-width:0' }, h('div', { class: 'pb-top' }, h('span', { style: 'color:' + (t ? colorHex(t.color) : 'inherit') }, e), h('b', {}, v)), h('div', { class: 'pb-bar2' }, fill))); });
    function pick2(e) { sel = { kind: 'player', name: e }; tab = 'scene'; render(); }
    const podium = !q && all.length >= 2 ? h('div', { class: 'pbr-podium' }, [[all[1], 'p2', 2], [all[0], 'p1', 1], [all[2], 'p3', 3]].filter(x => x[0]).map(([r, cls, n]) => h('div', { class: 'pbr-pod ' + cls, onclick: () => pick2(r[0]) }, head(r[0], 30), h('div', { class: 'nm', style: 'color:' + (teamOf(m, r[0]) ? colorHex(teamOf(m, r[0]).color) : 'inherit') }, r[0]), h('div', { class: 'pt' }, r[1]), h('div', { class: 'blk' }, h('b', {}, n))))) : null;
    return h('div', {}, help('Wer hat die meisten Punkte? Wähle ein Objective. Anklicken eines Spielers öffnet ihn in der Spielansicht.', 'Who has the most points? Pick an objective. Clicking a player opens them in the game view.'),
      h('div', { class: 'row' }, m.objectives.map(x => h('button', { class: 'px-btn ' + (x.name === rankObj ? 'active' : ''), onclick: () => { rankObj = x.name; render(); } }, x.display || x.name))),
      h('div', { class: 'card' }, h('div', { class: 'row' }, h('input', { placeholder: '🔍 ' + L('Spieler suchen', 'Find player'), value: rankQ, style: 'max-width:200px', oninput: ev => { rankQ = ev.target.value; clearTimeout(ranking._t); ranking._t = setTimeout(() => { render(); const i = root.querySelector('input[placeholder^="🔍"]'); if (i) { i.focus(); i.setSelectionRange(rankQ.length, rankQ.length); } }, 250); } }),
        h('span', { class: 'grow' }), onSide ? h('span', { class: 'chip good' }, L('Steht in der Seitenleiste', 'Shown in the sidebar')) : h('button', { class: 'px-btn small', onclick: () => queue([op('slot.set', { slot: 'sidebar', objective: o.name })]) }, L('In die Seitenleiste legen', 'Show in sidebar'))),
        podium, h('div', { style: 'margin-top:12px' }, rows.length ? bars : h('div', { class: 'empty' }, q ? L('Nichts gefunden.', 'Nothing found.') : L('Noch keine Punkte.', 'No scores yet.')))));
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
      h('div', { class: 'row' }, [['scene', L('Spielansicht', 'Game view')], ['display', L('Anzeige', 'Display')], ['table', L('Tabelle', 'Table')], ['teams', 'Teams'], ['rank', L('Rangliste', 'Ranking')]].map(([k, l]) => h('button', { class: 'px-btn ' + (tab === k ? 'active' : ''), onclick: () => { tab = k; render(); } }, l))),
      tab === 'display' ? null : draftBar(), h('div', { style: 'margin-top:14px' }, tab === 'display' ? mountDisplay() : tab === 'scene' ? scene() : tab === 'table' ? table() : tab === 'teams' ? teams() : ranking()));
  }

  // Punkte laufen im Spiel weiter: alle 5 Sekunden aktualisieren, solange man nichts eintippt. Der Anzeige-Editor wird nie von aussen neu gezeichnet.
  const timer = setInterval(async () => {
    if (!root.isConnected) { clearInterval(timer); return; }
    if (tab === 'display') return;
    if (root.contains(document.activeElement) && ['INPUT', 'SELECT'].includes(document.activeElement.tagName)) return;
    try { await refresh(); } catch { /* egal */ }
  }, 5000);
  ctx.on(async d => { if (d.module === 'peakboard' && tab !== 'display' && !root.contains(document.activeElement)) await refresh(); });
  await load();
  await loadDisplay();
  render();
}
