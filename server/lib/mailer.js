import path from 'node:path';
import nodemailer from 'nodemailer';

export function getMailConfig(env = process.env) {
  const provider = (env.SMTP_PROVIDER || (String(env.SMTP_HOST || '').includes('gmail') ? 'gmail' : String(env.SMTP_HOST || '').includes('office365') ? 'outlook' : 'custom')).toLowerCase();
  let host = env.SMTP_HOST || '';
  let port = Number(env.SMTP_PORT || 0);
  let secure = String(env.SMTP_SECURE || '').toLowerCase() === 'true';
  let requireTLS = false;
  if (provider === 'gmail' && !host) {
    host = 'smtp.gmail.com';
    port = port || 465;
    secure = true;
  }
  if (provider === 'outlook' && !host) {
    host = 'smtp.office365.com';
    port = port || 587;
    secure = false;
    requireTLS = true;
  }
  port = port || (secure ? 465 : 587);
  const user = env.SMTP_USER || '';
  const pass = env.SMTP_PASS || '';
  const dryRun = String(env.DRY_RUN || '').toLowerCase() === 'true' || !host || !user || !pass;
  return {
    provider,
    host,
    port,
    secure,
    requireTLS,
    user,
    pass,
    dryRun,
    fromEmail: env.FROM_EMAIL || user,
    fromName: env.FROM_NAME || 'Candidature stage',
    maxPerDay: Math.max(1, Math.min(200, Number(env.MAX_PER_DAY || 40))),
    delayMinSeconds: Math.max(2, Number(env.DELAY_MIN_SECONDS || 45)),
    delayMaxSeconds: Math.max(2, Number(env.DELAY_MAX_SECONDS || 90)),
    allowedOrigins: (env.ALLOWED_ORIGINS || 'http://localhost:3001,http://127.0.0.1:3001,https://xpaladiumyx.github.io').split(',').map((s) => s.trim()).filter(Boolean),
  };
}

export function createTransport(config) {
  if (config.dryRun) {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    auth: { user: config.user, pass: config.pass },
    tls: { minVersion: 'TLSv1.2' },
  });
}

export async function verifyTransport(transporter, config) {
  if (config.dryRun) return { ok: true, dryRun: true, message: 'Mode simulation : aucun mail réel ne sera envoyé.' };
  try {
    await transporter.verify();
    return { ok: true, dryRun: false, message: 'Connexion SMTP vérifiée.' };
  } catch (error) {
    return { ok: false, dryRun: false, message: String(error?.message || error) };
  }
}

export function senderSignature(sender = {}) {
  if (sender.signature && String(sender.signature).trim()) return String(sender.signature).trim();
  const lines = [];
  const name = [sender.prenom, sender.nom].filter(Boolean).join(' ');
  if (name) lines.push(name);
  if (sender.formation || sender.etablissement) lines.push([sender.formation, sender.etablissement].filter(Boolean).join(' · '));
  const contact = [sender.telephone, sender.email, sender.linkedin].filter(Boolean).join(' · ');
  if (contact) lines.push(contact);
  return lines.join('\n');
}

export function contactGreeting(recipient = {}) {
  const contact = String(recipient.contact || '').trim();
  if (!contact) return 'Madame, Monsieur';
  if (/^(m\.|mme|mr|mrs|monsieur|madame)/i.test(contact)) return contact;
  return contact;
}

export function renderTemplate(template, recipient = {}, sender = {}) {
  const distance = Number(recipient.distance_km);
  const values = {
    entreprise: recipient.nom || recipient.entreprise || 'votre entreprise',
    contact: contactGreeting(recipient),
    ville: recipient.ville || 'Grenoble',
    famille: recipient.famille || recipient.categorie || 'le numérique',
    distance: Number.isFinite(distance) ? `${distance.toFixed(1).replace('.', ',')} km` : '',
    prenom: sender.prenom || '',
    nom: sender.nom || '',
    formation: sender.formation || '',
    etablissement: sender.etablissement || '',
    telephone: sender.telephone || '',
    email: sender.email || '',
    linkedin: sender.linkedin || '',
    signature: senderSignature(sender),
    date: new Date().toLocaleDateString('fr-FR'),
    civilite: contactGreeting(recipient),
  };
  const replace = (value) => String(value || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? '');
  const text = replace(template.body);
  const subject = replace(template.subject).replace(/[\r\n]+/g, ' ').trim();
  return { subject, text, values };
}

export function attachmentsFor(ids = [], attachments = [], uploadDir) {
  const byId = new Map(attachments.map((item) => [item.id, item]));
  return ids.map((id) => {
    const item = byId.get(id);
    if (!item) return null;
    return {
      filename: item.name,
      path: path.join(uploadDir, item.storedName),
      contentType: item.mime || undefined,
    };
  }).filter(Boolean);
}

export async function sendRenderedMail({ transporter, config, to, subject, text, attachments = [], replyTo = '' }) {
  const from = config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail;
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    text,
    attachments,
    replyTo: replyTo || config.fromEmail || undefined,
  });
  return info;
}
