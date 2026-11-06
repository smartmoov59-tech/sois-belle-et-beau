/* ==========================================================
   Sois Belle et Beau : comportement du site (100 % statique)
   GSAP + ScrollTrigger + Lenis, tous hébergés en local (assets/js/vendor)
   Réservation : agenda Planity du salon, appel, SMS pré-rempli, fichier .ics
   ========================================================== */
(() => {
  'use strict';

  /* ---------- utilitaires ---------- */
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const NB = '\u00A0';
  const PHONE = '+33786468960';
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  let lenis = null;

  try { history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ }

  /* ---------- données : la carte (source : agenda Planity du salon) ---------- */
  // [nom, durée en minutes, prix en €]
  const CATS = [
    { id: 'regard', label: 'Beauté du regard', groups: [{ items: [
      ['Extension cils à cils', 105, 60], ['Extension volume russe', 120, 80],
      ['Comblage de cils à cils (3 semaines)', 60, 40], ['Remplissage volume russe', 60, 50], ['Dépose', 30, 15]] }] },
    { id: 'visage', label: 'Soin du visage', groups: [{ items: [
      ['Soin classique purifiant ou hydratant', 45, 60], ['Soin liftant', 45, 90], ['Soin évasion', 75, 110]] }] },
    { id: 'mains', label: 'Mains & pieds', groups: [{ items: [
      ['Pose de vernis semi-permanent mains', 45, 23], ['Pose de vernis semi-permanent pieds', 45, 23],
      ['Gainage ongles naturels', 90, 35], ['Supplément French', 20, 5], ['Supplément strass', 10, 1], ['Nail art', 30, 5],
      ['Dépose vernis semi-permanent avec soin', 30, 12], ['Dépose gel avec soin', 45, 22]] }] },
    { id: 'epilation', label: 'Épilation', groups: [
      { title: 'Femme', items: [['Maillot classique', 15, 9], ['Maillot échancré', 20, 15], ['Maillot intégral avec ou sans SIF', 30, 25], ['SIF', 15, 8]] },
      { title: 'Homme', items: [['Dos', 30, 20], ['Épaules', 15, 10], ['Torse', 15, 20], ['Ventre', 15, 10], ['Buste', 75, 50]] },
      { title: 'Femme ou homme', items: [['Aisselles', 15, 12], ['Bras complets', 30, 18], ['Demi-bras', 20, 14], ['Cuisses', 20, 12], ['Demi-jambes', 20, 12],
        ['Jambes complètes', 40, 23], ['Épilation sourcils (entretien)', 10, 9], ['Épilation sourcils (restructuration ou première visite)', 15, 12],
        ['Lèvres', 10, 8], ['Nez', 10, 8], ['Oreilles', 10, 8], ['Visage complet', 25, 20]] }] },
    { id: 'corps', label: 'Massages & gommages', groups: [
      { title: 'Massages', items: [['Massage 30 minutes', 30, 35], ['Massage 45 minutes', 45, 48], ['Massage détente', 60, 64]] },
      { title: 'Gommages', items: [['Gommage à grains', 30, 35], ['Gommage enzymatique', 30, 65], ['Gommage à gomme', 30, 84], ['Rituel du corps', 75, 110]] }] },
    { id: 'maquillage', label: 'Maquillage', groups: [{ items: [
      ['Remise en beauté', 15, 15], ['Essai mariée', 45, 20], ['Soirée', 45, 30], ['Mariée jour J', 30, 45], ['Formation maquillage', 240, 200]] }] },
    { id: 'blanchiment', label: 'Blanchiment dentaire', whiten: true,
      note: 'Avant toute prise de rendez-vous, passez chez votre dentiste pour vérifier que vos dents sont saines et faire un détartrage. Les deux séances se font à un jour d’intervalle, puis la troisième est à déterminer.',
      groups: [{ items: [
        ['SOLO · 1 séance coup d’éclat', 60, 60], ['SOLO · 2 séances sourire éclatant', 60, 110], ['SOLO · 3 séances sourire éclatant avec retouche', 60, 160],
        ['Pack DUO · 1 séance', 60, 110], ['Pack DUO · 2 séances', 60, 200], ['Pack DUO · 3 séances', 60, 290]] }] }
  ];

  const ITEMS = {};
  const ORDER = [];
  CATS.forEach(cat => {
    let n = 0;
    cat.count = 0;
    cat.groups.forEach(g => g.items.forEach(([name, min, price]) => {
      const id = `${cat.id}-${++n}`;
      ITEMS[id] = { id, cat: cat.id, whiten: !!cat.whiten, name, min, price };
      ORDER.push(id);
      cat.count++;
    }));
  });

  const fmtDur = m => (m < 60 ? `${m}${NB}min` : `${Math.floor(m / 60)}${NB}h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}`);
  const fmtPrice = p => `${p}${NB}€`;
  const plain = s => s.replace(/\u00A0/g, ' ');
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- état de la sélection (partagé : carte, composeur, pastille) ---------- */
  const sel = new Set();
  const listeners = [];
  const onSel = fn => listeners.push(fn);
  function toggle(id, force) {
    const on = force === undefined ? !sel.has(id) : force;
    on ? sel.add(id) : sel.delete(id);
    listeners.forEach(fn => fn());
  }
  const selected = () => ORDER.filter(id => sel.has(id)).map(id => ITEMS[id]);

  let refreshTimer;
  const refreshLater = (ms = 350) => {
    if (!hasGsap) return;
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), ms);
  };

  /* ---------- scroll : verrou et navigation ---------- */
  function lockScroll(on) {
    if (lenis) { on ? lenis.stop() : lenis.start(); }
    else document.body.style.overflow = on ? 'hidden' : '';
  }
  function scrollToEl(target, instant) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: 0, duration: instant ? 0 : 1.5, easing: t => 1 - Math.pow(1 - t, 4), immediate: !!instant });
    else el.scrollIntoView({ behavior: reduce || instant ? 'auto' : 'smooth', block: 'start' });
  }

  /* ==========================================================
     LA CARTE (onglets + lignes de prix)
     ========================================================== */
  const tabsEl = $('#carteTabs');
  const panelEl = $('#cartePanel');
  let currentTab = CATS[0].id;

  function initCarte() {
    if (!tabsEl || !panelEl) return;
    tabsEl.innerHTML = CATS.map((c, i) =>
      `<button class="tab" role="tab" type="button" id="tab-${c.id}" data-cat="${c.id}" aria-selected="${i === 0}" aria-controls="cartePanel" tabindex="${i === 0 ? 0 : -1}">${esc(c.label)} <small>${c.count}</small></button>`
    ).join('');
    renderPanel(currentTab, false);

    tabsEl.addEventListener('click', e => {
      const b = e.target.closest('.tab');
      if (b) setTab(b.dataset.cat, true);
    });
    tabsEl.addEventListener('keydown', e => {
      const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      const btns = $$('.tab', tabsEl);
      let i = btns.findIndex(b => b.dataset.cat === currentTab);
      if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = btns.length - 1;
      else i = (i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
      setTab(btns[i].dataset.cat, true);
      btns[i].focus();
    });
    panelEl.addEventListener('click', e => {
      const b = e.target.closest('.add');
      if (b) toggle(b.dataset.id);
    });

    // cartes « Les soins » : ouvrent l'onglet correspondant
    $$('a[data-tab]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      setTab(a.dataset.tab, false);
      scrollToEl('#carte');
    }));
    onSel(syncCarte);
  }

  function setTab(id, animate) {
    if (!CATS.some(c => c.id === id)) return;
    currentTab = id;
    $$('.tab', tabsEl).forEach(b => {
      const on = b.dataset.cat === id;
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
    });
    renderPanel(id, animate !== false);
  }

  function renderPanel(id, animate) {
    const cat = CATS.find(c => c.id === id);
    panelEl.setAttribute('aria-labelledby', 'tab-' + id);
    panelEl.innerHTML = cat.groups.map(g => {
      const rows = g.items.map(([name]) => {
        const it = ITEMS[ORDER.find(k => ITEMS[k].cat === cat.id && ITEMS[k].name === name)];
        const on = sel.has(it.id);
        return `<div class="row"><span class="row__name">${esc(it.name)}</span><span class="row__dots" aria-hidden="true"></span><span class="row__dur">${fmtDur(it.min)}</span><span class="row__price">${fmtPrice(it.price)}</span>` +
          `<button class="add" type="button" data-id="${it.id}" aria-pressed="${on}" aria-label="${on ? 'Retirer' : 'Ajouter'} ${esc(it.name)} ${on ? 'de' : 'à'} ma demande"><svg class="i-plus"><use href="#i-plus"/></svg><svg class="i-check"><use href="#i-check"/></svg></button></div>`;
      }).join('');
      return (g.title ? `<h3 class="sub">${esc(g.title)}</h3>` : '') + rows;
    }).join('') + (cat.note ? `<p class="panel__note">${esc(cat.note)}</p>` : '');

    if (hasGsap && animate && !reduce) {
      gsap.from($$('.row, .sub, .panel__note', panelEl), { y: 26, opacity: 0, duration: .8, ease: 'expo.out', stagger: .035, clearProps: 'transform,opacity' });
    }
    refreshLater(500);
  }

  function syncCarte() {
    $$('.add', panelEl).forEach(b => {
      const it = ITEMS[b.dataset.id];
      const on = sel.has(it.id);
      b.setAttribute('aria-pressed', on);
      b.setAttribute('aria-label', `${on ? 'Retirer' : 'Ajouter'} ${it.name} ${on ? 'de' : 'à'} ma demande`);
    });
  }

  /* ==========================================================
     COMPOSEUR DE DEMANDE (SMS pré-rempli, copie, .ics)
     ========================================================== */
  function initComposer() {
    const acc = $('#composerAcc');
    if (!acc) return;
    const fDate = $('#fDate'), fTime = $('#fTime'), fName = $('#fName'), hint = $('#fHint');
    const smsBtn = $('#smsBtn'), copyBtn = $('#copyBtn'), icsBtn = $('#icsBtn');
    const recapList = $('#recapList'), recapTotal = $('#recapTotal'), recapDur = $('#recapDur'), recapWarn = $('#recapWarn');
    const tray = $('#tray'), trayTxt = $('#trayTxt'), trayTot = $('#trayTot');
    const baseHint = hint.innerHTML;

    // accordéons + puces
    acc.innerHTML = CATS.map((c, i) => {
      const chips = ORDER.filter(k => ITEMS[k].cat === c.id).map(k => {
        const it = ITEMS[k];
        return `<label class="chip"><input type="checkbox" value="${it.id}"><span>${esc(it.name)}<small>${fmtDur(it.min)} · ${fmtPrice(it.price)}</small></span></label>`;
      }).join('');
      return `<details class="acc"${i === 0 ? ' open' : ''}><summary>${esc(c.label)}<span class="cnt" data-cnt="${c.id}"></span></summary><div class="acc__body">${chips}</div></details>`;
    }).join('');
    acc.addEventListener('change', e => {
      const inp = e.target.closest('input[type="checkbox"]');
      if (inp) toggle(inp.value, inp.checked);
    });
    acc.addEventListener('toggle', () => refreshLater(450), true);

    // heures (créneaux de 30 min, 10 h → 18 h 30)
    const times = ['<option value="">À définir ensemble</option>'];
    for (let m = 600; m <= 1110; m += 30) {
      const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, '0');
      times.push(`<option value="${String(h).padStart(2, '0')}:${mm}">${h} h ${mm === '00' ? '' : mm}</option>`);
    }
    fTime.innerHTML = times.join('');

    // date minimale = aujourd'hui (heure locale)
    const now = new Date();
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    fDate.min = iso(now);

    const totals = () => {
      const list = selected();
      return { list, price: list.reduce((a, i) => a + i.price, 0), min: list.reduce((a, i) => a + i.min, 0) };
    };
    const dateLabel = () => fDate.value
      ? new Date(fDate.value + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
      : '';

    function message() {
      const t = totals();
      const name = fName.value.trim();
      const L = [];
      L.push(`Bonjour Noémie, ${name ? 'c’est ' + name + '. Je' : 'je'} souhaite prendre rendez-vous chez Sois Belle et Beau :`);
      t.list.forEach(i => L.push(`• ${i.name} (${fmtDur(i.min)}, ${i.price} €)`));
      L.push(`Total estimé : ${t.price} € · environ ${fmtDur(t.min)}`);
      const d = dateLabel();
      if (d) L.push(`Créneau souhaité : ${d}${fTime.value ? ' à ' + fTime.value.replace(':', ' h ').replace(' h 00', ' h') : ''}`);
      else L.push('Créneau : à définir ensemble');
      L.push('Merci de me confirmer la disponibilité !');
      return plain(L.join('\n'));
    }

    function validateDate() {
      hint.classList.remove('warn');
      hint.innerHTML = baseHint;
      if (!fDate.value) return true;
      const d = new Date(fDate.value + 'T12:00:00');
      const day = d.getDay();
      if (fDate.value < fDate.min) { hint.textContent = 'Cette date est passée, choisissez un jour à venir.'; hint.classList.add('warn'); return false; }
      if (day === 0 || day === 6) { hint.textContent = 'Le salon est fermé le week-end : choisissez un jour du lundi au vendredi.'; hint.classList.add('warn'); return false; }
      return true;
    }

    function sync() {
      const t = totals();
      // puces + compteurs
      $$('input[type="checkbox"]', acc).forEach(i => { i.checked = sel.has(i.value); });
      CATS.forEach(c => {
        const n = t.list.filter(i => i.cat === c.id).length;
        const el = $(`[data-cnt="${c.id}"]`, acc);
        el.textContent = n || '';
        el.classList.toggle('on', n > 0);
      });
      // récap
      if (!t.list.length) {
        recapList.innerHTML = '<p class="recap__empty">Aucun soin choisi pour l’instant.</p>';
      } else {
        recapList.innerHTML = '<ul>' + t.list.map(i => `<li><span>${esc(i.name)}</span><span>${fmtPrice(i.price)}</span></li>`).join('') + '</ul>';
      }
      recapTotal.textContent = fmtPrice(t.price);
      recapDur.textContent = t.list.length ? `≈ ${fmtDur(t.min)}` : '—';
      recapWarn.hidden = !t.list.some(i => i.whiten);

      // boutons d'envoi
      const ok = t.list.length > 0;
      const dateOk = validateDate();
      const sms = `sms:${PHONE}?&body=${encodeURIComponent(message())}`;
      smsBtn.setAttribute('aria-disabled', String(!ok || !dateOk));
      smsBtn.href = ok && dateOk ? sms : '#reserver';
      copyBtn.disabled = !ok;
      icsBtn.disabled = !(ok && fDate.value && fTime.value && dateOk);

      // pastille flottante
      tray.hidden = !t.list.length;
      trayTxt.textContent = `Mon rendez‑vous · ${t.list.length} soin${t.list.length > 1 ? 's' : ''}`;
      trayTot.textContent = fmtPrice(t.price);
    }
    onSel(sync);
    [fDate, fTime, fName].forEach(el => el.addEventListener('input', sync));
    sync();

    smsBtn.addEventListener('click', e => {
      if (smsBtn.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        hint.classList.add('warn');
        if (!selected().length) hint.textContent = 'Choisissez au moins un soin pour préparer votre message.';
      }
    });
    copyBtn.addEventListener('click', async () => {
      const label = $('span', copyBtn);
      try { await navigator.clipboard.writeText(message()); label.textContent = 'Message copié ✓'; }
      catch (err) {
        const ta = document.createElement('textarea'); ta.value = message(); document.body.append(ta); ta.select();
        try { document.execCommand('copy'); label.textContent = 'Message copié ✓'; } catch (e2) { label.textContent = 'Copie impossible'; }
        ta.remove();
      }
      setTimeout(() => { label.textContent = 'Copier le message'; }, 2400);
    });
    icsBtn.addEventListener('click', () => {
      const t = totals();
      if (!t.list.length || !fDate.value || !fTime.value) return;
      const [Y, M, D] = fDate.value.split('-');
      const [h, m] = fTime.value.split(':').map(Number);
      const start = new Date(+Y, +M - 1, +D, h, m);
      const end = new Date(start.getTime() + Math.max(t.min, 30) * 60000);
      const f = d => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}00`;
      const e = s => plain(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
      const ics = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sois Belle et Beau//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
        `UID:${Date.now()}@sois-belle-et-beau`, `DTSTAMP:${f(new Date())}`, `DTSTART:${f(start)}`, `DTEND:${f(end)}`,
        `SUMMARY:${e('Sois Belle et Beau (demande à confirmer)')}`,
        `LOCATION:${e('9 rue Pied de Ville, 04000 Digne-les-Bains')}`,
        `DESCRIPTION:${e(t.list.map(i => `${i.name} (${fmtDur(i.min)}, ${i.price} €)`).join('\n') + `\nTotal estimé : ${t.price} €\nTél. 07 86 46 89 60`)}`,
        'BEGIN:VALARM', 'TRIGGER:-PT60M', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous Sois Belle et Beau', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'rendez-vous-sois-belle-et-beau.ics';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
  }

  /* ==========================================================
     HORAIRES : ouvert / fermé (heure de Paris)
     ========================================================== */
  function initStatus() {
    const paris = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const day = paris.getDay();
    const mins = paris.getHours() * 60 + paris.getMinutes();
    const weekday = day >= 1 && day <= 5;
    let txt, open = false;
    if (weekday && mins >= 600 && mins < 1140) { open = true; txt = 'Ouvert · jusqu’à 19 h'; }
    else if (weekday && mins < 600) txt = 'Fermé · ouvre à 10 h';
    else if (day >= 1 && day <= 4) txt = 'Fermé · rouvre demain à 10 h';
    else txt = 'Fermé · rouvre lundi à 10 h';
    ['#statusHero', '#statusFind'].forEach(s => {
      const el = $(s); if (!el) return;
      el.classList.toggle('is-open', open);
      $('span', el).textContent = txt;
    });
    const row = $(`.hours tr[data-day="${day}"]`);
    if (row) row.classList.add('is-today');
  }

  /* ==========================================================
     LIGHTBOX
     ========================================================== */
  function initLightbox() {
    const lb = $('#lb'); if (!lb) return;
    const img = $('#lbImg'), cap = $('#lbCap');
    const btns = $$('[data-lb]');
    let idx = 0, last = null;
    const show = i => {
      idx = (i + btns.length) % btns.length;
      const src = $('img', btns[idx]);
      img.src = src.currentSrc || src.src;
      img.alt = src.alt;
      cap.textContent = $('figcaption', btns[idx].parentElement)?.textContent || '';
    };
    const open = i => {
      last = document.activeElement;
      show(i);
      lb.inert = false; lb.setAttribute('aria-hidden', 'false');
      lb.classList.add('is-open');
      lockScroll(true);
      $('#lbClose').focus();
    };
    const close = () => {
      lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true'); lb.inert = true;
      lockScroll(false);
      if (last) last.focus();
    };
    btns.forEach((b, i) => b.addEventListener('click', () => open(i)));
    $('#lbClose').addEventListener('click', close);
    $('#lbPrev').addEventListener('click', () => show(idx - 1));
    $('#lbNext').addEventListener('click', () => show(idx + 1));
    lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb__fig')) close(); });
    document.addEventListener('keydown', e => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'Tab') {
        const f = $$('button', lb); const first = f[0], lastB = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastB.focus(); }
        else if (!e.shiftKey && document.activeElement === lastB) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ==========================================================
     MENU MOBILE + liens d'ancre
     ========================================================== */
  const menu = $('#menu'), burger = $('#burger');
  function setMenu(open) {
    menu.classList.toggle('is-open', open);
    menu.inert = !open;
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    lockScroll(open);
  }
  function initMenu() {
    menu.inert = true;
    burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('is-open')) setMenu(false); });
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id === '#top') { e.preventDefault(); if (menu.classList.contains('is-open')) setMenu(false); lenis ? lenis.scrollTo(0, { duration: 1.4 }) : window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); return; }
      const t = id.length > 1 ? $(id) : null;
      if (!t || a.hasAttribute('data-tab')) return;
      e.preventDefault();
      const wasOpen = menu.classList.contains('is-open');
      if (wasOpen) setMenu(false);
      setTimeout(() => scrollToEl(t), wasOpen ? 350 : 0);
    });
    $('#toTop').addEventListener('click', () => (lenis ? lenis.scrollTo(0, { duration: 1.8 }) : window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })));
  }

  /* ==========================================================
     VIDÉOS PARESSEUSES (soin du visage)
     ========================================================== */
  function initLazyVideos() {
    const vids = $$('video[data-lazy-video]');
    if (!vids.length) return;
    const saveData = navigator.connection && navigator.connection.saveData;
    if (reduce || saveData || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const v = en.target;
        if (en.isIntersecting) {
          const s = $('source[data-src]', v);
          if (s && !s.src) {
            let src = s.dataset.src;
            if (innerWidth < 900) src = src.replace('1080', '540');
            s.src = src; v.load();
          }
          v.play().catch(() => {});
        } else v.pause();
      });
    }, { rootMargin: '300px 0px' });
    vids.forEach(v => io.observe(v));
  }

  /* ==========================================================
     MOTION : GSAP + ScrollTrigger + Lenis
     ========================================================== */
  function splitWords(el) {
    el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
    const out = document.createDocumentFragment();
    const walk = (node, parent) => {
      node.childNodes.forEach(n => {
        if (n.nodeType === 3) {
          n.textContent.split(/(\s+)/).forEach(tok => {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { parent.append(document.createTextNode(' ')); return; }
            const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            const wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = tok;
            w.append(wi); parent.append(w);
          });
        } else if (n.nodeType === 1) {
          if (n.tagName === 'BR') { parent.append(n.cloneNode()); return; }
          const c = n.cloneNode(false); parent.append(c); walk(n, c);
        }
      });
    };
    walk(el, out);
    el.textContent = '';
    el.append(out);
    return $$('.wi', el);
  }
  function splitChars(el) {
    const txt = el.textContent;
    el.textContent = '';
    [...txt].forEach(ch => {
      const s = document.createElement('span');
      s.className = 'hc'; s.style.display = 'inline-block'; s.textContent = ch;
      el.append(s);
    });
    return $$('.hc', el);
  }

  function runLoader() {
    return new Promise(resolve => {
      const loader = $('#loader');
      if (!loader) { resolve(); return; }
      const finish = () => { loader.remove(); try { performance.mark('sbb-loader-done'); } catch (e) { /* ignore */ } };
      if (reduce) {
        gsap.to(loader, { opacity: 0, duration: .4, onComplete: () => { finish(); resolve(); } });
        return;
      }
      const star = $('#loaderStar');
      const len = star.getTotalLength();
      const num = $('#loadNum');
      const obj = { v: 0 };
      gsap.set(star, { strokeDasharray: len, strokeDashoffset: len, fill: 'rgba(201,161,59,0)' });
      const tl = gsap.timeline();
      tl.to(star, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut' }, 0)
        .from('.loader__word > *', { yPercent: 125, duration: 1, stagger: .1, ease: 'expo.out' }, .2)
        .to(obj, { v: 100, duration: 1.9, ease: 'power1.inOut', onUpdate: () => { num.textContent = Math.round(obj.v); } }, 0)
        .to(star, { fill: 'rgba(201,161,59,1)', duration: .6, ease: 'power2.out' }, 1.3);
      const done = new Promise(r => tl.eventCallback('onComplete', r));
      const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise(r => addEventListener('load', r, { once: true }));
      const cap = new Promise(r => setTimeout(r, 3500));
      // filet de sécurité : si les animations sont suspendues (onglet en arrière-plan…), on ne reste jamais bloqué sur le préchargeur
      let exited = false;
      const hardStop = setTimeout(() => {
        if (exited) return;
        exited = true;
        gsap.killTweensOf(loader.querySelectorAll('*'));
        finish();
        resolve();
      }, 9000);
      Promise.all([done, Promise.race([loaded, cap])]).then(() => {
        if (exited) return;
        exited = true;
        clearTimeout(hardStop);
        const out = gsap.timeline({ onComplete: () => { finish(); } });
        out.to('.loader__word, .loader__count', { opacity: 0, y: -20, duration: .45, ease: 'power2.in' })
          .to('.loader__star', { scale: 9, opacity: 0, duration: 1.1, ease: 'power3.in', transformOrigin: '50% 50%' }, 0)
          .to('.loader__panel--l', { xPercent: -101, duration: 1.25, ease: 'expo.inOut' }, .55)
          .to('.loader__panel--r', { xPercent: 101, duration: 1.25, ease: 'expo.inOut' }, .55)
          .add(() => resolve(), .75);
      });
    });
  }

  function heroIntro() {
    if (reduce) return;
    const chars = [];
    $$('.hero__line > *').forEach(el => chars.push(...splitChars(el)));
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('.hero__video', { scale: 1.4 }, { scale: 1.12, duration: 2.8, ease: 'power3.out' }, 0)
      .from(chars, { yPercent: 120, rotate: 6, duration: 1.5, stagger: .045 }, .05)
      .from('.hero [data-hero-in]:not(.badge)', { y: 34, opacity: 0, duration: 1.1, stagger: .09, clearProps: 'transform,opacity' }, .45)
      .from('.hero__arch', { yPercent: 26, opacity: 0, duration: 1.7, stagger: .18 }, .35)
      .from('.hero__spark', { scale: 0, rotate: -120, duration: 1.3, stagger: .15, ease: 'back.out(2.2)' }, .9)
      .from('.badge', { scale: 0, rotate: -90, duration: 1.3, ease: 'back.out(1.6)', clearProps: 'transform' }, .9);
  }

  function initMotion() {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });
    const mm = gsap.matchMedia();
    const isDesk = '(min-width: 900px) and (prefers-reduced-motion: no-preference)';

    /* --- Lenis --- */
    if (!reduce && typeof window.Lenis !== 'undefined') {
      lenis = new Lenis({ duration: 1.15, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)), smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(time => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
      lenis.stop(); // jusqu'à la fin du préchargeur
    } else {
      document.body.style.overflow = 'hidden';
    }

    /* --- nav, progression, boutons flottants --- */
    let bookVisible = false;
    const nav = $('#nav'), bar = $('.progress span'), fab = $('#fab'), tray = $('#tray');
    const setBar = gsap.quickSetter(bar, 'scaleX');
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: self => {
        const y = self.scroll();
        setBar(self.progress);
        nav.classList.toggle('is-solid', y > 60);
        if (!menu.classList.contains('is-open')) nav.classList.toggle('is-hidden', y > 500 && self.direction === 1);
        if (self.direction === -1) nav.classList.remove('is-hidden');
        fab.classList.toggle('is-on', y > innerHeight * .5 && !bookVisible);
      }
    });
    const bookEl = $('#reserver');
    if (bookEl && 'IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => {
        bookVisible = en.isIntersecting;
        tray.classList.toggle('is-on', !bookVisible);
        if (bookVisible) fab.classList.remove('is-on');
      }, { threshold: .1 }).observe(bookEl);
      tray.classList.add('is-on');
    }

    /* --- titres : mots qui montent derrière un masque --- */
    if (!reduce) {
      $$('[data-split]').forEach(h => {
        const words = splitWords(h);
        gsap.from(words, { yPercent: 118, duration: 1.15, ease: 'expo.out', stagger: .065, scrollTrigger: { trigger: h, start: 'top 86%', once: true } });
      });
      $$('[data-fade], .eyebrow:not([data-hero-in])').forEach(el => {
        gsap.from(el, { y: 44, opacity: 0, duration: 1.2, ease: 'expo.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
      });
    }

    /* --- chiffres clés --- */
    $$('[data-count]').forEach(el => {
      const target = parseFloat(el.dataset.count);
      const dec = parseInt(el.dataset.dec || '0', 10);
      const fmt = v => v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
      if (reduce) { el.textContent = fmt(target); return; }
      const o = { v: 0 };
      el.textContent = fmt(0);
      gsap.to(o, { v: target, duration: 2.4, ease: 'power2.out', onUpdate: () => { el.textContent = fmt(o.v); }, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
    });
    if (!reduce) {
      gsap.from('.stat', { y: 60, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: .12, clearProps: 'transform,opacity', scrollTrigger: { trigger: '.stats__grid', start: 'top 85%', once: true } });
    }

    /* --- bandeaux défilants : vitesse et sens liés au scroll --- */
    if (!reduce) {
      const rows = marqueeRows;
      let vel = 0, dirTarget = 1, dirNow = 1, boost = 0;
      ScrollTrigger.create({ onUpdate: s => { vel = s.getVelocity(); dirTarget = s.direction; } });
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(es => es.forEach(en => { const r = rows.find(o => o.row === en.target); if (r) r.vis = en.isIntersecting; }));
        rows.forEach(r => io.observe(r.row));
      }
      gsap.ticker.add((t, dt) => {
        boost += (Math.min(Math.abs(vel), 3500) / 1000 - boost) * .08;
        dirNow += (dirTarget - dirNow) * .07;
        rows.forEach(r => {
          if (!r.vis) return;
          const speed = 55 + boost * 240;
          r.x = gsap.utils.wrap(-r.unit, 0, r.x + r.dir * dirNow * speed * dt / 1000);
          r.tr.style.transform = `translate3d(${r.x}px,0,0)`;
        });
      });
    }

    /* --- magnétisme des boutons, tilt 3D + reflet, curseur --- */
    if (finePointer && !reduce) {
      $$('[data-magnetic]').forEach(el => {
        const xTo = gsap.quickTo(el, 'x', { duration: .9, ease: 'elastic.out(1,.45)' });
        const yTo = gsap.quickTo(el, 'y', { duration: .9, ease: 'elastic.out(1,.45)' });
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * .3);
          yTo((e.clientY - (r.top + r.height / 2)) * .45);
        });
        el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
      });
      $$('.tilt').forEach(el => {
        gsap.set(el, { transformPerspective: 900 });
        const rx = gsap.quickTo(el, 'rotationX', { duration: .7, ease: 'power3.out' });
        const ry = gsap.quickTo(el, 'rotationY', { duration: .7, ease: 'power3.out' });
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
          ry(px * 9); rx(-py * 9);
          el.style.setProperty('--gx', (e.clientX - r.left) + 'px');
          el.style.setProperty('--gy', (e.clientY - r.top) + 'px');
        });
        el.addEventListener('pointerleave', () => { rx(0); ry(0); });
      });
      const cur = $('.cursor');
      html.classList.add('has-cursor');
      const cx = gsap.quickTo(cur, 'x', { duration: .4, ease: 'power3' });
      const cy = gsap.quickTo(cur, 'y', { duration: .4, ease: 'power3' });
      let shown = false;
      addEventListener('pointermove', e => {
        cx(e.clientX); cy(e.clientY);
        if (!shown) { shown = true; gsap.to(cur, { opacity: 1, duration: .5 }); }
      }, { passive: true });
      document.addEventListener('pointerover', e => {
        const hot = e.target.closest('a,button,.tilt,summary,label,input,select');
        gsap.to(cur, { scale: hot ? 1.9 : 1, rotate: hot ? 45 : 0, duration: .5, ease: 'power3.out', overwrite: 'auto' });
      });
      document.documentElement.addEventListener('pointerleave', () => gsap.to(cur, { opacity: 0, duration: .3 }));
      document.documentElement.addEventListener('pointerenter', () => { if (shown) gsap.to(cur, { opacity: 1, duration: .3 }); });
    }

    /* --- carrousel d'avis --- */
    initReviews();

    /* --- pied de page : grand nom --- */
    if (!reduce) {
      $$('.foot__big > span').forEach(s => { s.innerHTML = `<span class="fc">${s.innerHTML}</span>`; });
      gsap.from('.foot__big .fc', { yPercent: 105, ease: 'none', stagger: .25, scrollTrigger: { trigger: '.foot__big', start: 'top 98%', end: 'top 55%', scrub: .6 } });
    }

    /* --- desktop : parallax, pins, défilement horizontal --- */
    mm.add(isDesk, () => {
      // hero multicouche
      const hs = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.hero__media', { yPercent: 16, ease: 'none', scrollTrigger: hs });
      gsap.to('.hero__video', { scale: 1.3, ease: 'none', scrollTrigger: hs });
      gsap.to('.hero__inner', { yPercent: -18, opacity: .15, ease: 'none', scrollTrigger: hs });
      gsap.to('.hero__arch--a', { yPercent: -34, ease: 'none', scrollTrigger: hs });
      gsap.to('.hero__arch--b', { yPercent: 40, ease: 'none', scrollTrigger: hs });
      gsap.to('.hero__arch img', { yPercent: 9, ease: 'none', scrollTrigger: hs });
      gsap.to('.hero__spark--1', { y: -140, rotate: 120, ease: 'none', scrollTrigger: hs });
      gsap.to('.hero__spark--2', { y: -260, rotate: -90, ease: 'none', scrollTrigger: hs });
      gsap.to('.badge', { y: -90, ease: 'none', scrollTrigger: hs });

      // « Le salon » : section pinnée, storytelling en 4 étapes
      const story = $('.story');
      const pin = $('.story__pin');
      const steps = $$('.step', story);
      const imgs = $$('.story__img', story);
      story.classList.add('is-pinned');
      gsap.set(steps, { opacity: 0, y: 40 });
      gsap.set(steps[0], { opacity: 1, y: 0 });
      gsap.set(imgs.slice(1), { clipPath: 'circle(0% at 50% 100%)' });
      const nowEl = $('#stepNow'), barEl = $('.story__bar i');
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: pin, start: 'top top', end: '+=360%', pin: true, scrub: .7, anticipatePin: 1,
          onUpdate: self => {
            const t = self.progress * tl.duration(), L = tl.labels;
            const i = t >= L.s3 + .5 ? 3 : t >= L.s2 + .5 ? 2 : t >= L.s1 + .5 ? 1 : 0;
            nowEl.textContent = '0' + (i + 1);
            gsap.set(barEl, { scaleX: self.progress });
          }
        }
      });
      tl.to({}, { duration: .5 });
      for (let i = 1; i < 4; i++) {
        tl.addLabel('s' + i)
          .to(steps[i - 1], { opacity: 0, y: -40, duration: .5, ease: 'power2.in' }, 's' + i)
          .to(imgs[i], { clipPath: 'circle(150% at 50% 100%)', duration: 1.1 }, 's' + i)
          .fromTo($('img', imgs[i]), { scale: 1.45 }, { scale: 1.16, duration: 1.1 }, 's' + i)
          .to($('img', imgs[i - 1]), { scale: 1.3, duration: 1.1 }, 's' + i)
          .to(steps[i], { opacity: 1, y: 0, duration: .55, ease: 'power2.out' }, 's' + i + '+=.55')
          .to('.story__ring', { rotation: '+=140', duration: 1.1 }, 's' + i)
          .to('.story__spark', { rotation: '+=160', duration: 1.1 }, 's' + i)
          .to({}, { duration: .55 });
      }

      // « Les soins » : défilement horizontal piloté par le scroll vertical
      const sec = $('.services'), sticky = $('.services__sticky'), track = $('.services__track'), vp = $('.services__viewport');
      sec.classList.add('is-hscroll');
      const dist = () => {
        const pad = parseFloat(getComputedStyle(vp).paddingLeft) || 0;
        return Math.max(0, track.scrollWidth - (innerWidth - pad * 2));
      };
      const hbar = $('.services__bar i');
      const hs2 = gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: {
          trigger: sticky, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: s => gsap.set(hbar, { scaleX: s.progress })
        }
      });
      $$('.card__img img, .card__img video', sec).forEach(m => {
        gsap.fromTo(m, { xPercent: -6 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: m.closest('.card'), containerAnimation: hs2, start: 'left right', end: 'right left', scrub: true } });
      });

      // images qui bougent dans leur cadre + colonnes de la galerie à vitesses différentes
      $$('.gcol,.polaroid').forEach(el => {
        const amp = parseFloat(el.dataset.speed || '0') * 150;
        gsap.fromTo(el, { y: amp }, { y: -amp, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: .6 } });
      });
      gsap.fromTo('.meet__main img', { scale: 1.32, yPercent: -7 }, { scale: 1.12, yPercent: 7, ease: 'none', scrollTrigger: { trigger: '.meet__main', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from('.polaroid', { opacity: 0, scale: .85, duration: 1.2, ease: 'expo.out', stagger: .2, scrollTrigger: { trigger: '.meet__media', start: 'top 70%', once: true } });
      gsap.to('.duo__big', { yPercent: -10, ease: 'none', stagger: 0, scrollTrigger: { trigger: '.duo', start: 'top bottom', end: 'bottom top', scrub: true } });

      return () => {
        story.classList.remove('is-pinned');
        sec.classList.remove('is-hscroll');
      };
    });

    // mobile / tablette : simples fondus
    mm.add('(max-width: 899px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.from('.step', { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .1, clearProps: 'transform,opacity', scrollTrigger: { trigger: '.story__steps', start: 'top 85%', once: true } });
      gsap.from('.card', { x: 70, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .1, clearProps: 'transform,opacity', scrollTrigger: { trigger: '.services__track', start: 'top 85%', once: true } });
      gsap.from('.g', { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .06, clearProps: 'transform,opacity', scrollTrigger: { trigger: '.gallery__cols', start: 'top 85%', once: true } });
      gsap.to('.hero__media', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    });

    // révélation de la photo de Noémie : cercle qui s'agrandit (tous écrans)
    if (!reduce) {
      const m = $('[data-circle]');
      if (m) gsap.fromTo(m, { clipPath: 'circle(0% at 50% 62%)' }, { clipPath: 'circle(120% at 50% 62%)', duration: 2, ease: 'power3.inOut', scrollTrigger: { trigger: m, start: 'top 80%', once: true } });
    }

    /* --- polices et images : recalcul des positions --- */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
    addEventListener('load', () => setTimeout(() => ScrollTrigger.refresh(), 200));
  }

  /* ---------- bandeaux : construction (aussi en mouvement réduit) ---------- */
  const marqueeRows = [];
  function buildMarquee() {
    $$('.marquee__row').forEach(row => {
      const tr = $('.marquee__track', row);
      const words = tr.dataset.words.split('|');
      const mk = () => {
        const s = document.createElement('span'); s.className = 'marquee__item';
        s.innerHTML = words.map(w => `<span>${w}</span><svg><use href="#i-spark"/></svg>`).join('');
        return s;
      };
      tr.append(mk());
      const o = { tr, row, dir: parseInt(row.dataset.dir, 10), x: 0, unit: 1, vis: true };
      o.measure = () => {
        o.unit = tr.firstElementChild.getBoundingClientRect().width || 1;
        while (tr.scrollWidth < innerWidth + o.unit * 2 && tr.children.length < 14) tr.append(mk());
      };
      o.measure();
      marqueeRows.push(o);
    });
    const remeasure = () => marqueeRows.forEach(r => r.measure());
    addEventListener('resize', remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    addEventListener('load', remeasure);
  }

  /* ---------- carrousel d'avis ---------- */
  function initReviews() {
    const vp = $('#revViewport'), track = $('#revTrack');
    if (!vp || !track) return;
    const cards = $$('.rcard', track);
    const prog = $('.rev__progress i');
    let i = 0, x = 0, max = 0, step = 0, timer = null, drag = null;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const pad = parseFloat(getComputedStyle(vp).paddingLeft) || 0;
      step = cards[0].offsetWidth + gap;
      max = Math.max(0, track.scrollWidth - (vp.clientWidth - pad * 2));
    };
    const go = n => {
      measure();
      i = Math.max(0, Math.min(cards.length - 1, n));
      x = Math.min(i * step, max);
      gsap.to(track, { x: -x, duration: reduce ? 0 : 1.1, ease: 'expo.out', overwrite: 'auto' });
      gsap.to(prog, { scaleX: cards.length > 1 ? (max ? x / max : 1) : 1, duration: reduce ? 0 : .8, ease: 'power3.out', overwrite: 'auto' });
    };
    const next = () => go(x >= max - 2 ? 0 : i + 1);
    const play = () => { stop(); if (!reduce) timer = setInterval(next, 5600); };
    const stop = () => { clearInterval(timer); timer = null; };
    $('#revNext').addEventListener('click', () => { next(); play(); });
    $('#revPrev').addEventListener('click', () => { go(i - 1); play(); });
    vp.addEventListener('pointerenter', stop);
    vp.addEventListener('pointerleave', () => { if (!drag) play(); });
    vp.addEventListener('focusin', stop);
    vp.addEventListener('focusout', play);

    vp.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      measure();
      drag = { sx: e.clientX, x0: gsap.getProperty(track, 'x'), moved: false, id: e.pointerId };
    });
    addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.sx;
      if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; vp.classList.add('is-drag'); stop(); try { vp.setPointerCapture(drag.id); } catch (er) { /* ignore */ } }
      if (drag.moved) gsap.set(track, { x: Math.max(-max - 80, Math.min(80, drag.x0 + dx)) });
    });
    const end = () => {
      if (!drag) return;
      const moved = drag.moved;
      drag = null;
      vp.classList.remove('is-drag');
      if (moved) { const cur = -gsap.getProperty(track, 'x'); go(Math.round(cur / step)); play(); }
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    addEventListener('resize', () => go(i));
    measure();
    go(0);
    if (!reduce && 'IntersectionObserver' in window) {
      new IntersectionObserver(([en]) => { en.isIntersecting ? play() : stop(); }, { threshold: .25 }).observe(vp);
    }
    // inclinaison des cartes (tilt) gérée par le module général
  }

  /* ==========================================================
     DÉMARRAGE
     ========================================================== */
  function boot() {
    initCarte();
    initComposer();
    initStatus();
    initLightbox();
    initMenu();
    initLazyVideos();
    buildMarquee();

    const heroVideo = $('.hero__video');
    if (heroVideo && reduce) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); }

    if (!hasGsap) {
      const l = $('#loader'); if (l) l.remove();
      return;
    }
    window.scrollTo(0, 0);
    initMotion();
    runLoader().then(() => {
      if (lenis) lenis.start(); else document.body.style.overflow = '';
      heroIntro();
      ScrollTrigger.refresh();
      try { if (location.hash.length > 1 && $(location.hash)) setTimeout(() => scrollToEl(location.hash, true), 60); } catch (e) { /* hash non valide */ }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
