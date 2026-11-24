/*!
 * Socle commun des logiciels de Didier Beltran — version 1.0.0
 * Un seul fichier à ajouter à la fin de chaque page :
 *   <script src="socle.js" data-app="Ciné Western" data-version="1.1.0" data-icone="🤠"></script>
 * Il ajoute, sans toucher au fonctionnement du logiciel :
 *   charte commune, thème clair/sombre, recherche globale (Ctrl+K), sauvegardes
 *   automatiques + export/import, journal d'erreurs, verrou par code, modes
 *   enfants et chantier, taille du texte, nouveautés de version, guide de
 *   démarrage, aide et raccourcis, impression, indicateur hors connexion,
 *   confirmation d'enregistrement et signalement des saisies invalides.
 * Tout est en français et fonctionne hors ligne. Licence MIT.
 */
(function () {
  'use strict';
  if (window.SOCLE) return;

  var SOCLE_VERSION = '1.0.0';
  var me = document.currentScript || document.querySelector('script[data-app]');
  var ds = (me && me.dataset) || {};
  var CONF = Object.assign({
    app: ds.app || document.title || 'Logiciel',
    version: ds.version || '',
    icone: ds.icone || '◆',
    themeNatif: ds.themeNatif || '',
    nouveautes: [],   // liste de phrases affichées après une mise à jour
    guide: [],        // étapes du guide de démarrage
    aide: []          // { titre, texte } pour la page d'aide
  }, window.SOCLE_CONFIG || {});

  var NS = 'socle:';
  var K = {
    prefs: NS + 'prefs', erreurs: NS + 'erreurs', version: NS + 'version',
    guide: NS + 'guide-vu', pin: NS + 'pin', derniere: NS + 'derniere-sauvegarde'
  };
  var safe = function (fn) { try { return fn(); } catch (e) { return undefined; } };
  var lsGet = function (k, d) { return safe(function () { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }) ?? d; };
  var lsSet = function (k, v) { safe(function () { localStorage.setItem(k, JSON.stringify(v)); }); };

  var prefs = Object.assign({ theme: 'auto', mode: 'normal', texte: 100 }, lsGet(K.prefs, {}));
  var savePrefs = function () { lsSet(K.prefs, prefs); };

  /* ------------------------------------------------------------------ */
  /* Charte commune                                                      */
  /* ------------------------------------------------------------------ */
  var CHARTE = {
    '--socle-encre': '#1d2433', '--socle-papier': '#fbfaf7', '--socle-carte': '#ffffff',
    '--socle-trait': '#e3dfd6', '--socle-doux': '#6b7280',
    '--socle-accent': '#2f6f5e', '--socle-accent-2': '#c8772e',
    '--socle-ok': '#2e7d4f', '--socle-alerte': '#b7791f', '--socle-erreur': '#b42318',
    '--socle-rayon': '12px', '--socle-ombre': '0 10px 30px rgba(20,24,33,.18)',
    '--socle-police': '"Segoe UI", "SF Pro Text", -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif',
    '--socle-titre': 'Georgia, "Iowan Old Style", "Palatino Linotype", serif'
  };
  var CHARTE_SOMBRE = {
    '--socle-encre': '#ece8df', '--socle-papier': '#151a22', '--socle-carte': '#1d2430',
    '--socle-trait': '#2e3746', '--socle-doux': '#9aa3b2', '--socle-accent': '#5fb59c', '--socle-accent-2': '#e39a55'
  };
  // Les variables sont publiées sur la page : un logiciel peut s'en servir pour s'aligner sur la charte.
  var rootStyle = document.documentElement.style;
  Object.keys(CHARTE).forEach(function (k) { rootStyle.setProperty(k, CHARTE[k]); });

  /* ------------------------------------------------------------------ */
  /* Styles appliqués à la page (modes, thème, impression, saisies)      */
  /* ------------------------------------------------------------------ */
  var pageCss = document.createElement('style');
  pageCss.id = 'socle-page';
  pageCss.textContent = [
    // Inversion par un calque transparent posé au-dessus de la page : la page elle-même n'est pas modifiée,
    // ses fenêtres et barres fixes restent à leur place, les clics passent au travers.
    'html.socle-inverse::after{content:"";position:fixed;inset:0;z-index:2147482999;pointer-events:none;-webkit-backdrop-filter:invert(1) hue-rotate(180deg);backdrop-filter:invert(1) hue-rotate(180deg)}',
    'html.socle-inverse img,html.socle-inverse video,html.socle-inverse picture,html.socle-inverse svg image{filter:invert(1) hue-rotate(180deg)}',
    'html.socle-chantier body{filter:contrast(1.18) saturate(1.1)}',
    'html.socle-chantier button,html.socle-chantier [role=button],html.socle-chantier input,html.socle-chantier select{min-height:44px}',
    'html.socle-enfants button,html.socle-enfants [role=button]{min-height:48px;border-radius:14px}',
    'html.socle-mouvement-reduit *{animation:none!important;transition:none!important}',
    'input:not([type=checkbox]):not([type=radio]):user-invalid,select:user-invalid,textarea:user-invalid{outline:2px solid #b42318!important;outline-offset:1px}',
    '.socle-trouve{outline:3px solid #c8772e!important;outline-offset:3px;border-radius:4px;transition:outline-color 1.6s}',
    '@media print{#socle-hote{display:none!important}html.socle-inverse::after{display:none}html.socle-inverse img,html.socle-inverse video{filter:none}}'
  ].join('\n');
  (document.head || document.documentElement).appendChild(pageCss);

  /* ------------------------------------------------------------------ */
  /* Interface du socle (dans un Shadow DOM : aucun conflit de style)    */
  /* ------------------------------------------------------------------ */
  var hote, ombre, ui = {};
  var UI_CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:var(--socle-police)}',
    '.bouton-flottant{position:fixed;right:16px;bottom:16px;z-index:2147483000;width:48px;height:48px;border-radius:50%;border:0;cursor:pointer;',
    ' background:var(--socle-accent);color:#fff;font-size:22px;box-shadow:var(--socle-ombre);display:grid;place-items:center;transition:transform .15s}',
    '.bouton-flottant:hover{transform:scale(1.07)} .bouton-flottant:focus-visible{outline:3px solid var(--socle-accent-2);outline-offset:3px}',
    '.pastille{position:fixed;right:70px;bottom:26px;z-index:2147483000;background:var(--socle-alerte);color:#fff;font-size:12px;padding:4px 10px;border-radius:99px;box-shadow:var(--socle-ombre)}',
    '.voile{position:fixed;inset:0;z-index:2147483001;background:rgba(15,18,25,.45);display:flex;align-items:flex-start;justify-content:center;padding:6vh 14px;overflow:auto}',
    '.panneau{background:var(--socle-papier);color:var(--socle-encre);width:min(760px,100%);border-radius:var(--socle-rayon);box-shadow:var(--socle-ombre);overflow:hidden;border:1px solid var(--socle-trait)}',
    '.tete{display:flex;align-items:center;gap:12px;padding:16px 20px;border-bottom:1px solid var(--socle-trait);background:var(--socle-carte)}',
    '.tete h2{font-family:var(--socle-titre);font-size:20px;margin:0;flex:1;font-weight:600}',
    '.tete small{color:var(--socle-doux);font-size:12px}',
    '.fermer{border:0;background:transparent;font-size:22px;cursor:pointer;color:var(--socle-doux);padding:4px 8px;border-radius:8px}',
    '.fermer:hover{background:var(--socle-trait)}',
    '.onglets{display:flex;gap:4px;padding:8px 12px;flex-wrap:wrap;border-bottom:1px solid var(--socle-trait)}',
    '.onglets button{border:0;background:transparent;padding:8px 12px;border-radius:8px;cursor:pointer;color:var(--socle-encre);font-size:14px}',
    '.onglets button[aria-selected=true]{background:var(--socle-accent);color:#fff}',
    '.corps{padding:18px 20px;font-size:14px;line-height:1.5;max-height:64vh;overflow:auto}',
    '.corps h3{font-size:15px;margin:18px 0 8px} .corps h3:first-child{margin-top:0}',
    '.ligne{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0}',
    '.choix{border:1px solid var(--socle-trait);background:var(--socle-carte);color:var(--socle-encre);padding:9px 14px;border-radius:10px;cursor:pointer;font-size:14px}',
    '.choix[aria-pressed=true]{border-color:var(--socle-accent);background:var(--socle-accent);color:#fff}',
    '.choix.principal{background:var(--socle-accent);border-color:var(--socle-accent);color:#fff}',
    '.choix.danger{color:var(--socle-erreur)}',
    '.choix:focus-visible,.onglets button:focus-visible{outline:3px solid var(--socle-accent-2);outline-offset:2px}',
    '.note{color:var(--socle-doux);font-size:13px;margin:4px 0}',
    '.carte{background:var(--socle-carte);border:1px solid var(--socle-trait);border-radius:10px;padding:10px 12px;margin:6px 0}',
    'input[type=search],input[type=password],input[type=text]{width:100%;font-size:16px;padding:12px 14px;border-radius:10px;border:1px solid var(--socle-trait);background:var(--socle-carte);color:var(--socle-encre)}',
    'input:focus{outline:3px solid var(--socle-accent);outline-offset:1px}',
    'input[type=range]{width:220px}',
    '.resultats{list-style:none;padding:0;margin:10px 0 0}',
    '.resultats li{padding:10px 12px;border-radius:10px;cursor:pointer;border:1px solid transparent}',
    '.resultats li:hover,.resultats li[aria-selected=true]{background:var(--socle-carte);border-color:var(--socle-trait)}',
    '.resultats b{color:var(--socle-accent)} .resultats .ou{display:block;color:var(--socle-doux);font-size:12px}',
    'kbd{background:var(--socle-carte);border:1px solid var(--socle-trait);border-bottom-width:2px;border-radius:6px;padding:1px 6px;font-size:12px;font-family:ui-monospace,Menlo,Consolas,monospace}',
    'table{border-collapse:collapse;width:100%} td{padding:6px 4px;border-bottom:1px solid var(--socle-trait)}',
    'pre{white-space:pre-wrap;font-size:12px;background:var(--socle-carte);padding:10px;border-radius:8px;border:1px solid var(--socle-trait);max-height:240px;overflow:auto}',
    '.toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%) translateY(20px);opacity:0;z-index:2147483002;background:var(--socle-encre);color:var(--socle-papier);',
    ' padding:10px 16px;border-radius:99px;font-size:14px;box-shadow:var(--socle-ombre);transition:opacity .2s,transform .2s;pointer-events:none}',
    '.toast.vu{opacity:1;transform:translateX(-50%) translateY(0)}',
    '.toast.ok::before{content:"✓ ";color:#7fd6a5;font-weight:700} .toast.err::before{content:"! ";color:#ff9b8f;font-weight:700}',
    '.verrou{position:fixed;inset:0;z-index:2147483003;background:var(--socle-papier);display:grid;place-items:center;padding:20px}',
    '.verrou .boite{width:min(360px,100%);text-align:center;color:var(--socle-encre)}',
    '.verrou .ico{font-size:46px} .verrou h2{font-family:var(--socle-titre);margin:8px 0 18px}',
    '.etapes{counter-reset:e;padding:0;list-style:none} .etapes li{counter-increment:e;position:relative;padding:8px 0 8px 40px}',
    '.etapes li::before{content:counter(e);position:absolute;left:0;top:6px;width:28px;height:28px;border-radius:50%;background:var(--socle-accent);color:#fff;display:grid;place-items:center;font-weight:700;font-size:13px}',
    '@media (prefers-reduced-motion:reduce){*{transition:none!important}}'
  ].join('\n');

  function el(tag, attrs, enfants) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (a) {
      if (a === 'texte') n.textContent = attrs[a];
      else if (a.slice(0, 2) === 'on') n.addEventListener(a.slice(2), attrs[a]);
      else n.setAttribute(a, attrs[a]);
    });
    (enfants || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  function monter() {
    if (hote) return;
    hote = el('div', { id: 'socle-hote' });
    ombre = hote.attachShadow({ mode: 'open' });
    ombre.appendChild(el('style', { texte: UI_CSS }));
    ui.bouton = el('button', {
      class: 'bouton-flottant', title: 'Outils communs (Ctrl+K pour chercher, F1 pour l\'aide)',
      'aria-label': 'Ouvrir les outils communs', onclick: function () { ouvrir('outils'); }
    }, [CONF.icone]);
    ui.toast = el('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    ombre.appendChild(ui.bouton);
    ombre.appendChild(ui.toast);
    document.documentElement.appendChild(hote); // hors de <body> : ni zoomé, ni touché par les styles du logiciel
  }

  /* ------------------------------------------------------------------ */
  /* Message court en bas de l'écran                                     */
  /* ------------------------------------------------------------------ */
  var toastTimer;
  function toast(msg, type) {
    if (!ui.toast) return;
    ui.toast.className = 'toast ' + (type || 'ok');
    ui.toast.textContent = msg;
    void ui.toast.offsetWidth;
    ui.toast.classList.add('vu');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { ui.toast.classList.remove('vu'); }, 2200);
  }

  /* ------------------------------------------------------------------ */
  /* Thème, modes, taille du texte                                       */
  /* ------------------------------------------------------------------ */
  function luminance(css) {
    var m = String(css).match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    if (p.length > 3 && p[3] === 0) return null;
    return (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255;
  }
  function pageEstSombre() {
    var l = luminance(getComputedStyle(document.body).backgroundColor);
    if (l == null) l = luminance(getComputedStyle(document.documentElement).backgroundColor);
    return l != null && l < 0.45;
  }
  var natifSombre = null;
  var mqSombre = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function appliquer() {
    var h = document.documentElement;
    if (natifSombre === null) natifSombre = pageEstSombre();
    var voulu = prefs.theme === 'auto' ? (mqSombre && mqSombre.matches ? 'sombre' : 'clair') : prefs.theme;
    // Si le logiciel gère déjà le thème lui-même, on lui transmet le choix.
    h.setAttribute('data-socle-theme', voulu);
    if (CONF.themeNatif) { // ex. "data-theme:light:dark" — le logiciel a ses propres thèmes
      var tn = String(CONF.themeNatif).split(':');
      h.setAttribute('data-theme-natif', '');
      if (prefs.theme === 'auto') h.removeAttribute(tn[0]); else h.setAttribute(tn[0], voulu === 'sombre' ? (tn[2] || 'dark') : (tn[1] || 'light'));
    }
    // « Automatique » respecte l'apparence d'origine du logiciel ; « Clair » ou « Sombre »
    // l'imposent (par inversion des couleurs, photos et vidéos gardées intactes).
    // Un logiciel qui gère lui-même ses thèmes met data-theme-natif sur <html>.
    var inverse = prefs.theme !== 'auto' && !h.hasAttribute('data-theme-natif') && ((voulu === 'sombre') !== natifSombre);
    h.classList.toggle('socle-inverse', inverse);
    var sombreReel = inverse ? !natifSombre : natifSombre;
    var palette = sombreReel ? Object.assign({}, CHARTE, CHARTE_SOMBRE) : CHARTE;
    Object.keys(palette).forEach(function (k) { rootStyle.setProperty(k, palette[k]); });
    if (hote) Object.keys(palette).forEach(function (k) { hote.style.setProperty(k, palette[k]); });

    h.classList.toggle('socle-enfants', prefs.mode === 'enfants');
    h.classList.toggle('socle-chantier', prefs.mode === 'chantier');
    var zoom = prefs.texte / 100 * (prefs.mode === 'enfants' ? 1.2 : prefs.mode === 'chantier' ? 1.15 : 1);
    document.body.style.zoom = zoom === 1 ? '' : String(zoom);
    if (window.SOCLE && typeof window.SOCLE.surChangement === 'function') safe(function () { window.SOCLE.surChangement(Object.assign({}, prefs)); });
  }
  if (mqSombre && mqSombre.addEventListener) mqSombre.addEventListener('change', function () { if (prefs.theme === 'auto') appliquer(); });

  /* ------------------------------------------------------------------ */
  /* Sauvegardes : export / import / copies automatiques                 */
  /* ------------------------------------------------------------------ */
  function clesLogiciel() {
    var out = [];
    safe(function () { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(NS) !== 0) out.push(k); } });
    return out.sort();
  }
  function instantane() {
    var donnees = {};
    clesLogiciel().forEach(function (k) { donnees[k] = safe(function () { return localStorage.getItem(k); }); });
    return { format: 'socle-sauvegarde', socle: SOCLE_VERSION, logiciel: CONF.app, version: CONF.version, date: new Date().toISOString(), donnees: donnees };
  }
  function nomFichier(suffixe) {
    var base = String(CONF.app).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return base + '-' + suffixe + '-' + new Date().toISOString().slice(0, 10) + '.json';
  }
  function telecharger(nom, texte, type) {
    var url = URL.createObjectURL(new Blob([texte], { type: type || 'application/json' }));
    var a = el('a', { href: url, download: nom });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function exporter() {
    var s = instantane();
    telecharger(nomFichier('sauvegarde'), JSON.stringify(s, null, 1));
    lsSet(K.derniere, s.date);
    toast('Sauvegarde téléchargée (' + Object.keys(s.donnees).length + ' éléments)');
  }
  function importerTexte(txt) {
    var s = JSON.parse(txt);
    if (!s || s.format !== 'socle-sauvegarde' || typeof s.donnees !== 'object') throw new Error('Ce fichier n\'est pas une sauvegarde du socle.');
    if (s.logiciel && s.logiciel !== CONF.app && !confirm('Cette sauvegarde vient de « ' + s.logiciel + ' ». L\'importer quand même dans « ' + CONF.app + ' » ?')) return false;
    if (!confirm('Remplacer les données actuelles par la sauvegarde du ' + new Date(s.date).toLocaleString('fr-FR') + ' ?\nUne copie de secours des données actuelles est faite avant.')) return false;
    copieAuto('avant-import');
    clesLogiciel().forEach(function (k) { safe(function () { localStorage.removeItem(k); }); });
    Object.keys(s.donnees).forEach(function (k) { if (s.donnees[k] != null) brutSet.call(localStorage, k, s.donnees[k]); });
    return true;
  }
  function importer() {
    var f = el('input', { type: 'file', accept: '.json,application/json' });
    f.addEventListener('change', function () {
      var file = f.files && f.files[0]; if (!file) return;
      file.text().then(function (t) {
        try { if (importerTexte(t)) { toast('Sauvegarde rétablie — rechargement…'); setTimeout(function () { location.reload(); }, 900); } }
        catch (e) { toast(e.message, 'err'); }
      });
    });
    f.click();
  }

  // Copies automatiques dans IndexedDB : une par jour, 14 gardées, + une avant chaque import.
  var DB_NOM = 'socle-copies', ST = 'copies';
  function db() {
    return new Promise(function (ok, ko) {
      if (!window.indexedDB) return ko(new Error('indisponible'));
      var r = indexedDB.open(DB_NOM, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST, { keyPath: 'id' }); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { ko(r.error); };
    });
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, ko) {
        var t = d.transaction(ST, mode), s = t.objectStore(ST), res;
        res = fn(s); t.oncomplete = function () { ok(res && res.result !== undefined ? res.result : res); }; t.onerror = function () { ko(t.error); };
      });
    });
  }
  function listerCopies() {
    return tx('readonly', function (s) { return s.getAll(); }).then(function (l) { return (l || []).sort(function (a, b) { return b.id.localeCompare(a.id); }); }).catch(function () { return []; });
  }
  function copieAuto(motif) {
    var s = instantane();
    if (!Object.keys(s.donnees).length) return Promise.resolve();
    var id = motif === 'quotidienne' ? 'jour-' + s.date.slice(0, 10) : motif + '-' + s.date;
    return tx('readwrite', function (st) { st.put({ id: id, motif: motif, date: s.date, taille: JSON.stringify(s).length, sauvegarde: s }); })
      .then(listerCopies)
      .then(function (l) {
        var jours = l.filter(function (c) { return c.motif === 'quotidienne'; }).slice(14);
        var autres = l.filter(function (c) { return c.motif !== 'quotidienne'; }).slice(5);
        if (jours.length + autres.length) return tx('readwrite', function (st) { jours.concat(autres).forEach(function (c) { st.delete(c.id); }); });
      }).catch(function () {});
  }
  function restaurerCopie(id) {
    tx('readonly', function (s) { return s.get(id); }).then(function (c) {
      if (!c) return;
      try { if (importerTexte(JSON.stringify(c.sauvegarde))) { toast('Copie rétablie — rechargement…'); setTimeout(function () { location.reload(); }, 900); } }
      catch (e) { toast(e.message, 'err'); }
    });
  }

  /* Confirmation discrète à chaque enregistrement du logiciel */
  var brutSet = Storage.prototype.setItem;
  var enregTimer, enregCompte = 0, dernierToast = 0, debut = Date.now();
  safe(function () {
    Storage.prototype.setItem = function (k, v) {
      var r = brutSet.apply(this, arguments);
      if (this === window.localStorage && String(k).indexOf(NS) !== 0) {
        enregCompte++;
        clearTimeout(enregTimer);
        enregTimer = setTimeout(function () {
          // pas au démarrage, et pas plus d'une fois toutes les 8 secondes
          if (Date.now() - debut > 4000 && Date.now() - dernierToast > 8000 && document.hasFocus() && !(voile)) { dernierToast = Date.now(); toast('Enregistré'); }
        }, 700);
      }
      return r;
    };
  });

  /* ------------------------------------------------------------------ */
  /* Journal d'erreurs                                                   */
  /* ------------------------------------------------------------------ */
  function noterErreur(type, message, detail) {
    var j = lsGet(K.erreurs, []);
    j.unshift({ date: new Date().toISOString(), type: type, message: String(message || '').slice(0, 400), detail: String(detail || '').slice(0, 1600) });
    lsSet(K.erreurs, j.slice(0, 50));
    majPastille();
  }
  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window && e.target.tagName) { noterErreur('fichier', 'Impossible de charger ' + (e.target.src || e.target.href || e.target.tagName), ''); return; }
    noterErreur('erreur', e.message, (e.filename || '') + ':' + (e.lineno || '') + '\n' + (e.error && e.error.stack || ''));
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason; noterErreur('promesse', r && r.message || String(r), r && r.stack || '');
  });
  function rapportErreurs() {
    var j = lsGet(K.erreurs, []);
    return [
      'Logiciel : ' + CONF.app + ' ' + (CONF.version || ''), 'Socle : ' + SOCLE_VERSION,
      'Date : ' + new Date().toLocaleString('fr-FR'), 'Système : ' + navigator.userAgent, '',
      j.length ? j.map(function (x) { return '[' + new Date(x.date).toLocaleString('fr-FR') + '] ' + x.type + ' — ' + x.message + (x.detail ? '\n    ' + x.detail.replace(/\n/g, '\n    ') : ''); }).join('\n\n') : 'Aucune erreur enregistrée.'
    ].join('\n');
  }
  function majPastille() {
    if (!ombre) return;
    var n = lsGet(K.erreurs, []).filter(function (x) { return !x.vu; }).length;
    if (ui.pastille) ui.pastille.remove(), ui.pastille = null;
    if (n) {
      ui.pastille = el('div', { class: 'pastille', title: 'Voir le journal' }, [n + ' erreur' + (n > 1 ? 's' : '')]);
      ui.pastille.style.cursor = 'pointer';
      ui.pastille.addEventListener('click', function () { ouvrir('journal'); });
      ombre.appendChild(ui.pastille);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Recherche globale (tolère accents et petites fautes de frappe)      */
  /* ------------------------------------------------------------------ */
  var norm = function (s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
  function proche(a, b) { // distance d'édition ≤ 1 (≤ 2 pour les mots longs)
    if (Math.abs(a.length - b.length) > 2) return false;
    var max = b.length > 6 ? 2 : 1, i, j, prev = [], cur;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i]; var minLigne = i;
      for (j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < minLigne) minLigne = cur[j]; }
      if (minLigne > max) return false; prev = cur;
    }
    return prev[b.length] <= max;
  }
  function blocs() {
    var sel = 'h1,h2,h3,h4,h5,h6,li,td,th,p,label,button,summary,dt,dd,option,figcaption,[data-titre],.card,.carte,.item,.fiche';
    var vus = new Set(), out = [];
    document.querySelectorAll(sel).forEach(function (n) {
      if (hote && hote.contains(n)) return;
      if (n.closest('script,style,noscript,#socle-hote')) return;
      var t = (n.getAttribute('data-titre') || n.innerText || n.textContent || '').replace(/\s+/g, ' ').trim();
      if (t.length < 2 || t.length > 260) return;
      var cle = t + '|' + (n.offsetParent ? 1 : 0);
      if (vus.has(cle)) return; vus.add(cle);
      out.push({ n: n, t: t, k: norm(t) });
    });
    return out;
  }
  function chercher(q) {
    var mots = norm(q).split(' ').filter(Boolean);
    if (!mots.length) return [];
    var res = [];
    blocs().forEach(function (b) {
      var motsB = b.k.split(' '), score = 0, ok = true;
      for (var i = 0; i < mots.length; i++) {
        var m = mots[i];
        if (b.k.indexOf(m) !== -1) score += (b.k.indexOf(m) === 0 ? 4 : 3);
        else if (m.length >= 4 && motsB.some(function (w) { return proche(m, w) || proche(m, w.slice(0, m.length)); })) score += 1;
        else { ok = false; break; }
      }
      if (!ok) return;
      if (/^H\d$/.test(b.n.tagName)) score += 2;
      if (b.n.offsetParent) score += 1;
      res.push({ b: b, score: score });
    });
    return res.sort(function (a, b) { return b.score - a.score || a.b.t.length - b.b.t.length; }).slice(0, 40);
  }
  function ouSeTrouve(n) {
    var p = n, titre = '';
    while (p && p !== document.body && !titre) {
      var h = p.querySelector && p.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > header h1, :scope > header h2');
      if (h && h !== n) titre = h.textContent.trim();
      if (!titre && p.id) titre = '';
      p = p.parentElement;
    }
    return titre.slice(0, 60);
  }
  function rendreVisible(n) {
    // Ouvre les <details> et essaie d'activer l'onglet qui contient l'élément.
    var p = n;
    while (p && p !== document.body) {
      if (p.tagName === 'DETAILS') p.open = true;
      if (p.id && getComputedStyle(p).display === 'none') {
        var dec = document.querySelector('[data-tab="' + p.id + '"],[data-page="' + p.id + '"],[data-view="' + p.id + '"],[data-section="' + p.id + '"],[aria-controls="' + p.id + '"],a[href="#' + p.id + '"]');
        if (dec) dec.click();
      }
      p = p.parentElement;
    }
  }
  function aller(n) {
    fermer();
    rendreVisible(n);
    setTimeout(function () {
      if (!n.offsetParent) { toast('Élément trouvé, mais dans une partie fermée du logiciel', 'err'); return; }
      n.scrollIntoView({ behavior: 'smooth', block: 'center' });
      n.classList.add('socle-trouve');
      setTimeout(function () { n.classList.remove('socle-trouve'); }, 2400);
    }, 120);
  }

  /* ------------------------------------------------------------------ */
  /* Verrou par code                                                     */
  /* ------------------------------------------------------------------ */
  function hacher(txt) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve('x' + Array.from(txt).reduce(function (h, c) { return (h * 31 + c.charCodeAt(0)) | 0; }, 7));
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode('socle|' + CONF.app + '|' + txt)).then(function (b) {
      return Array.from(new Uint8Array(b)).map(function (x) { return x.toString(16).padStart(2, '0'); }).join('');
    });
  }
  function verrouiller() {
    var h = lsGet(K.pin, null); if (!h) return;
    var champ = el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', 'aria-label': 'Code', placeholder: 'Code' });
    var msg = el('p', { class: 'note', texte: ' ' });
    var v = el('div', { class: 'verrou', role: 'dialog', 'aria-modal': 'true' }, [el('div', { class: 'boite' }, [
      el('div', { class: 'ico', texte: '🔒' }), el('h2', { texte: CONF.app }), champ, msg,
      el('p', { class: 'note', texte: 'Code oublié ? Supprimez « socle:pin » dans les données du logiciel, ou restaurez une sauvegarde.' })
    ])]);
    champ.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      hacher(champ.value).then(function (x) {
        if (x === h) { v.remove(); toast('Déverrouillé'); } else { msg.textContent = 'Code incorrect.'; champ.value = ''; }
      });
    });
    ombre.appendChild(v);
    setTimeout(function () { champ.focus(); }, 50);
  }

  /* ------------------------------------------------------------------ */
  /* Fenêtre des outils                                                  */
  /* ------------------------------------------------------------------ */
  var voile = null, rendu = {};
  function fermer() { if (voile) { voile.remove(); voile = null; document.removeEventListener('keydown', echapper, true); } }
  function echapper(e) { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } }

  function ouvrir(onglet) {
    monter(); fermer();
    var corps = el('div', { class: 'corps' });
    var ongs = [['chercher', 'Chercher'], ['outils', 'Affichage'], ['sauvegardes', 'Sauvegardes'], ['securite', 'Sécurité'], ['aide', 'Aide'], ['journal', 'Journal']];
    var barre = el('div', { class: 'onglets', role: 'tablist' });
    ongs.forEach(function (o) {
      barre.appendChild(el('button', { role: 'tab', 'data-o': o[0], 'aria-selected': String(o[0] === onglet), onclick: function () { choisir(o[0]); } }, [o[1]]));
    });
    function choisir(o) {
      barre.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.o === o)); });
      corps.innerHTML = ''; (rendu[o] || rendu.outils)(corps);
    }
    var panneau = el('div', { class: 'panneau', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Outils communs' }, [
      el('div', { class: 'tete' }, [
        el('span', { texte: CONF.icone, style: 'font-size:24px' }),
        el('h2', {}, [CONF.app, ' ', el('small', { texte: CONF.version ? 'version ' + CONF.version : '' })]),
        el('button', { class: 'fermer', 'aria-label': 'Fermer', onclick: fermer }, ['×'])
      ]), barre, corps
    ]);
    voile = el('div', { class: 'voile', onclick: function (e) { if (e.target === voile) fermer(); } }, [panneau]);
    ombre.appendChild(voile);
    document.addEventListener('keydown', echapper, true);
    choisir(onglet || 'outils');
  }

  function groupe(titre, options, actuel, surChoix) {
    var l = el('div', { class: 'ligne' });
    options.forEach(function (o) {
      l.appendChild(el('button', { class: 'choix', 'aria-pressed': String(o[0] === actuel), onclick: function () {
        l.querySelectorAll('.choix').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
        this.setAttribute('aria-pressed', 'true'); surChoix(o[0]);
      } }, [o[1]]));
    });
    return [el('h3', { texte: titre }), l];
  }

  rendu.chercher = function (c) {
    var champ = el('input', { type: 'search', placeholder: 'Chercher dans ' + CONF.app + '…', 'aria-label': 'Recherche' });
    var liste = el('ul', { class: 'resultats', role: 'listbox' });
    var info = el('p', { class: 'note', texte: 'Les accents et les petites fautes de frappe sont tolérés. Entrée pour ouvrir le premier résultat.' });
    var res = [], sel = 0, t;
    function afficher() {
      liste.innerHTML = '';
      res.forEach(function (r, i) {
        var li = el('li', { role: 'option', 'aria-selected': String(i === sel), onclick: function () { aller(r.b.n); } });
        var txt = r.b.t.length > 140 ? r.b.t.slice(0, 140) + '…' : r.b.t;
        li.appendChild(el('span', { texte: txt }));
        var ou = ouSeTrouve(r.b.n); if (ou) li.appendChild(el('span', { class: 'ou', texte: '› ' + ou + (r.b.n.offsetParent ? '' : ' (partie masquée)') }));
        liste.appendChild(li);
      });
      if (champ.value && !res.length) liste.appendChild(el('li', { texte: 'Rien trouvé sur cet écran.' }));
    }
    champ.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { res = chercher(champ.value); sel = 0; afficher(); }, 120); });
    champ.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { sel = Math.min(sel + 1, res.length - 1); afficher(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { sel = Math.max(sel - 1, 0); afficher(); e.preventDefault(); }
      else if (e.key === 'Enter' && res[sel]) aller(res[sel].b.n);
    });
    c.appendChild(champ); c.appendChild(info); c.appendChild(liste);
    setTimeout(function () { champ.focus(); }, 30);
  };

  rendu.outils = function (c) {
    groupe('Thème', [['auto', 'Automatique'], ['clair', 'Clair'], ['sombre', 'Sombre']], prefs.theme, function (v) { prefs.theme = v; savePrefs(); appliquer(); }).forEach(function (n) { c.appendChild(n); });
    c.appendChild(el('p', { class: 'note', texte: 'Automatique suit le réglage de l\'ordinateur.' }));
    groupe('Mode', [['normal', 'Normal'], ['enfants', '🧒 Enfants'], ['chantier', '🦺 Chantier']], prefs.mode, function (v) { prefs.mode = v; savePrefs(); appliquer(); }).forEach(function (n) { c.appendChild(n); });
    c.appendChild(el('p', { class: 'note', texte: 'Enfants : tout en plus gros, boutons arrondis. Chantier : gros boutons utilisables avec des gants et contraste renforcé pour le plein soleil.' }));
    c.appendChild(el('h3', { texte: 'Taille du texte' }));
    var val = el('span', { texte: prefs.texte + ' %' });
    var r = el('input', { type: 'range', min: '80', max: '160', step: '5', value: String(prefs.texte), 'aria-label': 'Taille du texte' });
    r.addEventListener('input', function () { prefs.texte = +r.value; val.textContent = r.value + ' %'; savePrefs(); appliquer(); });
    c.appendChild(el('div', { class: 'ligne' }, [r, val, el('button', { class: 'choix', onclick: function () { prefs.texte = 100; r.value = 100; val.textContent = '100 %'; savePrefs(); appliquer(); } }, ['Normale'])]));
    c.appendChild(el('h3', { texte: 'Impression' }));
    c.appendChild(el('div', { class: 'ligne' }, [el('button', { class: 'choix', onclick: function () { fermer(); setTimeout(function () { window.print(); }, 150); } }, ['🖨 Imprimer ou enregistrer en PDF'])]));
    c.appendChild(el('p', { class: 'note', texte: 'Dans la fenêtre d\'impression, choisissez « Enregistrer au format PDF » pour obtenir un fichier.' }));
  };

  rendu.sauvegardes = function (c) {
    var der = lsGet(K.derniere, null);
    c.appendChild(el('h3', { texte: 'Sauvegarde manuelle' }));
    c.appendChild(el('div', { class: 'ligne' }, [
      el('button', { class: 'choix principal', onclick: exporter }, ['⬇ Télécharger une sauvegarde']),
      el('button', { class: 'choix', onclick: importer }, ['⬆ Rétablir depuis un fichier'])
    ]));
    c.appendChild(el('p', { class: 'note', texte: (der ? 'Dernière sauvegarde téléchargée : ' + new Date(der).toLocaleString('fr-FR') + '. ' : 'Aucune sauvegarde téléchargée pour l\'instant. ') + 'Rangez le fichier dans Google Drive ou sur le NAS. Raccourci : Ctrl+Maj+S.' }));
    c.appendChild(el('h3', { texte: 'Copies automatiques' }));
    c.appendChild(el('p', { class: 'note', texte: 'Une copie est faite chaque jour (14 jours gardés), et avant chaque rétablissement.' }));
    var zone = el('div', { texte: 'Chargement…' }); c.appendChild(zone);
    listerCopies().then(function (l) {
      zone.innerHTML = '';
      if (!l.length) { zone.appendChild(el('p', { class: 'note', texte: 'Pas encore de copie. La première sera faite dans une minute.' })); return; }
      var tb = el('table');
      l.forEach(function (x) {
        tb.appendChild(el('tr', {}, [
          el('td', { texte: new Date(x.date).toLocaleString('fr-FR') }),
          el('td', { texte: x.motif === 'quotidienne' ? 'du jour' : 'avant rétablissement' }),
          el('td', { texte: Math.max(1, Math.round(x.taille / 1024)) + ' Ko' }),
          el('td', {}, [el('button', { class: 'choix', onclick: function () { restaurerCopie(x.id); } }, ['Rétablir'])])
        ]));
      });
      zone.appendChild(tb);
    });
  };

  rendu.securite = function (c) {
    var a = lsGet(K.pin, null);
    c.appendChild(el('h3', { texte: 'Code au démarrage' }));
    c.appendChild(el('p', { class: 'note', texte: a ? 'Un code est demandé à chaque ouverture.' : 'Aucun code. Utile pour les logiciels sensibles (bourse, épargne, pointage).' }));
    var c1 = el('input', { type: 'password', inputmode: 'numeric', placeholder: 'Nouveau code (4 chiffres ou plus)' });
    var c2 = el('input', { type: 'password', inputmode: 'numeric', placeholder: 'Le retaper' });
    c2.style.marginTop = '8px';
    c.appendChild(c1); c.appendChild(c2);
    c.appendChild(el('div', { class: 'ligne' }, [
      el('button', { class: 'choix principal', onclick: function () {
        if (c1.value.length < 4) return toast('Au moins 4 caractères', 'err');
        if (c1.value !== c2.value) return toast('Les deux codes sont différents', 'err');
        hacher(c1.value).then(function (h) { lsSet(K.pin, h); toast('Code enregistré'); choisirOnglet('securite'); });
      } }, [a ? 'Changer le code' : 'Mettre un code']),
      a ? el('button', { class: 'choix danger', onclick: function () { if (confirm('Retirer le code ?')) { safe(function () { localStorage.removeItem(K.pin); }); toast('Code retiré'); choisirOnglet('securite'); } } }, ['Retirer le code']) : null
    ]));
    c.appendChild(el('p', { class: 'note', texte: 'Le code n\'est jamais enregistré en clair. Il protège contre un regard indiscret, pas contre un spécialiste qui aurait l\'ordinateur entre les mains.' }));
  };
  function choisirOnglet(o) { if (voile) { var b = voile.querySelector('[data-o="' + o + '"]'); if (b) b.click(); } }

  rendu.aide = function (c) {
    if (CONF.guide.length) {
      c.appendChild(el('h3', { texte: 'Pour bien démarrer' }));
      var ol = el('ol', { class: 'etapes' }); CONF.guide.forEach(function (g) { ol.appendChild(el('li', { texte: g })); }); c.appendChild(ol);
    }
    CONF.aide.forEach(function (a) { c.appendChild(el('h3', { texte: a.titre })); c.appendChild(el('p', { texte: a.texte })); });
    if (CONF.nouveautes.length) {
      c.appendChild(el('h3', { texte: 'Nouveautés de la version ' + CONF.version }));
      var ul = el('ul'); CONF.nouveautes.forEach(function (n) { ul.appendChild(el('li', { texte: n })); }); c.appendChild(ul);
    }
    c.appendChild(el('h3', { texte: 'Raccourcis clavier' }));
    var tb = el('table');
    [['Ctrl+K', 'Chercher partout'], ['F1', 'Cette aide'], ['Ctrl+Maj+S', 'Télécharger une sauvegarde'], ['Ctrl+Maj+O', 'Rétablir une sauvegarde'],
      ['Ctrl+P', 'Imprimer / PDF'], ['Ctrl+Maj+D', 'Basculer clair / sombre'], ['Ctrl+ +  /  Ctrl+ −', 'Agrandir / réduire le texte'],
      ['Ctrl+Z / Ctrl+Y', 'Annuler / refaire dans un champ'], ['Échap', 'Fermer cette fenêtre']].forEach(function (r) {
      tb.appendChild(el('tr', {}, [el('td', {}, [el('kbd', { texte: r[0] })]), el('td', { texte: r[1] })]));
    });
    c.appendChild(tb);
    c.appendChild(el('p', { class: 'note', texte: 'Sur Mac, Ctrl correspond à la touche ⌘ Cmd.' }));
  };

  rendu.journal = function (c) {
    var j = lsGet(K.erreurs, []);
    j.forEach(function (x) { x.vu = true; }); lsSet(K.erreurs, j); majPastille();
    c.appendChild(el('p', { class: 'note', texte: j.length ? j.length + ' erreur(s) enregistrée(s). En cas de problème, envoyez ce rapport à Claude pour qu\'il corrige le logiciel.' : 'Aucune erreur enregistrée. Tout va bien.' }));
    var txt = rapportErreurs();
    c.appendChild(el('pre', { texte: txt }));
    c.appendChild(el('div', { class: 'ligne' }, [
      el('button', { class: 'choix principal', onclick: function () {
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Rapport copié'); }, function () { telecharger(nomFichier('rapport-erreurs').replace('.json', '.txt'), txt, 'text/plain'); toast('Rapport téléchargé'); });
      } }, ['📋 Copier le rapport']),
      el('button', { class: 'choix', onclick: function () { telecharger(nomFichier('rapport-erreurs').replace('.json', '.txt'), txt, 'text/plain'); } }, ['Télécharger']),
      j.length ? el('button', { class: 'choix danger', onclick: function () { lsSet(K.erreurs, []); majPastille(); choisirOnglet('journal'); } }, ['Vider le journal']) : null
    ]));
  };

  /* ------------------------------------------------------------------ */
  /* Raccourcis clavier                                                  */
  /* ------------------------------------------------------------------ */
  document.addEventListener('keydown', function (e) {
    var mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
    if (mod && !e.shiftKey && k === 'k') { e.preventDefault(); ouvrir('chercher'); }
    else if (e.key === 'F1') { e.preventDefault(); ouvrir('aide'); }
    else if (mod && e.shiftKey && k === 's') { e.preventDefault(); exporter(); }
    else if (mod && e.shiftKey && k === 'o') { e.preventDefault(); importer(); }
    else if (mod && e.shiftKey && k === 'd') {
      e.preventDefault();
      var actuel = document.documentElement.getAttribute('data-socle-theme');
      prefs.theme = actuel === 'sombre' ? 'clair' : 'sombre'; savePrefs(); appliquer();
      toast('Thème ' + prefs.theme);
    }
    else if (mod && (k === '+' || k === '=')) { e.preventDefault(); prefs.texte = Math.min(160, prefs.texte + 10); savePrefs(); appliquer(); toast('Texte ' + prefs.texte + ' %'); }
    else if (mod && (k === '-' || k === '_')) { e.preventDefault(); prefs.texte = Math.max(80, prefs.texte - 10); savePrefs(); appliquer(); toast('Texte ' + prefs.texte + ' %'); }
    else if (mod && k === '0' && prefs.texte !== 100) { e.preventDefault(); prefs.texte = 100; savePrefs(); appliquer(); }
  });

  /* ------------------------------------------------------------------ */
  /* Saisies invalides : message clair                                   */
  /* ------------------------------------------------------------------ */
  document.addEventListener('invalid', function (e) {
    var c = e.target, nom = (c.labels && c.labels[0] && c.labels[0].textContent.trim()) || c.placeholder || c.name || 'ce champ';
    var m = c.validity.valueMissing ? 'est obligatoire' : c.validity.rangeUnderflow ? 'doit être au moins ' + c.min : c.validity.rangeOverflow ? 'doit être au plus ' + c.max :
      c.validity.badInput || c.validity.typeMismatch ? 'n\'a pas le bon format' : c.validity.stepMismatch ? 'n\'a pas une valeur autorisée' : 'n\'est pas valide';
    toast('« ' + nom.slice(0, 40) + ' » ' + m, 'err');
  }, true);
  document.addEventListener('change', function (e) {
    var c = e.target;
    if (c && c.tagName === 'INPUT' && c.type === 'number' && c.value !== '' && c.checkValidity && !c.checkValidity()) {
      var m = c.validity.rangeUnderflow ? 'au moins ' + c.min : c.validity.rangeOverflow ? 'au plus ' + c.max : 'une valeur autorisée';
      toast('Valeur à corriger : ' + m, 'err');
    }
  }, true);

  /* ------------------------------------------------------------------ */
  /* Hors connexion                                                      */
  /* ------------------------------------------------------------------ */
  window.addEventListener('offline', function () { toast('Hors connexion — le logiciel continue de fonctionner, vos saisies sont gardées', 'err'); });
  window.addEventListener('online', function () { toast('Connexion rétablie'); });

  /* ------------------------------------------------------------------ */
  /* Démarrage                                                           */
  /* ------------------------------------------------------------------ */
  function demarrer() {
    monter();
    appliquer();
    majPastille();
    verrouiller();
    // Nouveautés après une mise à jour, guide au tout premier lancement
    var avant = lsGet(K.version, null);
    if (CONF.version && avant && avant !== CONF.version && CONF.nouveautes.length) setTimeout(function () { ouvrir('aide'); }, 1200);
    else if (!lsGet(K.guide, false) && CONF.guide.length) setTimeout(function () { ouvrir('aide'); }, 1500);
    if (CONF.version) lsSet(K.version, CONF.version);
    lsSet(K.guide, true);
    setTimeout(function () { copieAuto('quotidienne'); }, 60000);
    setInterval(function () { copieAuto('quotidienne'); }, 3 * 3600 * 1000);
    window.addEventListener('beforeunload', function () { if (enregCompte) copieAuto('quotidienne'); });
  }

  window.SOCLE = {
    version: SOCLE_VERSION, config: CONF, charte: CHARTE,
    ouvrir: ouvrir, fermer: fermer, toast: toast, exporter: exporter, importer: importer,
    copie: function () { return copieAuto('quotidienne'); }, copies: listerCopies,
    chercher: chercher, preferences: function () { return Object.assign({}, prefs); },
    erreur: function (m, d) { noterErreur('logiciel', m, d); }, rapport: rapportErreurs,
    surChangement: null
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
