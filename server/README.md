# Serveur d'envoi local — recherche-de-stage

Ce dossier contient le petit serveur qui permet d'envoyer les candidatures depuis le site.
Il tourne **uniquement sur ton PC** (`127.0.0.1`) et garde tes identifiants SMTP dans `server/.env`, jamais sur GitHub.

## 1. Prérequis

- **Node.js 18 ou plus** : https://nodejs.org/
- Un compte **Gmail** ou **Outlook** avec la validation en deux étapes.
- Ton CV et ta lettre de motivation en PDF (ou DOC/DOCX, JPG/PNG, ODT, TXT).

## 2. Installer le serveur

Ouvre un terminal dans le dossier du projet :

```bash
cd server
npm install
```

## 3. Configurer Gmail (recommandé)

1. Active la **validation en deux étapes** : https://myaccount.google.com/security
2. Va sur **Mots de passe des applications** : https://myaccount.google.com/apppasswords
3. Crée un mot de passe pour « Courrier » / « Autre » (ex. `recherche-stage`).
4. Copie le mot de passe à 16 caractères fourni par Google.

Puis :

```bash
# Dans server/
copy .env.example .env
# ou sous macOS/Linux :
# cp .env.example .env
```

Ouvre `server/.env` et remplis :

```env
SMTP_PROVIDER=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=ton.adresse@gmail.com
SMTP_PASS=le-mot-de-passe-application
FROM_EMAIL=ton.adresse@gmail.com
FROM_NAME=Ton Prénom Nom
DRY_RUN=true
```

Garde `DRY_RUN=true` pour faire un premier test **sans envoyer de vrai mail**.
Quand tout est prêt, passe à `DRY_RUN=false`.

## 4. Configurer Outlook / Office 365

```env
SMTP_PROVIDER=outlook
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=ton.adresse@outlook.fr
SMTP_PASS=le-mot-de-passe-application
FROM_EMAIL=ton.adresse@outlook.fr
FROM_NAME=Ton Prénom Nom
DRY_RUN=true
```

Outlook demande parfois un **mot de passe d'application** : https://account.microsoft.com/security

## 5. Démarrer le serveur

Le plus simple sur Windows : **double-clique sur `server/start.bat`**.
Il crée `.env` si besoin, installe les dépendances, ouvre la page et démarre le serveur.

Sinon, en terminal :

```bash
cd server
npm start
```

Tu dois voir :

```text
Tech Vaucanson — serveur d'envoi
http://127.0.0.1:3001
Mode : SIMULATION (aucun mail réel)
Quota : 40 mails/jour, délai 45-90s
```

Ouvre ensuite :

**http://localhost:3001/campagne.html**

C'est la version locale du site : la page détecte automatiquement le serveur et active l'envoi.

## 6. Utiliser la page Campagne

1. **Réglages** : renseigne ton prénom, nom, formation, lycée, téléphone, email et signature.
2. **Message** : choisis un modèle, modifie l'objet et le texte, clique sur **Aperçu**.
3. **Pièces jointes** : ajoute ton CV, ta lettre de motivation et éventuellement ton carnet d'évaluation.
4. **Destinataires** : filtre par famille/ville/distance, sélectionne les entreprises avec email.
5. **Envoi** : envoie d'abord un **test à toi-même**, puis coche la confirmation et lance la campagne. Le test est valable 30 minutes et doit correspondre au modèle et aux pièces jointes utilisés.
6. **Historique** : retrouve les mails envoyés/échoués et ajoute un email à la liste **STOP**.

## 7. Détection sur le site GitHub Pages

Quand le serveur tourne, le site public peut détecter sa présence :

- soit tu ouvres directement `http://localhost:3001/campagne.html` (recommandé, tout fonctionne) ;
- soit tu ouvres https://xpaladiumyx.github.io/recherche-de-stage/campagne.html et le bandeau « Serveur local » passe au vert si le navigateur autorise l'accès à `localhost`.

Si le navigateur bloque l'accès depuis GitHub Pages (mixed content), utilise simplement la version locale `http://localhost:3001/campagne.html`.

## 8. Sécurité et bonnes pratiques

- Ne commit **jamais** `server/.env`.
- Le serveur écoute uniquement sur `127.0.0.1` : il n'est pas accessible depuis Internet.
- Le mot de passe d'application peut être révoqué à tout moment depuis ton compte Google/Microsoft.
- Envoie **une seule fois** par entreprise, personnalise le message, et respecte les réponses « STOP ».
- Le serveur applique un quota quotidien (`MAX_PER_DAY`, 40 par défaut) et un délai entre les mails.
- Les données locales sont dans `server/data/` et `server/uploads/` ; elles sont ignorées par Git.

## 9. Dépannage

- **« Serveur local non détecté »** : vérifie que `npm start` tourne et que tu es bien sur `http://localhost:3001/campagne.html`.
- **Erreur Gmail** : vérifie la validation en deux étapes et le mot de passe d'application (pas le mot de passe normal).
- **Erreur Outlook** : vérifie le mot de passe d'application et que le SMTP est autorisé sur le compte.
- **Quota atteint** : attends le lendemain ou augmente `MAX_PER_DAY` dans les réglages (reste raisonnable).
- **Mail classé en spam** : utilise un texte simple, personnalisé, sans pièce jointe lourde, et n'envoie pas trop vite.
