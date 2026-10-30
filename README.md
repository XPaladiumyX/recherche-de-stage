# travilsstage

Annuaire web des entreprises du numérique, de l'informatique et de la tech autour du **lycée Vaucanson (Grenoble)**, à moins de 30 km.

## Ce que contient le site

- **93 entreprises** du numérique/tech : ESN, éditeurs, web, télécoms, réseaux, cybersécurité, data/IA, électronique, automatisme, réparation.
- **Vérification officielle** de l'existence légale, du SIREN et de l'adresse locale via l'[Annuaire des Entreprises](https://annuaire-entreprises.data.gouv.fr/) (INSEE / data.gouv.fr).
- **Distance calculée** à vol d'oiseau depuis le lycée Vaucanson (27 rue Anatole France, 38100 Grenoble).
- **Téléphone, email, site web et page carrières** quand ils sont disponibles.
- **Suivi de prospection** stage/alternance : statut, notes, date, export CSV (stocké dans le navigateur).
- **Recherche, filtres, carte interactive, vue cartes/tableau, thème clair/sombre.**

## Lancer le site

Le site est statique et fonctionne sans installation :

1. Ouvrir `index.html` dans un navigateur récent.
2. Ou servir le dossier localement :

```bash
python -m http.server 8000
# puis http://localhost:8000
```

La carte utilise Leaflet + OpenStreetMap (connexion internet nécessaire). Le reste du site fonctionne hors ligne.

## Structure

```
index.html
css/styles.css
js/app.js
js/data.js              # données intégrées (fonctionne en file://)
data/entreprises.json   # mêmes données, pour réutilisation
```

## Méthode de vérification

1. Extraction des entreprises du fichier source `entreprises_TOUS_SECTEURS_2026.htm`.
2. Sélection manuelle des entreprises réellement liées au numérique/tech (exclusion des mairies, établissements publics, commerces non tech, sociétés fermées).
3. Recherche de chaque entreprise dans l'API officielle **recherche-entreprises.api.gouv.fr** : SIREN, dénomination légale, NAF, état administratif, adresse du site local.
4. Géocodage des adresses avec **api-adresse.data.gouv.fr** et calcul de la distance depuis le lycée.
5. Récupération des téléphones/emails du fichier initial et, quand disponible, du site officiel.
6. Les contacts marqués **« source initiale »** restent à confirmer avant une utilisation massive.

## Sources

- [Annuaire des Entreprises](https://annuaire-entreprises.data.gouv.fr/)
- [API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/)
- [API Adresse](https://api-adresse.data.gouv.fr/)
- [data.gouv.fr](https://www.data.gouv.fr/)
- Fichier initial `entreprises_TOUS_SECTEURS_2026.htm`

## Limites

- Toutes les entreprises du fichier initial n'ont pas pu être confirmées : certaines sont fermées, introuvables ou sans existence légale identifiable. Elles ne figurent pas dans l'annuaire principal.
- Les téléphones/emails peuvent évoluer. Les badges indiquent la source et le niveau de confiance.
- Les grands comptes sont rattachés à leur **site local** vérifié ; le contact direct local n'est pas toujours public, la page carrières est alors privilégiée.

Dernière vérification : **30/10/2026**.
