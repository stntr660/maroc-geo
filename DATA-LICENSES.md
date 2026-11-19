# Licences et attributions des données

Le code de ce dépôt est sous licence MIT (voir `LICENSE`). Les données gardent la licence de leur source. Si vous réutilisez un fichier, reproduisez l'attribution correspondante.

## HCP : `regions.json`, `provinces.json`, `communes.json`

- Source : Haut-Commissariat au Plan, Recensement général de la population et de l'habitat 2024 (RGPH 2024).
- Licence : Creative Commons Attribution 4.0 (CC BY 4.0).
- Obtenu via le paquet [morocco-communes](https://github.com/zkousama/morocco-communes) v1.9.1 (code MIT, © 2026 Ousama Ajebbar). Les fichiers ont été réduits aux codes, aux noms et à la population.
- Attribution à reproduire : « Données : Haut-Commissariat au Plan (RGPH 2024), CC BY 4.0. »

## Carte : `morocco.topo.json`

- Géométrie : © les contributeurs d'OpenStreetMap, via le paquet [morocco-map](https://github.com/yousfiSaad/morocco-map) v1.3.0 (ODbL 1.0). Le Maroc y est entier, provinces du Sud comprises.
- Les 75 formes de provinces ont été reliées aux codes HCP par leur nom, simplifiées avec mapshaper, et les 12 régions ont été obtenues en fusionnant leurs provinces, pour qu'elles s'emboîtent exactement.
- Licence : **ODbL 1.0**.
- Attribution à reproduire : « Carte : © les contributeurs d'OpenStreetMap (ODbL 1.0) ; codes : HCP (RGPH 2024). »

## Carte détaillée : `data/map/communes-*.topo.json`, `data/map/arrondissements.topo.json`

- Géométrie : © les contributeurs d'OpenStreetMap, extrait Geofabrik `morocco-latest` du 2026-11-18. Les communes sont au niveau `admin_level=8` et les arrondissements au niveau `admin_level=10`. Chaque forme est reliée à son code HCP, le plus souvent par la clé OSM `ref:MA:HCP`. Le détail par forme est dans `data/map/match-report.json`.
- Licence : **ODbL 1.0**.
- Attribution à reproduire : « Carte : © les contributeurs d'OpenStreetMap (ODbL 1.0) ; codes : HCP (RGPH 2024). »

## GeoNames : `cities-geonames.json`

- Source : [GeoNames](https://www.geonames.org), fichier cities15000, filtré sur le Maroc ; les coordonnées sont arrondies à 4 décimales.
- Licence : CC BY 4.0.
- Attribution à reproduire : « Données : GeoNames (geonames.org), CC BY 4.0. »

## Villes : `cities.json`

- Liste de villes compilée par Zonemation pour des formulaires d'adresse.
- Licence : CC BY 4.0.
- Attribution à reproduire : « maroc-geo (Zonemation), CC BY 4.0. »

## Quartiers : `neighbourhoods.json`

Ce fichier est une base de données dérivée d'OpenStreetMap. Il est donc publié sous **Open Database License (ODbL) 1.0** : https://opendatacommons.org/licenses/odbl/1-0/

Sources :
1. © les contributeurs d'OpenStreetMap, ODbL 1.0 (https://www.openstreetmap.org/copyright). Ont été retenus les objets `place=suburb|quarter|neighbourhood` et les arrondissements (`boundary=administrative`, `admin_level` 10 et 11) situés dans la limite administrative de chaque ville, à partir de l'extrait Geofabrik `morocco-latest` du 2026-11-18.
2. Barid Al-Maghrib / Poste Maroc, *Annuaire du code postal*, édition 2012, « Codes quartiers des 24 grandes villes » (https://www.codepostal.ma/annuaire.pdf). Seuls des noms de lieux en ont été repris.
3. Wikipédia FR et AR (listes de quartiers des articles de ville) : CC BY-SA 4.0. Wikidata (libellés) : CC0.
4. Zones de livraison publiques d'un transporteur (Casablanca) : noms de quartiers seulement (champ `ozon`).

La source de chaque entrée figure dans son champ `src`.

Attribution à reproduire : « Quartiers : maroc-geo, © les contributeurs d'OpenStreetMap (ODbL 1.0), Barid Al-Maghrib, Wikipédia. »

Une base que vous redistribuez et qui est dérivée de ce fichier doit rester sous ODbL. Un site ou une application qui se contente d'afficher les noms (par exemple un champ « Quartier ») est une « œuvre produite » au sens de l'ODbL : il suffit de citer la source.
