import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import 'dotenv/config';
import { DEFAULT_CONFIG, DEFAULT_TEMPLATES } from './lib/defaults.js';
import { readJson, writeJson, newId, todayKey, sleep, safeFileName } from './lib/store.js';
import { getMailConfig, createTransport, verifyTransport, renderTemplate, attachmentsFor, sendRenderedMail } from './lib/mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const STOP_FILE = path.join(DATA_DIR, 'stop-list.json');
const ATTACHMENTS_FILE = path.join(DATA_DIR, 'attachments.json');

const mailConfig = getMailConfig();
let config = readJson(CONFIG_FILE, DEFAULT_CONFIG);
let templates = readJson(TEMPLATES_FILE, DEFAULT_TEMPLATES);
let history = readJson(HISTORY_FILE, []);
let campaigns = readJson(CAMPAIGNS_FILE, []);
let stopList = readJson(STOP_FILE, []);
let attachments = readJson(ATTACHMENTS_FILE, []);

if (!Array.isArray(templates) || !templates.length) templates = DEFAULT_TEMPLATES;
if (!Array.isArray(history)) history = [];
if (!Array.isArray(campaigns)) campaigns = [];
if (!Array.isArray(stopList)) stopList = [];
if (!Array.isArray(attachments)) attachments = [];
if (!config?.sender) config = structuredClone(DEFAULT_CONFIG);
if (!config.settings) config.settings = structuredClone(DEFAULT_CONFIG.settings);
writeJson(CONFIG_FILE, config);
writeJson(TEMPLATES_FILE, templates);
writeJson(HISTORY_FILE, history);
writeJson(CAMPAIGNS_FILE, campaigns);
writeJson(STOP_FILE, stopList);
writeJson(ATTACHMENTS_FILE, attachments);

// Une campagne interrompue par un redémarrage ne doit pas rester "running".
let campaignsChanged = false;
for (const campaign of campaigns) {
  if (campaign.status === 'running' || campaign.status === 'paused') {
    campaign.status = 'interrupted';
    campaign.finishedAt = campaign.finishedAt || new Date().toISOString();
    campaign.error = 'Serveur redémarré pendant la campagne. Les mails déjà envoyés restent dans l’historique.';
    campaignsChanged = true;
  }
}
if (campaignsChanged) writeJson(CAMPAIGNS_FILE, campaigns);

const transporter = createTransport(mailConfig);
let smtpStatus = { ok: mailConfig.dryRun, dryRun: mailConfig.dryRun, message: mailConfig.dryRun ? 'Mode simulation : aucun mail réel ne sera envoyé.' : 'Connexion SMTP en cours…' };
verifyTransport(transporter, mailConfig).then((status) => { smtpStatus = status; }).catch((error) => { smtpStatus = { ok: false, dryRun: mailConfig.dryRun, message: String(error?.message || error) }; });

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));

const allowedOrigins = new Set([...mailConfig.allowedOrigins, 'null']);
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin) && !origin.startsWith('http://localhost:') && !origin.startsWith('http://127.0.0.1:')) {
    res.status(403).json({ error: 'Origine non autorisée.' });
    return;
  }
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

function apiError(res, status, message) {
  res.status(status).json({ error: message });
}
function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}
function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
}
function sentToday() {
  const key = todayKey();
  return history.filter((item) => item.status === 'sent' && String(item.sentAt || '').startsWith(key)).length;
}
function publicAttachment(item) {
  return { id: item.id, name: item.name, size: item.size, mime: item.mime, uploadedAt: item.uploadedAt };
}
function publicCampaign(campaign) {
  if (!campaign) return null;
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    total: campaign.total,
    sent: campaign.sent,
    failed: campaign.failed,
    skippedStop: campaign.skippedStop || 0,
    skippedAlreadySent: campaign.skippedAlreadySent || 0,
    current: campaign.current,
    currentRecipient: campaign.currentRecipient || '',
    logs: (campaign.logs || []).slice(0, 80),
    createdAt: campaign.createdAt,
    startedAt: campaign.startedAt || '',
    finishedAt: campaign.finishedAt || '',
    error: campaign.error || '',
    dryRun: !!campaign.dryRun,
  };
}
function persistCampaign(campaign) {
  const index = campaigns.findIndex((item) => item.id === campaign.id);
  if (index >= 0) campaigns[index] = campaign;
  else campaigns.unshift(campaign);
  writeJson(CAMPAIGNS_FILE, campaigns);
}

