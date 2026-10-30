# recherche-de-stage · Tech Vaucanson

Annuaire web des entreprises du numérique, de l'informatique et de la tech autour du **lycée Vaucanson (Grenoble)**, à moins de **30 km**.

- Site : https://xpaladiumyx.github.io/recherche-de-stage/
- Dépôt : https://github.com/XPaladiumyX/recherche-de-stage

> 🚀 **Installation automatique Windows** : double-clique sur **`INSTALLER.bat`** à la racine du projet. Le script installe Node.js si besoin, les dépendances, configure Gmail/Outlook et ouvre la page Campagne.

## Ce que contient le site

- **446 entreprises** actives : ESN, éditeurs de logiciels, web, télécoms, réseaux, cybersécurité, data/IA, cloud, électronique, semi-conducteurs, automatisme, robotique, réparation, vente de matériel IT, audiovisuel numérique et recherche.
- **309 fiches avec site web**, **306 logos récupérés** et **264 avec au moins un contact direct** (téléphone ou email, dont 232 emails et 137 téléphones).
- **Vérification officielle** de l'existence légale, du SIREN/SIRET, de l'activité (NAF) et de l'adresse locale via l'[Annuaire des Entreprises](https://annuaire-entreprises.data.gouv.fr/) (INSEE / data.gouv.fr) et l'[API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/).
- **Distance calculée** à vol d'oiseau depuis le lycée Vaucanson (27 rue Anatole France, 38100 Grenoble).
- **Téléphone, email, site web et page carrières** quand ils sont publics.
- **Suivi de prospection** stage/alternance : statut, notes, date, export CSV (stocké dans le navigateur).
- **Recherche, filtres par famille, ville et distance, carte interactive avec regroupement des marqueurs, vue cartes/tableau, thème clair/sombre.**
- **Campagne d'envoi locale** : modèles de mails, variables automatiques, pièces jointes (CV, lettre, carnet…), sélection des entreprises avec email, test obligatoire, quota quotidien, délai entre les mails, historique et liste STOP. Voir `campagne.html` et `server/README.md`.
- **Rapport d'audit** : `data/verification-report.csv` contient une ligne par entreprise avec SIREN, adresse, coordonnées, distance et niveau de vérification.

## Lancer le site

Le site est statique et fonctionne sans installation :

1. Ouvrir `index.html` dans un navigateur récent.
2. Ou servir le dossier localement :

```bash
python -m http.server 8000
# puis http://localhost:8000
```

La carte utilise Leaflet + OpenStreetMap (connexion internet nécessaire). Le reste du site fonctionne hors ligne.

## Campagne d'envoi locale

L'envoi de mails nécessite un petit serveur local (GitHub Pages ne peut pas envoyer de mails).

### Installation automatique (Windows)

**Double-clique sur `INSTALLER.bat`** à la racine du projet. L'installateur :

1. vérifie/installe Node.js (via winget si disponible) ;
2. installe les dépendances ;
3. demande Gmail ou Outlook, ton adresse et ton mot de passe d'application ;
4. écrit `server/.env` ;
5. démarre le serveur et ouvre la page Campagne.

Aucune ligne de commande à taper. Pour relancer plus tard : `LANCER-CAMPAGNE.bat`.

### Mode manuel

```bash
cd server
npm install
copy .env.example .env
# remplir server/.env avec Gmail ou Outlook
npm start
```

Puis ouvrir **http://localhost:3001/campagne.html**.

### Le mail de test ne part pas

- Si la page affiche **« mode simulation »** : ouvre `server/.env`, mets `DRY_RUN=false`, puis relance `LANCER-CAMPAGNE.bat`. Aucun mail réel n'est envoyé tant que ce n'est pas fait.
- Si une erreur SMTP apparaît : vérifie que `SMTP_USER` et `FROM_EMAIL` sont la même adresse, et que `SMTP_PASS` est un **mot de passe d'application**, pas ton mot de passe habituel.
- Gmail : validation en deux étapes + https://myaccount.google.com/apppasswords
- Outlook : https://account.microsoft.com/security

### Développement avec Vite

Le site est compatible Vite pour le développement :

```bash
npm install
npm run dev
# http://127.0.0.1:5173
```

Le proxy `/api` redirige vers le serveur local sur le port 3001. Pour tester le rendu de production : `npm run build` puis `npm run preview`.

La page détecte automatiquement le serveur, propose les modèles, les pièces jointes, la sélection des entreprises avec email, un test obligatoire, un quota quotidien (40 par défaut), un délai entre les mails et l'historique. Le guide complet est dans [`server/README.md`](server/README.md).

## Structure

```
INSTALLER.bat                 # installation automatique Windows
LANCER-CAMPAGNE.bat           # relancer le serveur + la page Campagne
index.html
campagne.html                 # interface d'envoi local
package.json                  # Vite (dev/build)
vite.config.js
css/styles.css
css/campaign.css
js/animations.js
js/app.js
js/campaign.js
js/data.js                    # données intégrées (fonctionne en file://)
data/entreprises.json         # mêmes données, pour réutilisation
data/verification-report.csv  # audit des 446 entreprises
server/                       # serveur local d'envoi (Nodemailer)
  server.js
  .env.example
  README.md
  start.bat
```

## Méthode de vérification

1. Extraction des entreprises du fichier source `entreprises_TOUS_SECTEURS_2026.htm`.
2. Sélection des entreprises réellement liées au numérique/tech (informatique, télécoms, réseaux, électronique, automatisme, réparation, vente IT, audiovisuel numérique).
3. Recherche de chaque entreprise dans l'API officielle **recherche-entreprises.api.gouv.fr** : SIREN, dénomination légale, NAF, état administratif, adresse du site local.
4. Géocodage / contrôle des coordonnées et calcul de la distance depuis le lycée.
5. Récupération des téléphones/emails du fichier initial et, quand disponible, du site officiel.
6. Contrôle des sites web et des pages carrières ; les sites non confirmés sont marqués « à vérifier ».
7. Les contacts marqués **« source initiale »** restent à confirmer avant une utilisation massive.

## Sources

- [Annuaire des Entreprises](https://annuaire-entreprises.data.gouv.fr/)
- [API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/)
- [API Adresse](https://api-adresse.data.gouv.fr/)
- [data.gouv.fr](https://www.data.gouv.fr/)
- Fichier initial `entreprises_TOUS_SECTEURS_2026.htm`

## Limites

- Le fichier initial contient aussi des entreprises fermées, introuvables ou sans existence légale identifiable : elles ne figurent pas dans l'annuaire principal.
- Les téléphones/emails peuvent évoluer. Les badges indiquent la source et le niveau de confiance.
- Les grands comptes sont rattachés à leur **site local vérifié** ; le contact direct local n'est pas toujours public, la page carrières est alors privilégiée.
- Les sites marqués « à vérifier » sont des pistes retrouvées automatiquement : ils doivent être confirmés avant un usage officiel.
- L'envoi de mails reste **local** : les identifiants SMTP sont dans `server/.env` et ne sont jamais publiés. Utilise un texte personnalisé, une entreprise = un mail, et respecte les demandes de refus.

Dernière vérification : **30/10/2026**.
