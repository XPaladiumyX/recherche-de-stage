/* Tech Vaucanson — campagne d'envoi locale */
(() => {
  'use strict';

  const COMPANIES = Array.isArray(window.ENTREPRISES) ? window.ENTREPRISES : [];
  const THEME_KEY = 'tech-vaucanson-theme';
  const LOCAL_PORT = '3001';
  const API = (() => {
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    return local && location.port === LOCAL_PORT ? '' : 'http://127.0.0.1:3001';
  })();

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const state = {
    health: null,
    config: null,
    templates: [],
    currentTemplateId: null,
    attachments: [],
    history: [],
    stop: [],
    available: [],
    selected: new Set(),
    companyByEmail: new Map(),
    lastSentByEmail: new Map(),
    testDone: false,
    campaign: null,
    pollTimer: null,
    retryTimer: null,
    tab: 'message',
  };

  const SAMPLE = {
    siren: '000000000',
    nom: 'Entreprise exemple',
    email: 'exemple@entreprise.fr',
    contact: 'Madame, Monsieur',
    ville: 'Grenoble',
    famille: 'Logiciel / Web',
    distance_km: 2.4,
  };

  function toast(message, isError = false) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    el.style.background = isError ? 'var(--danger)' : '';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  async function api(path, options = {}) {
    const opts = { method: options.method || 'GET', headers: { ...(options.headers || {}) } };
    if (options.body instanceof FormData) opts.body = options.body;
    else if (options.body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(options.body);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 20000);
    opts.signal = controller.signal;
    try {
      const res = await fetch(API + path, opts);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erreur HTTP ${res.status}`);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  const validEmail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(v || '').trim());
  const displayDistance = (d) => (Number.isFinite(Number(d)) ? `${Number(d).toFixed(1).replace('.', ',')} km` : '—');
  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  };
  const formatBytes = (bytes) => {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} o`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
    return `${(n / 1024 / 1024).toFixed(1)} Mo`;
  };

  function signatureFor(sender = {}) {
    if (sender.signature && String(sender.signature).trim()) return String(sender.signature).trim();
    const lines = [];
    const name = [sender.prenom, sender.nom].filter(Boolean).join(' ');
    if (name) lines.push(name);
    if (sender.formation || sender.etablissement) lines.push([sender.formation, sender.etablissement].filter(Boolean).join(' — '));
    const contact = [sender.telephone, sender.email, sender.linkedin].filter(Boolean).join(' · ');
    if (contact) lines.push(contact);
    return lines.join('\n');
  }

  function greeting(recipient = {}) {
    const contact = String(recipient.contact || '').trim();
    if (!contact) return 'Madame, Monsieur';
    if (/^(m\.|mme|mr|mrs|monsieur|madame)/i.test(contact)) return contact;
    return contact;
  }

  function renderLocal(template, recipient = SAMPLE, sender = {}) {
    const distance = Number(recipient.distance_km);
    const values = {
      entreprise: recipient.nom || 'votre entreprise',
      contact: greeting(recipient),
      ville: recipient.ville || 'Grenoble',
      famille: recipient.famille || 'le numérique',
      distance: Number.isFinite(distance) ? `${distance.toFixed(1).replace('.', ',')} km` : '',
      prenom: sender.prenom || '',
      nom: sender.nom || '',
      formation: sender.formation || '',
      etablissement: sender.etablissement || '',
      telephone: sender.telephone || '',
      email: sender.email || '',
      linkedin: sender.linkedin || '',
      signature: signatureFor(sender),
      date: new Date().toLocaleDateString('fr-FR'),
    };
    const replace = (value) => String(value || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? '');
    let text = replace(template.body);
    if (!/\bSTOP\b/i.test(text)) text += `\n\n--\nSi vous ne souhaitez plus recevoir de messages de ma part, répondez simplement « STOP ».`;
    return { subject: replace(template.subject).replace(/[\r\n]+/g, ' ').trim(), text };
  }

  /* ---------- Thème ---------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $('themeToggle').textContent = theme === 'dark' ? '☀' : '☾';
    localStorage.setItem(THEME_KEY, theme);
  }
  $('themeToggle').addEventListener('click', () => {
    applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');

  /* ---------- Détection serveur ---------- */
  function setServerOnline(health) {
    state.health = health;
    clearTimeout(state.retryTimer);
    $('serverStatus').className = 'status-banner online';
    $('serverStatusIcon').textContent = '✓';
    $('serverStatusTitle').textContent = 'Serveur local connecté';
    $('serverStatusText').textContent = health.dryRun
      ? 'Mode simulation : aucun mail réel ne sera envoyé. Passe DRY_RUN=false dans server/.env pour activer l’envoi réel.'
      : `SMTP ${health.provider} · ${health.fromEmail || 'adresse d’envoi à vérifier'} · ${health.remainingToday} mail(s) restant(s) aujourd’hui.`;
    $('serverDot').classList.add('online');
    $('serverDot').title = health.dryRun ? 'Serveur local connecté (simulation)' : 'Serveur local connecté';
    $('setupCard').hidden = true;
    $('campaignShell').hidden = false;
    refreshAll();
  }

  function setServerOffline() {
    state.health = null;
    const fromGithubPages = location.hostname.endsWith('github.io');
    $('serverStatus').className = 'status-banner offline';
    $('serverStatusIcon').textContent = '!';
    $('serverStatusTitle').textContent = fromGithubPages ? 'Ouvre la version locale pour envoyer' : 'Serveur local non détecté';
    $('serverStatusText').innerHTML = fromGithubPages
      ? 'Le navigateur bloque la détection du serveur local depuis GitHub Pages. Ouvre <a href="http://localhost:3001/campagne.html">http://localhost:3001/campagne.html</a> pour activer l’envoi.'
      : 'Lance le serveur sur ton PC pour activer l’envoi. Les instructions sont juste en dessous.';
    $('serverDot').classList.remove('online');
    $('serverDot').title = fromGithubPages ? 'Détection impossible depuis GitHub Pages — ouvre localhost:3001' : 'Serveur local non détecté';
    $('setupCard').hidden = false;
    $('campaignShell').hidden = true;
    clearTimeout(state.retryTimer);
    state.retryTimer = setTimeout(checkServer, 8000);
  }

  async function checkServer() {
    try {
      const res = await fetch(API + '/api/health', { cache: 'no-store', signal: AbortSignal.timeout(2200) });
      if (!res.ok) throw new Error('offline');
      setServerOnline(await res.json());
    } catch {
      setServerOffline();
    }
  }

  /* ---------- Chargement ---------- */
  async function refreshAll() {
    await Promise.allSettled([loadConfig(), loadTemplates(), loadAttachments(), loadHistory(), loadStopList()]);
    buildRecipients();
    updateSendSummary();
  }

  async function loadConfig() {
    const data = await api('/api/config');
    state.config = data;
    const sender = data.sender || {};
    $('senderPrenom').value = sender.prenom || '';
    $('senderNom').value = sender.nom || '';
    $('senderFormation').value = sender.formation || '';
    $('senderEtablissement').value = sender.etablissement || '';
    $('senderTelephone').value = sender.telephone || '';
    $('senderEmail').value = sender.email || '';
    $('senderLinkedin').value = sender.linkedin || '';
    $('senderSignature').value = sender.signature || '';
    $('settingsMaxPerDay').value = data.settings?.maxPerDay || 40;
    $('settingsDelayMin').value = data.settings?.delayMinSeconds || 45;
    $('settingsDelayMax').value = data.settings?.delayMaxSeconds || 90;
    $('testEmail').value = sender.email || data.smtp?.fromEmail || '';
    $('smtpMode').textContent = data.smtp?.dryRun ? 'Simulation' : 'Envoi réel';
    $('smtpProvider').textContent = data.smtp?.provider || '—';
    $('smtpFrom').textContent = data.smtp?.fromEmail || '—';
    $('smtpConnection').innerHTML = data.smtp?.smtpReady
      ? '<span class="badge badge-ok">Connecté</span>'
      : `<span class="badge badge-bad">${esc(data.smtp?.message || 'Non vérifié')}</span>`;
  }

  async function loadTemplates() {
    const data = await api('/api/templates');
    state.templates = data.templates || [];
    if (!state.currentTemplateId || !state.templates.some((t) => t.id === state.currentTemplateId)) {
      state.currentTemplateId = state.templates[0]?.id || null;
    }
    renderTemplateList();
    selectTemplate(state.currentTemplateId, false);
  }

  async function loadAttachments() {
    const data = await api('/api/attachments');
    state.attachments = data.attachments || [];
    renderAttachments();
  }

  async function loadHistory() {
    const data = await api('/api/history?limit=500');
    state.history = data.history || [];
    renderHistory();
    buildRecipients();
  }

  async function loadStopList() {
    const data = await api('/api/stop-list');
    state.stop = data.emails || [];
    renderStopList();
  }

  /* ---------- Templates ---------- */
  function renderTemplateList() {
    const el = $('templateList');
    el.innerHTML = state.templates.map((t) => `<button class="template-chip${t.id === state.currentTemplateId ? ' active' : ''}" data-template="${esc(t.id)}" type="button">${esc(t.name)}</button>`).join('');
    el.querySelectorAll('[data-template]').forEach((btn) => btn.addEventListener('click', () => selectTemplate(btn.dataset.template)));
    updateSendSummary();
  }

  function selectTemplate(id, showToast = false) {
    const template = state.templates.find((t) => t.id === id);
    if (!template) return;
    state.currentTemplateId = template.id;
    $('templateName').value = template.name;
    $('templateSubject').value = template.subject;
    $('templateBody').value = template.body;
    $('templateStatus').textContent = '';
    renderTemplateList();
    renderTemplatePreview();
    state.testDone = false;
    updateSendSummary();
    if (showToast) toast('Modèle chargé');
  }

  function currentTemplateFromForm() {
    return {
      name: $('templateName').value.trim(),
      subject: $('templateSubject').value.trim(),
      body: $('templateBody').value.trim(),
    };
  }

  function renderTemplatePreview() {
    const form = currentTemplateFromForm();
    if (!form.subject && !form.body) return;
    const preview = renderLocal(form, state.selected.size ? companyForEmail([...state.selected][0]) : SAMPLE, state.config?.sender || {});
    $('previewSubject').textContent = preview.subject || 'Objet du mail…';
    $('previewBody').textContent = preview.text || 'Le texte du message apparaîtra ici.';
  }

  async function saveTemplate() {
    const form = currentTemplateFromForm();
    if (!form.name || !form.subject || !form.body) return toast('Nom, objet et message sont obligatoires.', true);
    try {
      if (state.currentTemplateId) {
        await api(`/api/templates/${encodeURIComponent(state.currentTemplateId)}`, { method: 'PUT', body: form });
      } else {
        const created = await api('/api/templates', { method: 'POST', body: form });
        state.currentTemplateId = created.template.id;
      }
      await loadTemplates();
      $('templateStatus').textContent = 'Enregistré ✓';
      toast('Modèle enregistré');
    } catch (error) { toast(error.message, true); }
  }

  $('templateNew').addEventListener('click', () => {
    state.currentTemplateId = null;
    $('templateName').value = 'Nouveau modèle';
    $('templateSubject').value = '';
    $('templateBody').value = '';
    $('templateStatus').textContent = 'Nouveau — enregistre pour créer';
    renderTemplateList();
    renderTemplatePreview();
  });
  $('templateDuplicate').addEventListener('click', () => {
    const form = currentTemplateFromForm();
    state.currentTemplateId = null;
    $('templateName').value = `${form.name || 'Modèle'} (copie)`;
    $('templateStatus').textContent = 'Copie — enregistre pour créer';
    renderTemplateList();
  });
  $('templateDelete').addEventListener('click', async () => {
    if (!state.currentTemplateId) return toast('Aucun modèle sélectionné.', true);
    if (!confirm('Supprimer ce modèle ? Les campagnes déjà envoyées ne sont pas affectées.')) return;
    try {
      await api(`/api/templates/${encodeURIComponent(state.currentTemplateId)}`, { method: 'DELETE' });
      state.currentTemplateId = null;
      await loadTemplates();
      toast('Modèle supprimé');
    } catch (error) { toast(error.message, true); }
  });
  $('templateSave').addEventListener('click', saveTemplate);
  $('templatePreview').addEventListener('click', renderTemplatePreview);
  $('templateBody').addEventListener('input', () => { state.testDone = false; renderTemplatePreview(); updateSendSummary(); });
  $('templateSubject').addEventListener('input', () => { state.testDone = false; renderTemplatePreview(); updateSendSummary(); });
  $('templateName').addEventListener('input', () => { state.testDone = false; updateSendSummary(); });
  document.querySelectorAll('.var-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const textarea = $('templateBody');
      const start = textarea.selectionStart || textarea.value.length;
      const end = textarea.selectionEnd || start;
      textarea.value = textarea.value.slice(0, start) + chip.dataset.var + textarea.value.slice(end);
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + chip.dataset.var.length;
      renderTemplatePreview();
    });
  });

  /* ---------- Réglages ---------- */
  async function saveSettings() {
    const payload = {
      sender: {
        prenom: $('senderPrenom').value,
        nom: $('senderNom').value,
        formation: $('senderFormation').value,
        etablissement: $('senderEtablissement').value,
        telephone: $('senderTelephone').value,
        email: $('senderEmail').value,
        linkedin: $('senderLinkedin').value,
        signature: $('senderSignature').value,
      },
      settings: {
        maxPerDay: Number($('settingsMaxPerDay').value || 40),
        delayMinSeconds: Number($('settingsDelayMin').value || 45),
        delayMaxSeconds: Number($('settingsDelayMax').value || 90),
      },
    };
    try {
      await api('/api/config', { method: 'PUT', body: payload });
      $('settingsStatus').textContent = 'Enregistré ✓';
      await loadConfig();
      await checkServer();
      renderTemplatePreview();
      toast('Réglages enregistrés');
    } catch (error) { toast(error.message, true); }
  }
  $('saveSettings').addEventListener('click', saveSettings);
  $('saveSettings2').addEventListener('click', saveSettings);

  /* ---------- Pièces jointes ---------- */
  function renderAttachments() {
    const el = $('attachmentList');
    if (!state.attachments.length) {
      el.innerHTML = '';
      $('attachmentHint').hidden = false;
      return;
    }
    $('attachmentHint').hidden = true;
    el.innerHTML = state.attachments.map((file) => `<div class="attachment-item">
      <div class="file-icon">📎</div>
      <div class="file-meta"><strong>${esc(file.name)}</strong><small>${formatBytes(file.size)} · ajouté le ${formatDate(file.uploadedAt)}</small></div>
      <a class="btn btn-ghost btn-sm" href="${API}/api/attachments/${encodeURIComponent(file.id)}/download" target="_blank" rel="noopener">Ouvrir</a>
      <button class="btn btn-danger-soft btn-sm" data-delete-file="${esc(file.id)}" type="button">Retirer</button>
    </div>`).join('');
    el.querySelectorAll('[data-delete-file]').forEach((btn) => btn.addEventListener('click', async () => {
      if (!confirm('Retirer ce fichier des prochaines campagnes ?')) return;
      try { await api(`/api/attachments/${encodeURIComponent(btn.dataset.deleteFile)}`, { method: 'DELETE' }); state.testDone = false; await loadAttachments(); updateSendSummary(); toast('Fichier retiré'); } catch (error) { toast(error.message, true); }
    }));
  }

  $('fileInput').addEventListener('change', async (event) => {
    const files = [...event.target.files];
    if (!files.length) return;
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    try {
      await api('/api/attachments', { method: 'POST', body: form, timeout: 60000 });
      state.testDone = false;
      await loadAttachments();
      updateSendSummary();
      toast(`${files.length} fichier(s) ajouté(s)`);
    } catch (error) { toast(error.message, true); }
    event.target.value = '';
  });

  /* ---------- Destinataires ---------- */
  function companyForEmail(email) {
    return state.companyByEmail.get(String(email).toLowerCase()) || null;
  }

  function populateFilters() {
    const withEmail = COMPANIES.filter((c) => validEmail(c.email));
    const families = [...new Set(withEmail.map((c) => c.famille || c.categorie).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const cities = [...new Set(withEmail.map((c) => c.ville).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const familySel = $('recipientFamily');
    const citySel = $('recipientCity');
    const oldFamily = familySel.value;
    const oldCity = citySel.value;
    familySel.innerHTML = '<option value="all">Toutes</option>' + families.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    citySel.innerHTML = '<option value="all">Toutes</option>' + cities.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    familySel.value = families.includes(oldFamily) ? oldFamily : 'all';
    citySel.value = cities.includes(oldCity) ? oldCity : 'all';
  }

  function buildRecipients() {
    populateFilters();
    const family = $('recipientFamily').value;
    const city = $('recipientCity').value;
    const maxDistance = Number($('recipientDistance').value || 30);
    const search = $('recipientSearch').value.trim().toLowerCase();
    const allowResend = $('recipientResend').checked;
    const stopSet = new Set(state.stop.map((item) => item.email));
    const sentSet = new Set(state.history.filter((item) => item.status === 'sent').map((item) => String(item.email).toLowerCase()));
    state.companyByEmail = new Map(COMPANIES.filter((c) => validEmail(c.email)).map((c) => [String(c.email).toLowerCase(), c]));
    state.lastSentByEmail = new Map();
    for (const item of state.history) {
      const email = String(item.email || '').toLowerCase();
      if (!state.lastSentByEmail.has(email)) state.lastSentByEmail.set(email, item.sentAt);
    }
    state.available = COMPANIES.filter((c) => {
      if (!validEmail(c.email)) return false;
      const email = String(c.email).toLowerCase();
      if (stopSet.has(email)) return false;
      if (!allowResend && sentSet.has(email)) return false;
      if (family !== 'all' && (c.famille || c.categorie) !== family) return false;
      if (city !== 'all' && c.ville !== city) return false;
      if (Number(c.distance_km) > maxDistance) return false;
      if (search) {
        const hay = [c.nom, c.email, c.ville, c.famille, c.categorie].join(' ').toLowerCase();
        if (!search.split(/\s+/).every((term) => hay.includes(term))) return false;
      }
      return true;
    }).sort((a, b) => Number(a.distance_km) - Number(b.distance_km) || a.nom.localeCompare(b.nom, 'fr'));
    for (const email of [...state.selected]) {
      if (!state.companyByEmail.has(email) || stopSet.has(email)) state.selected.delete(email);
    }
    renderRecipients();
    updateSelectionSummary();
  }

  function renderRecipients() {
    const body = $('recipientTableBody');
    const empty = $('recipientEmpty');
    if (!state.available.length) {
      body.innerHTML = '';
      empty.hidden = false;
    } else {
      empty.hidden = true;
      body.innerHTML = state.available.map((c) => {
        const email = String(c.email).toLowerCase();
        const last = state.lastSentByEmail.get(email);
        return `<tr>
          <td><input type="checkbox" data-recipient="${esc(email)}" ${state.selected.has(email) ? 'checked' : ''}></td>
          <td><strong>${esc(c.nom)}</strong><div class="muted">${esc(c.categorie || '')}</div></td>
          <td class="mail">${esc(c.email)}</td>
          <td>${esc(c.ville)}</td>
          <td>${esc(c.famille || c.categorie || '')}</td>
          <td>${displayDistance(c.distance_km)}</td>
          <td class="muted">${last ? formatDate(last) : '—'}</td>
        </tr>`;
      }).join('');
      body.querySelectorAll('[data-recipient]').forEach((checkbox) => {
        checkbox.addEventListener('change', () => {
          const email = checkbox.dataset.recipient;
          if (checkbox.checked) {
            if (state.selected.size >= remainingQuota()) {
              checkbox.checked = false;
              toast(`Quota restant aujourd’hui : ${remainingQuota()} mail(s).`, true);
              return;
            }
            state.selected.add(email);
          } else {
            state.selected.delete(email);
          }
          updateSelectionSummary();
          renderTemplatePreview();
          updateSendSummary();
        });
      });
    }
    $('tabRecipientCount').textContent = state.selected.size;
  }

  function remainingQuota() {
    return Math.max(0, Number(state.health?.remainingToday ?? 0));
  }

  function updateSelectionSummary() {
    $('selectedCount').textContent = state.selected.size;
    $('availableCount').textContent = state.available.length;
    $('remainingQuota').textContent = remainingQuota();
    $('tabRecipientCount').textContent = state.selected.size;
    updateSendSummary();
  }

  function selectVisible(limit) {
    let count = 0;
    for (const company of state.available) {
      if (count >= limit) break;
      state.selected.add(String(company.email).toLowerCase());
      count++;
    }
    renderRecipients();
    updateSelectionSummary();
  }

  $('recipientSearch').addEventListener('input', () => { buildRecipients(); });
  $('recipientFamily').addEventListener('change', buildRecipients);
  $('recipientCity').addEventListener('change', buildRecipients);
  $('recipientDistance').addEventListener('change', buildRecipients);
  $('recipientResend').addEventListener('change', buildRecipients);
  $('selectAll').addEventListener('click', () => selectVisible(remainingQuota()));
  $('selectFirst').addEventListener('click', () => selectVisible(Math.min(40, remainingQuota())));
  $('selectNone').addEventListener('click', () => { state.selected.clear(); renderRecipients(); updateSelectionSummary(); });

  /* ---------- Envoi ---------- */
  function selectedRecipients() {
    return [...state.selected].map(companyForEmail).filter(Boolean);
  }

  function updateSendSummary() {
    const template = state.templates.find((t) => t.id === state.currentTemplateId);
    $('sendTemplateName').textContent = template?.name || '—';
    $('sendRecipientCount').textContent = state.selected.size;
    $('sendAttachmentCount').textContent = state.attachments.length;
    $('sendQuota').textContent = remainingQuota();
    const canStart = !!template && state.selected.size > 0 && state.testDone && $('confirmCheck').checked && remainingQuota() > 0;
    $('startCampaign').disabled = !canStart;
    $('startHint').textContent = !template ? 'Choisis un modèle.' : state.selected.size === 0 ? 'Sélectionne au moins une entreprise.' : !state.testDone ? 'Fais d’abord un test réussi.' : !$('confirmCheck').checked ? 'Coche la confirmation.' : remainingQuota() <= 0 ? 'Quota quotidien atteint.' : 'Prêt à envoyer.';
    $('tabRecipientCount').textContent = state.selected.size;
  }

  $('confirmCheck').addEventListener('change', updateSendSummary);

  async function ensureTemplateSaved() {
    const existing = state.templates.find((t) => t.id === state.currentTemplateId);
    const form = currentTemplateFromForm();
    if (!existing || form.name !== existing.name || form.subject !== existing.subject || form.body !== existing.body) {
      await saveTemplate();
    }
    return state.templates.find((t) => t.id === state.currentTemplateId) || null;
  }

  $('testButton').addEventListener('click', async () => {
    let template = state.templates.find((t) => t.id === state.currentTemplateId);
    if (!template) return toast('Choisis un modèle.', true);
    try { template = await ensureTemplateSaved(); } catch {}
    if (!template) return toast('Enregistre d’abord le modèle.', true);
    const to = $('testEmail').value.trim() || state.config?.sender?.email || state.health?.fromEmail;
    if (!validEmail(to)) return toast('Renseigne ton adresse email de test dans les réglages.', true);
    const recipient = state.selected.size ? companyForEmail([...state.selected][0]) : SAMPLE;
    try {
      $('testResult').className = 'test-result show';
      $('testResult').textContent = 'Envoi du test…';
      const data = await api('/api/test-email', { method: 'POST', body: { templateId: template.id, attachmentIds: state.attachments.map((a) => a.id), to, recipient }, timeout: 60000 });
      const preview = renderLocal(template, recipient || SAMPLE, state.config?.sender || {});
      $('testResult').innerHTML = `<strong>${data.dryRun ? 'Test simulé (mode DRY_RUN)' : 'Test envoyé'} à ${esc(to)}</strong><div class="preview-subject" style="margin-top:7px">${esc(preview.subject)}</div><div class="preview-box" style="max-height:220px">${esc(preview.text)}</div>`;
      state.testDone = true;
      updateSendSummary();
      toast(data.dryRun ? 'Test simulé — pense à passer DRY_RUN=false' : 'Test envoyé, vérifie ta boîte mail');
    } catch (error) {
      $('testResult').className = 'test-result show';
      $('testResult').textContent = `Erreur : ${error.message}`;
      toast(error.message, true);
    }
  });

  $('startCampaign').addEventListener('click', async () => {
    let template = state.templates.find((t) => t.id === state.currentTemplateId);
    if (!template) return toast('Choisis un modèle.', true);
    try { template = await ensureTemplateSaved(); } catch {}
    if (!template) return toast('Enregistre d’abord le modèle.', true);
    if (!state.testDone) return toast('Fais d’abord un test réussi.', true);
    if (!$('confirmCheck').checked) return toast('Coche la confirmation.', true);
    const recipients = selectedRecipients();
    if (!recipients.length) return toast('Sélectionne au moins une entreprise.', true);
    if (!confirm(`Lancer la campagne pour ${recipients.length} entreprise(s) ?\n\nLes mails partiront progressivement avec un délai de ${state.config?.settings?.delayMinSeconds || 45} à ${state.config?.settings?.delayMaxSeconds || 90} secondes.`)) return;
    try {
      $('startCampaign').disabled = true;
      const data = await api('/api/campaigns', {
        method: 'POST',
        body: {
          name: $('campaignName').value.trim() || `Campagne ${new Date().toLocaleDateString('fr-FR')}`,
          templateId: template.id,
          attachmentIds: state.attachments.map((a) => a.id),
          recipients: recipients.map((c) => ({ siren: c.siren, nom: c.nom, email: c.email, contact: c.contact, ville: c.ville, famille: c.famille || c.categorie, distance_km: c.distance_km })),
          confirmed: true,
          allowResend: $('recipientResend').checked,
        },
        timeout: 60000,
      });
      if (data.truncated) toast(`Campagne limitée au quota restant : ${data.campaign.total} mail(s).`);
      else if (data.skippedStop || data.skippedAlreadySent) toast(`Destinataires ignorés : ${data.skippedStop} STOP, ${data.skippedAlreadySent} déjà contactés.`);
      state.campaign = data.campaign;
      showProgress(data.campaign);
      pollCampaign(data.campaign.id);
      toast('Campagne lancée');
    } catch (error) {
      $('startCampaign').disabled = false;
      toast(error.message, true);
    }
  });

  function statusLabel(status) {
    return ({ running: 'En cours…', paused: 'En pause', done: 'Terminée', cancelled: 'Annulée', failed: 'Erreur', interrupted: 'Interrompue' })[status] || status;
  }

  function showProgress(campaign) {
    state.campaign = campaign;
    $('progressCard').classList.add('show');
    $('progressStatus').textContent = statusLabel(campaign.status);
    $('progressBadge').textContent = `${campaign.current} / ${campaign.total}`;
    const percent = campaign.total ? Math.round((campaign.current / campaign.total) * 100) : 0;
    $('progressBar').style.width = `${percent}%`;
    $('progressCurrent').textContent = campaign.currentRecipient ? `En cours : ${campaign.currentRecipient}` : '—';
    $('progressFailed').textContent = `${campaign.failed} échec(s)`;
    $('pauseCampaign').hidden = campaign.status !== 'running';
    $('resumeCampaign').hidden = campaign.status !== 'paused';
    $('cancelCampaign').hidden = !['running', 'paused'].includes(campaign.status);
    $('progressLog').innerHTML = (campaign.logs || []).map((log) => `<div class="${log.status}">${formatDate(log.at)} · ${esc(log.nom)} · ${esc(log.message)}</div>`).join('');
  }

  function pollCampaign(id) {
    clearInterval(state.pollTimer);
    state.pollTimer = setInterval(async () => {
      try {
        const data = await api(`/api/campaigns/${encodeURIComponent(id)}`);
        showProgress(data.campaign);
        if (['done', 'cancelled', 'failed', 'interrupted'].includes(data.campaign.status)) {
          clearInterval(state.pollTimer);
          state.pollTimer = null;
          state.testDone = false;
          state.selected.clear();
          await loadHistory();
          await checkServer();
          buildRecipients();
          updateSendSummary();
          toast(data.campaign.status === 'done' ? 'Campagne terminée' : `Campagne ${statusLabel(data.campaign.status).toLowerCase()}`);
        }
      } catch (error) {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
        toast(error.message, true);
      }
    }, 2000);
  }

  async function campaignAction(action) {
    if (!state.campaign) return;
    try {
      const data = await api(`/api/campaigns/${encodeURIComponent(state.campaign.id)}/${action}`, { method: 'POST' });
      showProgress(data.campaign);
      toast(action === 'pause' ? 'Campagne en pause' : action === 'resume' ? 'Campagne reprise' : 'Campagne annulée');
    } catch (error) { toast(error.message, true); }
  }
  $('pauseCampaign').addEventListener('click', () => campaignAction('pause'));
  $('resumeCampaign').addEventListener('click', () => campaignAction('resume'));
  $('cancelCampaign').addEventListener('click', () => { if (confirm('Annuler la campagne en cours ? Les mails déjà envoyés restent dans l’historique.')) campaignAction('cancel'); });

  /* ---------- Historique ---------- */
  function renderHistory() {
    const body = $('historyBody');
    const empty = $('historyEmpty');
    if (!state.history.length) { body.innerHTML = ''; empty.hidden = false; return; }
    empty.hidden = true;
    body.innerHTML = state.history.map((item) => `<tr>
      <td>${formatDate(item.sentAt)}</td>
      <td><strong>${esc(item.nom)}</strong><div class="muted">${esc(item.ville || '')}</div></td>
      <td class="mail">${esc(item.email)}</td>
      <td>${esc(item.subject)}</td>
      <td class="${item.status === 'sent' ? 'status-sent' : 'status-failed'}">${item.status === 'sent' ? 'Envoyé' : 'Échec'}${item.dryRun ? ' (sim.)' : ''}</td>
      <td><button class="btn btn-ghost btn-sm" data-stop-history="${esc(item.email)}" type="button">STOP</button></td>
    </tr>`).join('');
    body.querySelectorAll('[data-stop-history]').forEach((btn) => btn.addEventListener('click', () => addStop(btn.dataset.stopHistory)));
  }

  $('historyRefresh').addEventListener('click', async () => { try { await loadHistory(); toast('Historique actualisé'); } catch (error) { toast(error.message, true); } });
  $('historyClear').addEventListener('click', async () => {
    if (!confirm('Effacer tout l’historique des envois ? Cette action ne supprime pas les mails déjà envoyés.')) return;
    try { await api('/api/history?confirm=true', { method: 'DELETE' }); await loadHistory(); toast('Historique effacé'); } catch (error) { toast(error.message, true); }
  });
  $('historyExport').addEventListener('click', () => {
    if (!state.history.length) return toast('Aucun historique à exporter.', true);
    const headers = ['Date', 'Entreprise', 'Email', 'Ville', 'Objet', 'Statut', 'Erreur', 'Modèle', 'Campagne'];
    const rows = state.history.map((item) => [item.sentAt, item.nom, item.email, item.ville, item.subject, item.status, item.error, item.templateName, item.campaignName]);
    const csv = '\ufeff' + [headers, ...rows].map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historique-candidatures-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    toast('Export CSV généré');
  });

  /* ---------- Liste STOP ---------- */
  function renderStopList() {
    const el = $('stopList');
    if (!state.stop.length) { el.innerHTML = '<div class="hint">Aucun email dans la liste STOP.</div>'; return; }
    el.innerHTML = state.stop.map((item) => `<div class="stop-item"><span>${esc(item.email)}</span><span class="spacer"></span><button class="btn btn-ghost btn-sm" data-delete-stop="${esc(item.email)}" type="button">Retirer</button></div>`).join('');
    el.querySelectorAll('[data-delete-stop]').forEach((btn) => btn.addEventListener('click', async () => {
      try { await api(`/api/stop-list/${encodeURIComponent(btn.dataset.deleteStop)}`, { method: 'DELETE' }); await loadStopList(); buildRecipients(); toast('Email retiré de la liste STOP'); } catch (error) { toast(error.message, true); }
    }));
  }

  async function addStop(email) {
    if (!validEmail(email)) return toast('Email invalide.', true);
    try {
      await api('/api/stop-list', { method: 'POST', body: { email, reason: 'Réponse STOP / demande manuelle' } });
      await loadStopList();
      buildRecipients();
      $('stopEmail').value = '';
      toast('Email ajouté à la liste STOP');
    } catch (error) { toast(error.message, true); }
  }
  $('stopAdd').addEventListener('click', () => addStop($('stopEmail').value.trim()));

  /* ---------- Onglets ---------- */
  document.querySelectorAll('.campaign-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.tab = tab.dataset.tab;
      document.querySelectorAll('.campaign-tab').forEach((item) => item.classList.toggle('active', item === tab));
      document.querySelectorAll('.campaign-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `panel-${state.tab}`));
      if (state.tab === 'recipients') buildRecipients();
      if (state.tab === 'history') loadHistory().catch((error) => toast(error.message, true));
      if (state.tab === 'send') updateSendSummary();
      if (state.tab === 'settings') loadConfig().catch((error) => toast(error.message, true));
    });
  });

  $('retryServer').addEventListener('click', checkServer);
  checkServer();
})();
