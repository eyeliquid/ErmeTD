# Het spel aanpassen

Bijna alles wat je wilt veranderen staat in `client/js/data/`. Dat zijn gewone lijsten met getallen en namen; elk bestand begint met een uitleg van zijn velden. Je hoeft `engine.js` of `game.js` daarvoor niet te openen.

Na elke wijziging:

```bash
npm test
```

`server/test/data.test.js` controleert alle databestanden en zegt in gewone woorden wat er mis is, bijvoorbeeld *"tank: letter t is al van een andere vijand"* of *"maze: thema ridders bestaat niet in data/themes.js"*. Open daarna het spel (`npm start`, <http://localhost:3000>) en kijk.

| Ik wil… | Bestand |
| --- | --- |
| het spel makkelijker of zwaarder maken | `data/balance.js` (`B`, `DIFF`) |
| een toren sterker, goedkoper of anders maken | `data/towers.js` (`T`) |
| aanpassen waar een toren sterk of zwak tegen is | `data/towers.js` (`VS`) |
| een vijand sneller, taaier of anders maken | `data/enemies.js` (`EN`) |
| de golven anders samenstellen | `data/enemies.js` (`WAVES`) |
| een talent aanpassen | `data/skills.js` |
| een held aanpassen | `data/heroes.js` |
| hoe de vijand door een vesting loopt | `data/maps.js` |
| hoe een map eruitziet en klinkt | `data/themes.js` |
| hoe de burcht van een vesting eruitziet | `data/forts.js` |

## Een vijand aanpassen

Open `data/enemies.js` en zoek de vijand op in `EN`. De getallen (`hp`, `sp`, `arm`, `b`, …) gelden op elke map. De naam en het uiterlijk kunnen per map anders zijn: die staan in `data/themes.js` onder `enemies`.

- **Taaier:** verhoog `hp`. 1 is een gewone soldaat; 3,2 is een tank.
- **Sneller:** verhoog `sp` (vakken per seconde).
- **Meer pantser:** verhoog `arm` (0,35 = 35% minder schade).
- **Meer credits:** verhoog `b`.
- **Uiterlijk:** pas `model` aan. Een model is een lijst bouwstenen: `k.box(breed, hoog, diep, kleur, x, y, z)`, `k.ball(…)`, enzovoort; de lijst staat onderaan `enemies.js`. De voorkant is +x.

## Een nieuwe vijand toevoegen

1. Kopieer in `data/enemies.js` een vijand in `EN` en geef hem een nieuwe sleutel, bijvoorbeeld `ufo`.
2. Geef hem een **eigen** `code`: één letter die nog geen andere vijand heeft. Die gaat over het netwerk.
3. Zet hem in een golf: voeg in `WAVES` bijvoorbeeld `add('ufo', R(n*.3), .6)` toe.
4. Zet in `data/towers.js` bij `VS` welke torens sterk of zwak tegen hem zijn (mag ook niet).
5. `npm test`.

Je hoeft verder niets te doen: het model, de levensbalk, het netwerk en de uitleg in beeld komen allemaal uit `EN`.

## Een toren aanpassen

In `data/towers.js` staat per toren `cost`, `dmg`, `rate`, `range` en wat hij extra doet (`splash`, `fz`, `pd`, `chain`). Wat een toren precies doet als hij schiet, staat in `fire` in `engine.js`; hoe hij eruitziet in `makeTower` in `game.js`. Een helemaal nieuwe torensoort vraagt dus ook code in die twee functies.

## Een map toevoegen

1. Kopieer in `data/maps.js` een map in `MAPS` en geef hem een nieuwe sleutel en `id` (die moeten gelijk zijn).
2. Kies de ingang `in` en de uitgang `out`. Ze moeten in een opening van de muur liggen: links of rechts op rij `MID` (`LEFT(MID)`, `RIGHT(MID)`), of boven of onder in kolom `GATE` (`TOP(GATE)`, `BOTTOM(GATE)`). De test controleert dat.
3. Kies de regels: `roads` (zelf een weg leggen), `maze` (doolhof bouwen met je torens), `loop` (een vaste ring), `pass` (doorgeven naar de buurman) en `pool` (gedeelde levens).
4. Kies een thema met `theme`. Dat mag een bestaand thema zijn.
5. Teken eventueel een voorbeeld voor de lobby: `MAP_DEMO` in `game.js` (een lijst vakken met torens). Zonder voorbeeld toont de lobby de route op een leeg veld.
6. `npm test`.

De volgorde in `MAPS` is de volgorde in de lobby. De eerste map is de standaard.

## Een thema maken of aanpassen

Een thema staat in `data/themes.js`. Je hoeft alleen te noemen wat anders is dan `alarm`, de oorspronkelijke look.

- **Sfeer:** `sky`, `fog`, `exposure` en `light` (lucht, zon en tegenlicht).
- **Grond, weg en zee:** `ground`, `road`, `trail`, `kerb` en `sea`. Elk heeft een `kind` (bijvoorbeeld gras, sneeuw of metaal voor de grond) en een paar kleuren. De texturen worden getekend in `textures.js`.
- **Muren:** `wall.tint` kleurt de stenen; met `wall.metal: 1` worden het stalen platen.
- **Lampen en vuren:** `lamp` en `fire`.
- **In de lucht:** `particles` met `kind` sneeuw, lichtjes (`motes`) of vonken (`sparks`).
- **Burcht:** `fort` kiest de burcht uit `data/forts.js`. Zie hieronder.
- **Vijanden:** per vijand een andere naam (`n`), andere kleuren (`paint: {'#oude kleur': '#nieuwe kleur'}`) of een heel ander model (`model`). De getallen blijven die uit `enemies.js`.
- **Muziek:** `music` kiest een stijl uit `STYLES` in `music.js`. Daar kun je ook een eigen stijl maken: akkoorden, melodie, tempo en welke lagen meespelen.
- **Knoppen:** `ui.accent` en `ui.trim` kleuren de knoppen en randen tijdens het spel.

## Een burcht maken of aanpassen

Een burcht in `data/forts.js` bestaat uit stukken: `base` (het eiland en de pieren), `wall`, `corner`, `gate`, `hq`, `factory`, `lamp` en `bridge`. Elk stuk is een lijstje bouwstenen, dezelfde als bij de vijanden. Je tekent elk stuk maar één keer; het spel zet het op alle plekken neer en draait het mee.

- **Muur:** `wall(k, L)` tekent een stuk muur van `L` lang, langs x van -L/2 tot L/2. Buiten is -z. Steek niet verder dan 0,5 naar binnen (+z), anders staat de muur op het speelveld; de test controleert dat.
- **Poort:** `gate(k, role)` krijgt `'in'`, `'out'` of `'side'`, zodat je kunt laten zien waar de vijand binnenkomt en weggaat. Houd het midden (x -0,8 tot 0,8, tot 1,5 hoog) vrij: daar lopen de helden over de brug.
- **Hoofdkwartier en fabriek:** in hun eigen maten, met 0,0 in het midden van de pier. De voorkant van het hoofdkwartier is -x, die van de fabriek +x. `band` en `flag` zeggen waar de kleur van de speler komt.
- **Licht en vuur:** `k.lit.box(…)` en de andere `k.lit`-stenen geven zelf licht (ramen, neon, kristallen). `k.light(x, y, z, kleur, grootte)` is een gloed, `k.fire(x, y, z, grootte)` een vuur met rook in de vuurkleur van het thema. Vuur is zwaar: gebruik er per burcht maar een paar.
- **Materiaal:** `mat` is `'stone'` (metselwerk), `'metal'` (platen) of `'plain'` (glad, voor beton, ijs en hout).

Een nieuwe burcht: kopieer er een, geef hem een nieuwe sleutel en zet die bij een thema in `data/themes.js` als `fort`.

## Testen in de browser

Open het spel met `#dev` achter het adres, bijvoorbeeld <http://localhost:3000/#dev>. In de console staat dan `window.__ratd`, met onder meer:

- `__ratd.endPrep()`: de bouwfase meteen afsluiten.
- `__ratd.waveAct()`: de volgende golf sturen.
- `__ratd.g()`: je eigen spel, met goud, levens en vijanden.
- `__ratd.fields()`: alle vestingen in het potje, met hun levens.
- `__ratd.E.inject(__ratd.g(), 'tank', 1)`: een vijand in je vesting zetten, bijvoorbeeld om te kijken hoe hij eruitziet.
- `__ratd.view(15, 9, 11, -.6)`: de camera los op een plek in je vesting zetten (x, z, afstand, draaiing), bijvoorbeeld om de burcht te bekijken.
