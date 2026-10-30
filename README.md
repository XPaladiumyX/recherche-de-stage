# recherche-de-stage — Tech Vaucanson

Annuaire web des entreprises du numérique, de l'informatique et de la tech autour du **lycée Vaucanson (Grenoble)**, à moins de **30 km**.

- Site : https://xpaladiumyx.github.io/recherche-de-stage/
- Dépôt : https://github.com/XPaladiumyX/recherche-de-stage

## Ce que contient le site

- **427 entreprises** actives : ESN, éditeurs de logiciels, web, télécoms, réseaux, cybersécurité, data/IA, cloud, électronique, semi-conducteurs, automatisme, robotique, réparation, vente de matériel IT, audiovisuel numérique et recherche.
- **290 fiches avec site web** et **185 avec au moins un contact direct** (téléphone ou email).
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

Le plus simple sur Windows : **double-clique sur `server/start.bat`**. Sinon :

```bash
cd server
npm install
copy .env.example .env
# remplir server/.env avec Gmail ou Outlook
npm start
```

Puis ouvrir **http://localhost:3001/campagne.html**.

La page détecte automatiquement le serveur, propose les modèles, les pièces jointes, la sélection des entreprises avec email, un test obligatoire, un quota quotidien (40 par défaut), un délai entre les mails et l'historique. Le guide complet est dans [`server/README.md`](server/README.md).

## Structure

```
index.html
campagne.html                 # interface d'envoi local
css/styles.css
css/campaign.css
js/app.js
js/campaign.js
js/data.js                    # données intégrées (fonctionne en file://)
data/entreprises.json         # mêmes données, pour réutilisation
data/verification-report.csv  # audit des 427 entreprises
server/                       # serveur local d'envoi (Nodemailer)
  server.js
  .env.example
  README.md
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
- L'envoi de mails reste **local** : les identifiants SMTP sont dans `server/.env` et ne sont jamais publiés. Utilise un texte personnalisé, une entreprise = un mail, et respecte les réponses « STOP ».

Dernière vérification : **30/10/2026**.