const jobs = new Map();

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${newId()}-${safeFileName(file.originalname)}`),
});
const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|doc|docx|jpg|jpeg|png|odt|txt)$/i.test(file.originalname);
    if (!ok) return cb(new Error('Format de fichier non autorisé. Utilise PDF, DOC/DOCX, JPG/PNG, ODT ou TXT.'));
    cb(null, true);
  },
});

/* ---------- API ---------- */
app.get('/api/health', (_req, res) => {
  const totalToday = sentToday();
  res.json({
    ok: true,
    service: 'recherche-de-stage-mailer',
    version: '1.0.0',
    serverTime: new Date().toISOString(),
    dryRun: mailConfig.dryRun,
    provider: mailConfig.provider,
    fromEmail: mailConfig.fromEmail,
    smtpReady: smtpStatus.ok,
    smtpMessage: smtpStatus.message,
    maxPerDay: config.settings.maxPerDay || mailConfig.maxPerDay,
    sentToday: totalToday,
    remainingToday: Math.max(0, (config.settings.maxPerDay || mailConfig.maxPerDay) - totalToday),
    delayMinSeconds: config.settings.delayMinSeconds,
    delayMaxSeconds: config.settings.delayMaxSeconds,
  });
});

app.get('/api/config', (_req, res) => {
  res.json({ sender: config.sender, settings: config.settings, smtp: { dryRun: mailConfig.dryRun, provider: mailConfig.provider, fromEmail: mailConfig.fromEmail, smtpReady: smtpStatus.ok, message: smtpStatus.message } });
});

app.put('/api/config', (req, res) => {
  const body = req.body || {};
  const sender = body.sender || {};
  const settings = body.settings || {};
  const next = {
    sender: {
      ...config.sender,
      prenom: String(sender.prenom ?? config.sender.prenom ?? '').slice(0, 80),
      nom: String(sender.nom ?? config.sender.nom ?? '').slice(0, 80),
      formation: String(sender.formation ?? config.sender.formation ?? '').slice(0, 160),
      etablissement: String(sender.etablissement ?? config.sender.etablissement ?? '').slice(0, 160),
      telephone: String(sender.telephone ?? config.sender.telephone ?? '').slice(0, 40),
      email: cleanEmail(sender.email ?? config.sender.email ?? ''),
      linkedin: String(sender.linkedin ?? config.sender.linkedin ?? '').slice(0, 200),
      signature: String(sender.signature ?? config.sender.signature ?? '').slice(0, 2000),
    },
    settings: {
      maxPerDay: Math.max(1, Math.min(200, Number(settings.maxPerDay ?? config.settings.maxPerDay ?? 40))),
      delayMinSeconds: Math.max(2, Math.min(300, Number(settings.delayMinSeconds ?? config.settings.delayMinSeconds ?? 45))),
      delayMaxSeconds: Math.max(2, Math.min(600, Number(settings.delayMaxSeconds ?? config.settings.delayMaxSeconds ?? 90))),
    },
  };
  if (next.settings.delayMaxSeconds < next.settings.delayMinSeconds) next.settings.delayMaxSeconds = next.settings.delayMinSeconds;
  if (next.sender.email && !validEmail(next.sender.email)) return apiError(res, 400, 'Email de l’expéditeur invalide.');
  if (next.sender.telephone && next.sender.telephone.replace(/[^\d]/g, '').length < 9) return apiError(res, 400, 'Téléphone de l’expéditeur invalide.');
  config = next;
  writeJson(CONFIG_FILE, config);
  res.json({ ok: true, config });
});

app.get('/api/templates', (_req, res) => res.json({ templates }));

app.post('/api/templates', (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim().slice(0, 120);
  const subject = String(body.subject || '').trim().slice(0, 240);
  const text = String(body.body || '').trim().slice(0, 20000);
  if (!name || !subject || !text) return apiError(res, 400, 'Nom, objet et message sont obligatoires.');
  const template = { id: newId('tpl-'), name, subject, body: text, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  templates.unshift(template);
  writeJson(TEMPLATES_FILE, templates);
  res.status(201).json({ ok: true, template });
});

app.put('/api/templates/:id', (req, res) => {
  const template = templates.find((item) => item.id === req.params.id);
  if (!template) return apiError(res, 404, 'Modèle introuvable.');
  const body = req.body || {};
  const name = String(body.name ?? template.name).trim().slice(0, 120);
  const subject = String(body.subject ?? template.subject).trim().slice(0, 240);
  const text = String(body.body ?? template.body).trim().slice(0, 20000);
  if (!name || !subject || !text) return apiError(res, 400, 'Nom, objet et message sont obligatoires.');
  Object.assign(template, { name, subject, body: text, updatedAt: new Date().toISOString() });
  writeJson(TEMPLATES_FILE, templates);
  res.json({ ok: true, template });
});

app.delete('/api/templates/:id', (req, res) => {
  const before = templates.length;
  templates = templates.filter((item) => item.id !== req.params.id);
  if (templates.length === before) return apiError(res, 404, 'Modèle introuvable.');
  writeJson(TEMPLATES_FILE, templates);
  res.json({ ok: true });
});

app.post('/api/preview', (req, res) => {
  const { templateId, recipient } = req.body || {};
  const template = templates.find((item) => item.id === templateId);
  if (!template) return apiError(res, 404, 'Modèle introuvable.');
  const rendered = renderTemplate(template, recipient || { nom: 'Entreprise exemple', ville: 'Grenoble', famille: 'Logiciel / Web', contact: 'Madame, Monsieur', distance_km: 2.4 }, config.sender);
  res.json({ ok: true, ...rendered });
});

app.post('/api/test-email', async (req, res, next) => {
  try {
    const { templateId, attachmentIds = [], to, recipient } = req.body || {};
    const template = templates.find((item) => item.id === templateId);
    if (!template) return apiError(res, 404, 'Modèle introuvable.');
    const target = cleanEmail(to || config.sender.email || mailConfig.fromEmail);
    if (!validEmail(target)) return apiError(res, 400, 'Adresse de test invalide. Renseigne ton email dans les réglages.');
    const rendered = renderTemplate(template, recipient || { nom: 'Entreprise test', ville: 'Grenoble', famille: 'Logiciel / Web', contact: 'Madame, Monsieur', distance_km: 2.4 }, config.sender);
    const files = attachmentsFor(attachmentIds, attachments, UPLOAD_DIR);
    const info = await sendRenderedMail({ transporter, config: mailConfig, to: target, subject: rendered.subject, text: rendered.text, attachments: files, replyTo: config.sender.email });
    res.json({ ok: true, dryRun: mailConfig.dryRun, messageId: info.messageId || '', subject: rendered.subject, text: rendered.text, attachments: files.map((file) => file.filename) });
  } catch (error) { next(error); }
});

app.get('/api/attachments', (_req, res) => res.json({ attachments: attachments.map(publicAttachment) }));

app.post('/api/attachments', upload.array('files', 10), (req, res) => {
  const added = (req.files || []).map((file) => ({
    id: newId('att-'),
    name: file.originalname,
    storedName: file.filename,
    size: file.size,
    mime: file.mimetype,
    uploadedAt: new Date().toISOString(),
  }));
  attachments.push(...added);
  writeJson(ATTACHMENTS_FILE, attachments);
  res.status(201).json({ ok: true, attachments: added.map(publicAttachment) });
});

app.get('/api/attachments/:id/download', (req, res) => {
  const item = attachments.find((entry) => entry.id === req.params.id);
  if (!item) return apiError(res, 404, 'Fichier introuvable.');
  res.download(path.join(UPLOAD_DIR, item.storedName), item.name);
});

app.delete('/api/attachments/:id', (req, res) => {
  const item = attachments.find((entry) => entry.id === req.params.id);
  if (!item) return apiError(res, 404, 'Fichier introuvable.');
  attachments = attachments.filter((entry) => entry.id !== req.params.id);
  writeJson(ATTACHMENTS_FILE, attachments);
  try { fs.unlinkSync(path.join(UPLOAD_DIR, item.storedName)); } catch {}
  res.json({ ok: true });
});

app.get('/api/stop-list', (_req, res) => res.json({ emails: stopList }));

app.post('/api/stop-list', (req, res) => {
  const email = cleanEmail(req.body?.email);
  if (!validEmail(email)) return apiError(res, 400, 'Email invalide.');
  if (!stopList.some((item) => item.email === email)) stopList.unshift({ email, reason: String(req.body?.reason || '').slice(0, 200), addedAt: new Date().toISOString() });
  writeJson(STOP_FILE, stopList);
  res.json({ ok: true, emails: stopList });
});

app.delete('/api/stop-list/:email', (req, res) => {
  const email = cleanEmail(decodeURIComponent(req.params.email));
  stopList = stopList.filter((item) => item.email !== email);
  writeJson(STOP_FILE, stopList);
  res.json({ ok: true, emails: stopList });
});

app.get('/api/history', (req, res) => {
  const limit = Math.max(1, Math.min(2000, Number(req.query.limit || 500)));
  res.json({ history: history.slice(0, limit) });
});

app.delete('/api/history', (req, res) => {
  if (req.query.confirm !== 'true') return apiError(res, 400, 'Confirmation requise.');
  history = [];
  writeJson(HISTORY_FILE, history);
  res.json({ ok: true });
});

app.get('/api/campaigns', (_req, res) => res.json({ campaigns: campaigns.slice(0, 20).map(publicCampaign) }));

app.get('/api/campaigns/:id', (req, res) => {
  const campaign = jobs.get(req.params.id) || campaigns.find((item) => item.id === req.params.id);
  if (!campaign) return apiError(res, 404, 'Campagne introuvable.');
  res.json({ campaign: publicCampaign(campaign) });
});

app.post('/api/campaigns/:id/pause', (req, res) => {
  const campaign = jobs.get(req.params.id);
  if (!campaign) return apiError(res, 404, 'Campagne introuvable ou terminée.');
  campaign.status = 'paused';
  persistCampaign(campaign);
  res.json({ ok: true, campaign: publicCampaign(campaign) });
});

app.post('/api/campaigns/:id/resume', (req, res) => {
  const campaign = jobs.get(req.params.id);
  if (!campaign) return apiError(res, 404, 'Campagne introuvable ou terminée.');
  campaign.status = 'running';
  persistCampaign(campaign);
  res.json({ ok: true, campaign: publicCampaign(campaign) });
});

app.post('/api/campaigns/:id/cancel', (req, res) => {
  const campaign = jobs.get(req.params.id);
  if (!campaign) return apiError(res, 404, 'Campagne introuvable ou terminée.');
  campaign.status = 'cancelled';
  persistCampaign(campaign);
  res.json({ ok: true, campaign: publicCampaign(campaign) });
});

app.post('/api/campaigns', async (req, res, next) => {
  try {
    const body = req.body || {};
    if (body.confirmed !== true) return apiError(res, 400, 'Tu dois confirmer la campagne avant l’envoi.');
    const template = templates.find((item) => item.id === body.templateId);
    if (!template) return apiError(res, 404, 'Modèle introuvable.');
    const attachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds : [];
    if (attachmentIds.length && attachmentsFor(attachmentIds, attachments, UPLOAD_DIR).length !== attachmentIds.length) return apiError(res, 400, 'Une pièce jointe est introuvable.');
    const allowResend = body.allowResend === true;
    const stopEmails = new Set(stopList.map((item) => item.email));
    const sentEmails = new Set(history.filter((item) => item.status === 'sent').map((item) => cleanEmail(item.email)));
    const seen = new Set();
    const selected = [];
    let skippedStop = 0, skippedAlreadySent = 0, skippedInvalid = 0;
    for (const raw of Array.isArray(body.recipients) ? body.recipients.slice(0, 200) : []) {
      const email = cleanEmail(raw?.email);
      if (!validEmail(email)) { skippedInvalid++; continue; }
      if (seen.has(email)) continue;
      seen.add(email);
      if (stopEmails.has(email)) { skippedStop++; continue; }
      if (!allowResend && sentEmails.has(email)) { skippedAlreadySent++; continue; }
      selected.push({
        siren: String(raw.siren || ''),
        nom: String(raw.nom || raw.entreprise || 'Entreprise').slice(0, 160),
        email,
        contact: String(raw.contact || '').slice(0, 120),
        ville: String(raw.ville || '').slice(0, 120),
        famille: String(raw.famille || raw.categorie || '').slice(0, 120),
        distance_km: Number(raw.distance_km) || null,
      });
    }
    if (!selected.length) return apiError(res, 400, 'Aucun destinataire valide à envoyer (déjà contactés, STOP ou email manquant).');
    const maxPerDay = Number(config.settings.maxPerDay || mailConfig.maxPerDay);
    const remaining = Math.max(0, maxPerDay - sentToday());
    if (remaining <= 0) return apiError(res, 429, `Quota quotidien atteint (${maxPerDay} mails). Réessaie demain ou augmente la limite dans les réglages.`);
    let recipientsToSend = selected;
    let truncated = false;
    if (recipientsToSend.length > remaining) {
      recipientsToSend = recipientsToSend.slice(0, remaining);
      truncated = true;
    }
    const campaign = {
      id: newId('camp-'),
      name: String(body.name || `Campagne ${new Date().toLocaleDateString('fr-FR')}`).slice(0, 120),
      status: 'running',
      total: recipientsToSend.length,
      sent: 0,
      failed: 0,
      skippedStop,
      skippedAlreadySent,
      skippedInvalid,
      current: 0,
      currentRecipient: '',
      logs: [],
      templateId: template.id,
      templateName: template.name,
      attachmentIds,
      recipients: recipientsToSend,
      delayMinSeconds: Number(config.settings.delayMinSeconds || mailConfig.delayMinSeconds),
      delayMaxSeconds: Number(config.settings.delayMaxSeconds || mailConfig.delayMaxSeconds),
      dryRun: mailConfig.dryRun,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: '',
      error: '',
    };
    jobs.set(campaign.id, campaign);
    persistCampaign(campaign);
    runCampaign(campaign).catch((error) => {
      campaign.status = 'failed';
      campaign.error = String(error?.message || error);
      campaign.finishedAt = new Date().toISOString();
      persistCampaign(campaign);
    });
    res.status(201).json({ ok: true, campaign: publicCampaign(campaign), truncated, remainingBefore: remaining, skippedStop, skippedAlreadySent, skippedInvalid });
  } catch (error) { next(error); }
});

async function runCampaign(campaign) {
  const template = templates.find((item) => item.id === campaign.templateId) || templates[0];
  const files = attachmentsFor(campaign.attachmentIds || [], attachments, UPLOAD_DIR);
  for (let index = campaign.current; index < campaign.recipients.length; index++) {
    while (campaign.status === 'paused') await sleep(1000);
    if (campaign.status === 'cancelled') break;
    const recipient = campaign.recipients[index];
    campaign.currentRecipient = recipient.nom;
    const rendered = renderTemplate(template, recipient, config.sender);
    const entry = {
      id: newId('mail-'),
      campaignId: campaign.id,
      campaignName: campaign.name,
      siren: recipient.siren,
      nom: recipient.nom,
      email: recipient.email,
      contact: recipient.contact,
      ville: recipient.ville,
      famille: recipient.famille,
      subject: rendered.subject,
      status: 'sent',
      messageId: '',
      error: '',
      sentAt: new Date().toISOString(),
      templateId: template.id,
      templateName: template.name,
      attachments: files.map((file) => file.filename),
      dryRun: mailConfig.dryRun,
    };
    try {
      const info = await sendRenderedMail({ transporter, config: mailConfig, to: recipient.email, subject: rendered.subject, text: rendered.text, attachments: files, replyTo: config.sender.email });
      entry.messageId = info.messageId || '';
      campaign.sent++;
      campaign.logs.unshift({ at: entry.sentAt, status: 'sent', email: recipient.email, nom: recipient.nom, message: mailConfig.dryRun ? 'Simulation réussie' : 'Mail envoyé' });
    } catch (error) {
      entry.status = 'failed';
      entry.error = String(error?.message || error).slice(0, 500);
      campaign.failed++;
      campaign.logs.unshift({ at: entry.sentAt, status: 'failed', email: recipient.email, nom: recipient.nom, message: entry.error });
    }
    history.unshift(entry);
    writeJson(HISTORY_FILE, history);
    campaign.current = index + 1;
    campaign.updatedAt = new Date().toISOString();
    persistCampaign(campaign);
    if (index < campaign.recipients.length - 1 && campaign.status !== 'cancelled') {
      const min = Math.max(1, campaign.delayMinSeconds || 45);
      const max = Math.max(min, campaign.delayMaxSeconds || min);
      const wait = Math.round((min + Math.random() * (max - min)) * 1000);
      await sleep(wait);
    }
  }
  campaign.currentRecipient = '';
  if (campaign.status === 'running') campaign.status = 'done';
  campaign.finishedAt = new Date().toISOString();
  persistCampaign(campaign);
  jobs.delete(campaign.id);
}

/* ---------- Fichiers statiques (liste blanche uniquement) ---------- */
app.use('/css', express.static(path.join(ROOT, 'css'), { dotfiles: 'deny' }));
app.use('/js', express.static(path.join(ROOT, 'js'), { dotfiles: 'deny' }));
app.use('/data', express.static(path.join(ROOT, 'data'), { dotfiles: 'deny' }));
for (const file of ['index.html', 'campagne.html', 'README.md']) {
  app.get(`/${file}`, (_req, res) => res.sendFile(path.join(ROOT, file)));
}
app.get('/', (_req, res) => res.sendFile(path.join(ROOT, 'index.html')));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Route API inconnue.' }));
app.use((_req, res) => res.status(404).send('Not found'));

app.use((error, _req, res, _next) => {
  console.error('[mailer]', error);
  if (res.headersSent) return;
  const status = error?.code === 'LIMIT_FILE_SIZE' ? 413 : 500;
  res.status(status).json({ error: String(error?.message || error) });
});

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
app.listen(port, host, () => {
  console.log(`\nTech Vaucanson — serveur d'envoi`);
  console.log(`http://${host}:${port}`);
  console.log(`Mode : ${mailConfig.dryRun ? 'SIMULATION (aucun mail réel)' : `SMTP ${mailConfig.provider} — ${mailConfig.fromEmail}`}`);
  console.log(`Quota : ${config.settings.maxPerDay} mails/jour, délai ${config.settings.delayMinSeconds}-${config.settings.delayMaxSeconds}s`);
  console.log(`Dossier de données : ${DATA_DIR}\n`);
});
