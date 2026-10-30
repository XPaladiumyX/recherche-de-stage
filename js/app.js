/* Tech Vaucanson — annuaire + suivi de prospection stage/alternance */
(() => {
  'use strict';

  const COMPANIES = Array.isArray(window.ENTREPRISES) ? window.ENTREPRISES : [];
  const LYCE = { lat: 45.172245, lon: 5.708461, nom: 'Lycée Vaucanson', adresse: '27 rue Anatole France, 38100 Grenoble' };
  const TRACK_KEY = 'tech-vaucanson-tracking-v1';
  const THEME_KEY = 'tech-vaucanson-theme';

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const STATUS = {
    todo: 'À contacter',
    contacted: 'Contacté',
    followup: 'Relancé',
    replied: 'Réponse reçue',
    interview: 'Entretien',
    stage: 'Stage / alternance obtenu',
    refused: 'Refus',
  };
  const PRIORITY = { fort: 'Forte', moyen: 'Moyenne', faible: 'Faible' };

  const state = {
    search: '',
    category: 'all',
    city: 'all',
    distance: 30,
    sort: 'distance',
    view: 'cards',
    chip: 'all',
    visible: 60,
    tracking: loadTracking(),
  };
  const PAGE_SIZE = 60;

  function loadTracking() {
    try { return JSON.parse(localStorage.getItem(TRACK_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveTracking() {
    try { localStorage.setItem(TRACK_KEY, JSON.stringify(state.tracking)); } catch (e) {}
  }

  const iconFor = (category) => {
    const c = (category || '').toLowerCase();
    if (c.includes('cyber')) return '🛡️';
    if (c.includes('data') || c.includes('ia')) return '📊';
    if (c.includes('logiciel') || c.includes('web')) return '💻';
    if (c.includes('télécom') || c.includes('telecom') || c.includes('réseau') || c.includes('reseau')) return '📡';
    if (c.includes('électronique') || c.includes('electronique')) return '🔌';
    if (c.includes('automatisme') || c.includes('domotique')) return '🤖';
    if (c.includes('hébergement') || c.includes('hebergement') || c.includes('cloud')) return '☁️';
    if (c.includes('réparation') || c.includes('reparation')) return '🔧';
    if (c.includes('recherche')) return '🔬';
    if (c.includes('audiovisuel')) return '🎬';
    if (c.includes('vente')) return '🖥️';
    return '🏢';
  };

  const phoneHref = (p) => 'tel:' + String(p || '').replace(/[^0-9+]/g, '');
  const mapsHref = (c) => 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(`${c.adresse}, ${c.code_postal} ${c.ville}`);
  const displayDistance = (d) => (d < 1 ? Math.round(d * 1000) + ' m' : d.toFixed(1).replace('.', ',') + ' km');
  const siteLabel = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'Site web'; } };

  function matchesSearch(c, q) {
    if (!q) return true;
    const hay = [c.nom, c.nom_legal, c.categorie, c.famille, c.description, c.adresse, c.code_postal, c.ville, c.telephone, c.email, c.naf, c.naf_libelle, c.contact, c.sources ? c.sources.map(s => s.label).join(' ') : ''].join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).every(term => hay.includes(term));
  }

  function statusOf(c) { return (state.tracking[c.id] && state.tracking[c.id].status) || 'todo'; }

  function isComplete(c) { return !!(c.telephone && c.email); }
  function isVerified(c) { return !!(c.verification && c.verification.legal === 'verifie' && c.verification.adresse === 'verifie'); }

  function filtered() {
    let list = COMPANIES.filter(c => {
      if (!matchesSearch(c, state.search)) return false;
      if (state.category !== 'all' && (c.famille || c.categorie) !== state.category) return false;
      if (state.city !== 'all' && c.ville !== state.city) return false;
      if (Number(c.distance_km) > Number(state.distance)) return false;
      if (state.chip === 'contact' && !(c.telephone || c.email)) return false;
      if (state.chip === 'nocontact' && (c.telephone || c.email)) return false;
      if (state.chip === 'priority' && c.potentiel !== 'fort') return false;
      if (state.chip === 'verified' && !isComplete(c)) return false;
      if (state.chip === 'todo' && statusOf(c) !== 'todo') return false;
      if (state.chip === 'done' && statusOf(c) !== 'stage') return false;
      return true;
    });
    const prio = { fort: 0, moyen: 1, faible: 2 };
    switch (state.sort) {
      case 'name': list.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')); break;
      case 'category': list.sort((a, b) => (a.famille || a.categorie).localeCompare(b.famille || b.categorie, 'fr') || a.nom.localeCompare(b.nom, 'fr')); break;
      case 'city': list.sort((a, b) => a.ville.localeCompare(b.ville, 'fr') || a.nom.localeCompare(b.nom, 'fr')); break;
      case 'priority': list.sort((a, b) => (prio[a.potentiel] ?? 9) - (prio[b.potentiel] ?? 9) || a.distance_km - b.distance_km); break;
      default: list.sort((a, b) => a.distance_km - b.distance_km || a.nom.localeCompare(b.nom, 'fr'));
    }
    return list;
  }

  function renderStats() {
    const animate = window.TVAnimations ? window.TVAnimations.animateCount : (el, value) => { if (el) el.textContent = value; };
    animate($('statTotal'), COMPANIES.length);
    animate($('stat5'), COMPANIES.filter(c => c.distance_km <= 5).length);
    animate($('stat10'), COMPANIES.filter(c => c.distance_km <= 10).length);
    animate($('statPhone'), COMPANIES.filter(c => c.telephone).length);
    animate($('statEmail'), COMPANIES.filter(c => c.email).length);
    animate($('statSite'), COMPANIES.filter(c => c.site_web).length);
    $('totalCount').textContent = COMPANIES.length;
    if ($('heroCount')) $('heroCount').textContent = `${COMPANIES.length} entreprises vérifiées`;
    if ($('footerTotal')) $('footerTotal').textContent = COMPANIES.length;
    if ($('lastUpdate') && window.DATA_META && window.DATA_META.date) $('lastUpdate').textContent = window.DATA_META.date;
  }

  function renderFilters() {
    const catSel = $('categoryFilter');
    const familyOrder = ['ESN / Conseil', 'Logiciel / Web', 'Data / IA', 'Cybersécurité', 'Cloud / Hébergement', 'Télécoms / Réseaux', 'Électronique / Hardware', 'Automatisme / Industrie', 'Réparation / SAV', 'Vente / Matériel IT', 'Audiovisuel / Multimédia', 'Recherche / Tech', 'Autre tech'];
    const cats = [...new Set(COMPANIES.map(c => c.famille || c.categorie))].sort((a, b) => {
      const ia = familyOrder.indexOf(a), ib = familyOrder.indexOf(b);
      if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      return a.localeCompare(b, 'fr');
    });
    catSel.innerHTML = '<option value="all">Toutes les familles</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    const citySel = $('cityFilter');
    const cities = [...new Set(COMPANIES.map(c => c.ville))].sort((a, b) => a.localeCompare(b, 'fr'));
    citySel.innerHTML = '<option value="all">Toutes les villes</option>' + cities.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('chipAll').textContent = COMPANIES.length;
    $('chipContact').textContent = COMPANIES.filter(c => c.telephone || c.email).length;
    $('chipNoContact').textContent = COMPANIES.filter(c => !(c.telephone || c.email)).length;
    $('chipPriority').textContent = COMPANIES.filter(c => c.potentiel === 'fort').length;
    $('chipVerified').textContent = COMPANIES.filter(isComplete).length;
    $('chipTodo').textContent = COMPANIES.filter(c => statusOf(c) === 'todo').length;
    $('chipDone').textContent = COMPANIES.filter(c => statusOf(c) === 'stage').length;
  }

  function badgeVerification(c) {
    const v = c.verification || {};
    if (v.legal === 'verifie' && v.adresse === 'verifie') return '<span class="badge badge-verified">INSEE ✓</span>';
    return '<span class="badge badge-partial">À vérifier</span>';
  }
  function badgeContacts(c) {
    if (c.telephone && c.email) return '<span class="badge badge-verified">Contacts complets</span>';
    if (c.telephone || c.email) return '<span class="badge badge-partial">Contact partiel</span>';
    return '<span class="badge badge-partial">Contact à trouver</span>';
  }
  function badgePriority(c) {
    if (c.potentiel !== 'fort') return '';
    return '<span class="badge badge-priority">Priorité forte</span>';
  }

  function stageSelect(c, compact = false) {
    const current = statusOf(c);
    return `<select class="stage-select" data-action="status" data-id="${esc(c.id)}" aria-label="Statut de suivi">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === current ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
  }

  function renderCard(c, index = 0) {
    const tel = c.telephone ? `<div class="meta-row"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l1.27-.76a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 15.67v1.25z"/></svg><a href="${phoneHref(c.telephone)}">${esc(c.telephone)}</a></div>` : '';
    const mail = c.email ? `<div class="meta-row"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,12 2,6"/></svg><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></div>` : '';
    const web = c.site_web ? `<div class="meta-row"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg><a href="${esc(c.site_web)}" target="_blank" rel="noopener">${esc(siteLabel(c.site_web))}</a></div>` : '';
    const careers = c.careers ? `<div class="meta-row"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg><a href="${esc(c.careers)}" target="_blank" rel="noopener">Page carrières</a></div>` : '';
    return `<article class="card" data-id="${esc(c.id)}" style="--i:${index % 12}">
      <div class="card-top">
        <div class="card-icon">${iconFor(c.famille || c.categorie)}</div>
        <div style="min-width:0">
          <div class="card-title">${esc(c.nom)}</div>
          <div class="card-cat">${esc(c.categorie)}${c.famille && c.famille !== c.categorie ? ` <span style="color:var(--text-3);font-weight:600">· ${esc(c.famille)}</span>` : ''}</div>
        </div>
        <div class="card-actions">
          <button class="icon-btn" data-action="open" data-id="${esc(c.id)}" title="Voir la fiche" aria-label="Voir la fiche">↗</button>
        </div>
      </div>
      <div class="card-desc">${esc(c.description || '')}</div>
      <div class="card-meta">
        <div class="meta-row"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg><span>${esc(c.adresse)}, ${esc(c.code_postal)} ${esc(c.ville)}</span></div>
        ${tel}${mail}${web}${careers}
      </div>
      <div class="card-bottom">
        <span class="dist-badge">${displayDistance(c.distance_km)}</span>
        ${badgeVerification(c)} ${badgeContacts(c)} ${badgePriority(c)}
        <div style="margin-left:auto">${stageSelect(c)}</div>
      </div>
    </article>`;
  }

  function renderTable(list) {
    const rows = list.map(c => `<tr>
      <td><div class="table-company"><span>${esc(c.nom)}</span><small>${esc(c.nom_legal || '')}</small></div></td>
      <td><div class="table-company"><span>${esc(c.famille || c.categorie)}</span><small>${esc(c.categorie)}</small></div></td>
      <td>${esc(c.ville)}</td>
      <td><span class="dist-badge">${displayDistance(c.distance_km)}</span></td>
      <td>${esc(c.adresse)}</td>
      <td>${c.telephone ? `<a href="${phoneHref(c.telephone)}">${esc(c.telephone)}</a>` : '<span style="color:var(--text-3)">—</span>'}</td>
      <td>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '<span style="color:var(--text-3)">—</span>'}</td>
      <td>${c.site_web ? `<a href="${esc(c.site_web)}" target="_blank" rel="noopener">${esc(siteLabel(c.site_web))}</a>` : '<span style="color:var(--text-3)">—</span>'}</td>
      <td>${c.potentiel === 'fort' ? '<span class="badge badge-priority">Forte</span>' : esc(PRIORITY[c.potentiel] || '—')}</td>
      <td>${stageSelect(c, true)}</td>
      <td><button class="btn btn-soft" style="padding:5px 9px;font-size:.7rem" data-action="open" data-id="${esc(c.id)}">Fiche</button></td>
    </tr>`).join('');
    return `<div class="table-wrap"><table><thead><tr>
      <th data-sort="name">Entreprise</th><th data-sort="category">Catégorie</th><th data-sort="city">Ville</th><th data-sort="distance">Distance</th><th>Adresse</th><th>Téléphone</th><th>Email</th><th>Site</th><th data-sort="priority">Priorité</th><th>Suivi</th><th></th>
    </tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  function renderResults(list) {
    $('resultCount').textContent = list.length;
    const el = $('resultsContainer');
    if (!list.length) {
      el.innerHTML = `<div class="no-results"><strong>Aucune entreprise ne correspond.</strong>Essayez d'élargir la distance ou de retirer un filtre.</div>`;
      return;
    }
    if (state.view === 'table') {
      el.innerHTML = renderTable(list);
      return;
    }
    const shown = list.slice(0, state.visible);
    const more = list.length - shown.length;
    el.innerHTML = `<div class="cards-grid">${shown.map((c, index) => renderCard(c, index)).join('')}</div>` +
      (more > 0 ? `<div class="load-more"><button class="btn btn-ghost" type="button" data-action="more">Afficher les ${Math.min(PAGE_SIZE, more)} suivantes <span class="count">(${shown.length}/${list.length})</span></button></div>` : '');
  }

  /* ---------- Map ---------- */
  let map = null;
  let markersLayer = null;
  let mapFitted = false;

  function initMap() {
    const el = $('map');
    if (typeof L === 'undefined') {
      el.innerHTML = '<div style="padding:30px;text-align:center;color:var(--text-3)">La carte nécessite une connexion internet (Leaflet / OpenStreetMap). Le reste du site fonctionne hors ligne.</div>';
      return;
    }
    map = L.map('map', { scrollWheelZoom: false, zoomControl: true }).setView([LYCE.lat, LYCE.lon], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markersLayer = (L.markerClusterGroup ? L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 42, spiderfyOnMaxZoom: true }) : L.layerGroup()).addTo(map);
    L.circle([LYCE.lat, LYCE.lon], { radius: 10000, color: '#0d9488', weight: 1, dashArray: '4 6', fillColor: '#0d9488', fillOpacity: .04 }).addTo(map);
    L.marker([LYCE.lat, LYCE.lon], {
      icon: L.divIcon({ className: '', html: '<div style="background:#7c3aed;color:#fff;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:16px;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.35)">🎓</div>', iconSize: [34, 34], iconAnchor: [17, 17] }),
      zIndexOffset: 1000,
    }).addTo(map).bindPopup(`<div class="popup-title">Lycée Vaucanson</div><div class="popup-meta">${esc(LYCE.adresse)}</div>`);
  }

  function renderMap(list) {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();
    list.forEach(c => {
      if (typeof c.lat !== 'number' || typeof c.lon !== 'number') return;
      const m = L.marker([c.lat, c.lon]).addTo(markersLayer);
      m.bindPopup(`<div class="popup-title">${esc(c.nom)}</div><div class="popup-meta">${esc(c.categorie)} · ${displayDistance(c.distance_km)}<br>${esc(c.adresse)}, ${esc(c.code_postal)} ${esc(c.ville)}</div><a class="popup-link" href="#" onclick="window.openCompany('${esc(c.id)}');return false;">Voir la fiche →</a>`);
    });
    if (!mapFitted && list.length) {
      const pts = list.filter(c => typeof c.lat === 'number').map(c => [c.lat, c.lon]);
      pts.push([LYCE.lat, LYCE.lon]);
      map.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
      mapFitted = true;
    }
  }

  function fitMap() {
    if (!map) return;
    const list = filtered();
    const pts = list.filter(c => typeof c.lat === 'number').map(c => [c.lat, c.lon]);
    pts.push([LYCE.lat, LYCE.lon]);
    if (pts.length) map.fitBounds(pts, { padding: [30, 30], maxZoom: 13 });
  }

  /* ---------- Modal ---------- */
  function verificationLabel(field, value) {
    if (value === 'verifie') return '<span class="badge badge-verified">Vérifié</span>';
    if (value === 'site_officiel') return '<span class="badge badge-verified">Site officiel</span>';
    if (value === 'source_initiale') return '<span class="badge badge-partial">Source initiale</span>';
    if (value === 'a_verifier') return '<span class="badge badge-partial">À vérifier</span>';
    return '<span class="badge badge-source">Non renseigné</span>';
  }

  function renderModal(c) {
    const t = state.tracking[c.id] || {};
    $('modalIcon').textContent = iconFor(c.famille || c.categorie);
    $('modalTitle').textContent = c.nom;
    $('modalSub').textContent = `${c.categorie}${c.famille && c.famille !== c.categorie ? ` · ${c.famille}` : ''} · ${displayDistance(c.distance_km)} du lycée Vaucanson`;
    const src = (c.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)} ↗</a>`).join('');
    const v = c.verification || {};
    $('modalBody').innerHTML = `
      <p class="modal-desc">${esc(c.description || '')}</p>
      <div class="modal-grid">
        <div class="info-box"><div class="info-label">Adresse</div><div class="info-value">${esc(c.adresse)}<br>${esc(c.code_postal)} ${esc(c.ville)}</div></div>
        <div class="info-box"><div class="info-label">Distance</div><div class="info-value mono">${displayDistance(c.distance_km)} · à vol d'oiseau</div></div>
        <div class="info-box"><div class="info-label">Téléphone</div><div class="info-value mono">${c.telephone ? `<a href="${phoneHref(c.telephone)}">${esc(c.telephone)}</a>` : '—'}</div></div>
        <div class="info-box"><div class="info-label">Email</div><div class="info-value">${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</div></div>
        <div class="info-box"><div class="info-label">Site web</div><div class="info-value">${c.site_web ? `<a href="${esc(c.site_web)}" target="_blank" rel="noopener">${esc(siteLabel(c.site_web))} ↗</a>` : '—'}</div></div>
        <div class="info-box"><div class="info-label">Page carrières</div><div class="info-value">${c.careers ? `<a href="${esc(c.careers)}" target="_blank" rel="noopener">Ouvrir ↗</a>` : '—'}</div></div>
        <div class="info-box"><div class="info-label">Famille</div><div class="info-value">${esc(c.famille || c.categorie)}</div></div>
        <div class="info-box"><div class="info-label">SIREN</div><div class="info-value mono">${esc(c.siren)}</div></div>
        <div class="info-box"><div class="info-label">Activité (NAF)</div><div class="info-value"><span class="mono">${esc(c.naf || '—')}</span>${c.naf_libelle ? `<br><span style="font-weight:500;color:var(--text-2);font-size:.76rem">${esc(c.naf_libelle)}</span>` : ''}</div></div>
        <div class="info-box"><div class="info-label">Effectif du site</div><div class="info-value">${esc(c.effectif || 'Non renseigné')}</div></div>
        <div class="info-box"><div class="info-label">Création</div><div class="info-value">${esc(c.creation || '—')}</div></div>
      </div>
      <div>
        <div class="info-label" style="margin-bottom:5px">Vérification des données</div>
        <div class="verify-list">
          <span class="badge badge-source">Existence légale</span>${verificationLabel('legal', v.legal)}
          <span class="badge badge-source">Adresse</span>${verificationLabel('adresse', v.adresse)}
          <span class="badge badge-source">Téléphone</span>${verificationLabel('telephone', v.telephone)}
          <span class="badge badge-source">Email</span>${verificationLabel('email', v.email)}
          <span class="badge badge-source">Site</span>${verificationLabel('site', v.site)}
        </div>
        ${c.contact ? `<p style="font-size:.75rem;color:var(--text-3);margin-top:7px">Contact indiqué dans le fichier initial : <strong>${esc(c.contact)}</strong></p>` : ''}
      </div>
      <div>
        <div class="info-label" style="margin-bottom:5px">Sources</div>
        <div class="source-list">${src || '<span style="color:var(--text-3);font-size:.78rem">Aucune source renseignée.</span>'}</div>
      </div>
      <div class="modal-actions">
        ${c.telephone ? `<a class="btn btn-soft" href="${phoneHref(c.telephone)}">📞 Appeler</a>` : ''}
        ${c.email ? `<a class="btn btn-soft" href="mailto:${esc(c.email)}">✉️ Écrire</a>` : ''}
        ${c.site_web ? `<a class="btn btn-ghost" href="${esc(c.site_web)}" target="_blank" rel="noopener">Site ↗</a>` : `<a class="btn btn-ghost" href="https://www.google.com/search?q=${encodeURIComponent(c.nom + ' ' + c.ville + ' site officiel')}" target="_blank" rel="noopener">Chercher le site ↗</a>`}
        ${c.careers ? `<a class="btn btn-ghost" href="${esc(c.careers)}" target="_blank" rel="noopener">Carrières ↗</a>` : ''}
        <a class="btn btn-ghost" href="https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(c.nom + ' ' + c.ville)}" target="_blank" rel="noopener">LinkedIn ↗</a>
        <a class="btn btn-ghost" href="${mapsHref(c)}" target="_blank" rel="noopener">Itinéraire ↗</a>
        ${c.email ? `<button class="btn btn-ghost" data-action="copy-email" data-email="${esc(c.email)}">Copier l'email</button>` : ''}
      </div>
      <div class="tracking">
        <h3>Suivi de la prise de contact</h3>
        <div class="form-row">
          <label>Statut
            <select id="trackStatus">${Object.entries(STATUS).map(([k, val]) => `<option value="${k}"${(t.status || 'todo') === k ? ' selected' : ''}>${esc(val)}</option>`).join('')}</select>
          </label>
          <label>Dernière action
            <input type="date" id="trackDate" value="${esc(t.updatedAt || new Date().toISOString().slice(0, 10))}">
          </label>
        </div>
        <div class="form-row">
          <label style="grid-column:1/-1">Notes
            <textarea id="trackNotes" placeholder="Ex. : email envoyé le 12/11, relance prévue le 19/11, contact RH…">${esc(t.notes || '')}</textarea>
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" data-action="save-tracking" data-id="${esc(c.id)}">Enregistrer le suivi</button>
          ${t.status ? `<button class="btn btn-danger" data-action="clear-tracking" data-id="${esc(c.id)}">Effacer le suivi</button>` : ''}
        </div>
      </div>`;
  }

  function openModal(id) {
    const c = COMPANIES.find(x => x.id === id);
    if (!c) return;
    renderModal(c);
    $('modalOverlay').classList.add('open');
    $('modalOverlay').setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    $('modalOverlay').classList.remove('open');
    $('modalOverlay').setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  /* ---------- Render global ---------- */
  function render() {
    const list = filtered();
    renderResults(list);
    renderMap(list);
    renderStats();
    $('resultCount').textContent = list.length;
    $('chipTodo').textContent = COMPANIES.filter(c => statusOf(c) === 'todo').length;
    $('chipDone').textContent = COMPANIES.filter(c => statusOf(c) === 'stage').length;
    document.querySelectorAll('.chip').forEach(ch => ch.classList.toggle('active', ch.dataset.filter === state.chip));
  }

  /* ---------- Events ---------- */
  let searchTimer = null;
  $('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { state.search = e.target.value.trim(); state.visible = PAGE_SIZE; render(); }, 120);
  });
  $('categoryFilter').addEventListener('change', (e) => { state.category = e.target.value; state.visible = PAGE_SIZE; render(); });
  $('cityFilter').addEventListener('change', (e) => { state.city = e.target.value; state.visible = PAGE_SIZE; render(); });
  $('distanceFilter').addEventListener('change', (e) => { state.distance = Number(e.target.value); state.visible = PAGE_SIZE; render(); });
  $('sortFilter').addEventListener('change', (e) => { state.sort = e.target.value; state.visible = PAGE_SIZE; render(); });
  $('filterChips').addEventListener('click', (e) => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    state.chip = btn.dataset.filter; state.visible = PAGE_SIZE; render();
  });
  document.querySelectorAll('.view-btn').forEach(btn => btn.addEventListener('click', () => {
    state.view = btn.dataset.view; state.visible = PAGE_SIZE;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.toggle('active', b === btn));
    render();
  }));
  $('resultsContainer').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (btn && btn.dataset.action === 'open') { openModal(btn.dataset.id); return; }
    if (btn && btn.dataset.action === 'more') { state.visible += PAGE_SIZE; render(); return; }
    const th = e.target.closest('th[data-sort]');
    if (th) {
      const map = { name: 'name', category: 'category', city: 'city', distance: 'distance', priority: 'priority' };
      const key = map[th.dataset.sort];
      if (key) { state.sort = key; $('sortFilter').value = key; state.visible = PAGE_SIZE; render(); }
    }
  });
  $('resultsContainer').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-action="status"]');
    if (!sel) return;
    const id = sel.dataset.id;
    if (!state.tracking[id]) state.tracking[id] = {};
    state.tracking[id].status = sel.value;
    state.tracking[id].updatedAt = new Date().toISOString().slice(0, 10);
    saveTracking(); render();
  });
  $('modalOverlay').addEventListener('click', (e) => {
    if (e.target === $('modalOverlay')) closeModal();
    const copy = e.target.closest('[data-action="copy-email"]');
    if (copy) {
      navigator.clipboard.writeText(copy.dataset.email).then(() => toast('Email copié !')).catch(() => toast('Copie impossible'));
    }
    const save = e.target.closest('[data-action="save-tracking"]');
    if (save) {
      const id = save.dataset.id;
      const status = $('trackStatus').value;
      const notes = $('trackNotes').value.trim();
      const date = $('trackDate').value;
      state.tracking[id] = { status, notes, updatedAt: date };
      saveTracking(); render(); renderModal(COMPANIES.find(x => x.id === id)); toast('Suivi enregistré');
    }
    const clear = e.target.closest('[data-action="clear-tracking"]');
    if (clear) {
      delete state.tracking[clear.dataset.id]; saveTracking(); render(); closeModal(); toast('Suivi effacé');
    }
  });
  $('modalClose').addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  $('fitMapBtn').addEventListener('click', fitMap);

  /* ---------- Theme ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $('themeToggle').textContent = theme === 'dark' ? '☀' : '☾';
    localStorage.setItem(THEME_KEY, theme);
  }
  $('themeToggle').addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    if (map) setTimeout(() => map.invalidateSize(), 50);
  });
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');

  /* ---------- CSV ---------- */
  function csvEscape(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
  function exportCsv() {
    const list = filtered();
    const headers = ['Nom', 'Famille', 'Catégorie', 'Adresse', 'Code postal', 'Ville', 'Distance km', 'Téléphone', 'Email', 'Site web', 'SIREN', 'NAF', 'Priorité', 'Statut suivi', 'Notes', 'Dernière action'];
    const rows = list.map(c => {
      const t = state.tracking[c.id] || {};
      return [c.nom, c.famille || '', c.categorie, c.adresse, c.code_postal, c.ville, c.distance_km, c.telephone, c.email, c.site_web, c.siren, c.naf, PRIORITY[c.potentiel] || '', STATUS[t.status || 'todo'], t.notes || '', t.updatedAt || ''].map(csvEscape).join(';');
    });
    const csv = '\ufeff' + headers.map(csvEscape).join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'entreprises-tech-vaucanson-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Export CSV généré');
  }
  $('exportCsvFooter').addEventListener('click', (e) => { e.preventDefault(); exportCsv(); });
  $('resetTrackingFooter').addEventListener('click', (e) => {
    e.preventDefault();
    if (!confirm('Réinitialiser tout le suivi de prospection ?')) return;
    state.tracking = {}; saveTracking(); render(); toast('Suivi réinitialisé');
  });

  /* ---------- Toast ---------- */
  let toastTimer = null;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  /* ---------- Détection du serveur d'envoi local ---------- */
  const MAIL_API = (() => {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return local && location.port === '3001' ? '' : 'http://127.0.0.1:3001';
  })();
  async function detectMailServer() {
    const dot = $('serverDot');
    if (!dot) return;
    if (location.hostname.endsWith('github.io')) {
      dot.classList.remove('online');
      dot.title = 'Détection impossible depuis GitHub Pages — ouvre http://localhost:3001/campagne.html';
      return;
    }
    try {
      const res = await fetch(MAIL_API + '/api/health', { signal: AbortSignal.timeout(1800), cache: 'no-store' });
      if (!res.ok) throw new Error('offline');
      const health = await res.json();
      dot.classList.add('online');
      dot.title = health.dryRun ? 'Serveur local connecté (mode simulation)' : 'Serveur local connecté — envoi de mails actif';
    } catch {
      dot.classList.remove('online');
      dot.title = location.hostname.endsWith('github.io')
        ? 'Détection impossible depuis GitHub Pages — ouvre http://localhost:3001/campagne.html'
        : 'Serveur local non détecté — ouvre la page Campagne pour les instructions';
    }
  }

  /* ---------- Boot ---------- */
  window.openCompany = openModal;
  detectMailServer();
  initMap();
  renderFilters();
  renderStats();
  render();
  if (!COMPANIES.length) {
    $('resultsContainer').innerHTML = '<div class="no-results"><strong>Aucune donnée chargée.</strong>Vérifiez que js/data.js est bien présent.</div>';
  }
})();
