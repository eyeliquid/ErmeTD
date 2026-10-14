# ErmeTD

ErmeTD is een towerdefense game geïnspireerd door Red Alert 3: een 3D-wereld waar je in third-person doorheen loopt met een held, je eigen weg en torens bouwt, en samen met andere spelers 100 levels probeert te overleven.

Het spel bestaat uit een frontend (de pagina in de browser) en een backend (een server met accounts, opgeslagen voortgang, het leaderboard en de lobby's).

## Starten

Nodig: [Node.js](https://nodejs.org) 22.13 of nieuwer.

```bash
npm install
npm start
```

Open daarna <http://localhost:3000>. Open het adres in een tweede venster om met twee spelers te testen. Start je alleen, dan doen acht bots mee.

Met Docker draait het spel samen met een Cloudflare Tunnel, zodat het ook online staat. Zie [Online zetten met een Cloudflare Tunnel](#online-zetten-met-een-cloudflare-tunnel).

## Opbouw

```
client/                 frontend: gewone bestanden, geen bouwstap
  index.html            de pagina
  admin.html            de webadmin (met css/admin.css en js/admin.js)
  css/style.css         opmaak
  js/config.js          adres van de backend (leeg = dezelfde server)
  js/engine.js          spelregels: torens, vijanden, golven, skills
  js/net.js             alle communicatie met de backend
  js/minigames.js       de 30 genummerde minigames
  js/game.js            3D-wereld, bediening, lobby, minigames
  vendor/three.min.js   three.js r128
server/                 backend: Node.js, Express, WebSocket, SQLite
  src/index.js          startpunt: API, lobby en de frontend
  src/api.js            HTTP-API onder /api
  src/room.js           realtime lobby's op /ws
  src/auth.js           wachtwoorden en sessies
  src/admin.js          beheer-API onder /api/admin
  src/settings.js       spelinstellingen uit de webadmin
  src/db.js             database en migraties
  src/validate.js       controle van wat spelers insturen
  test/                 tests van de API en de lobby
docs/game-design.md     het oorspronkelijke game design document
```

De server serveert ook de frontend, dus één adres is genoeg. `engine.js` wordt door beide kanten gebruikt: de browser speelt ermee, de server controleert er opgeslagen voortgang mee.

## Moeilijkheidsgraden

Voor de start kiest elke speler zelf een moeilijkheidsgraad; die geldt alleen voor zijn eigen vesting en held.

| Graad | Vijanden | Schade aan je held | Score |
| --- | --- | --- | --- |
| Geers | gewoon | gewoon | ×1 |
| Super Geers | 35% meer levens, 6% sneller | +20% | ×1,25 |
| Alleen voor Geers | 85% meer levens, 12% sneller | +50% | ×1,75 |

De waarden staan in `DIFF` bovenin `client/js/engine.js`.

## Maps

Speler 1 kiest in de lobby de map (knop **Map**, boven de moeilijkheidsgraad). Iedereen in het potje speelt dezelfde map; wie alleen start, kiest zelf en de bots spelen mee. De keuze gaat mee in het startsein (`go` en `mp` in de presence).

| Map | Soort | Hoe het werkt |
| --- | --- | --- |
| Klassiek | je eigen weg | Zoals altijd: links naar rechts, zelf een weg leggen, minigames na elke tiende golf. |
| Estafette | doorlopen | Wat je doorlaat loopt verder door de vesting rechts van je op dezelfde rij. Alleen de laatste vesting op de rij verliest er levens door. |
| Wintermaul | samenwerken | Van boven naar beneden, zonder weg: je bouwt het doolhof met je torens. Wat je doorlaat zakt naar de vesting eronder. Alle vestingen delen één levenspot; is die leeg, dan verliest iedereen. |
| Groene Cirkel | rondje | Een vaste ring zonder uitgang. De vijand blijft rondjes lopen tot hij dood is; elk rondje kost levens (een luchtschip 10). |
| Doolhofbouwer | vrij bouwen | Geen weg: de vijand komt links binnen en wil onder weg. Je torens zijn je muren, ook tijdens een golf. |

Op alle maps behalve Klassiek zijn er voorlopig geen minigames: na golf 100 heb je gewonnen.

- **Waar het staat.** `MAPS` bovenin `client/js/engine.js` (ingang `in`, uitgang `out`, `roads`, `maze`, `loop`, `pass`, `pool`, `mini`). De voorbeeldplaatjes in de lobby staan in `MAP_DEMO` in `client/js/game.js`.
- **Doolhof.** Op Wintermaul en Doolhofbouwer kun je overal bouwen, behalve onder een vijand, zolang er een weg van de ingang naar de uitgang overblijft. Na elke nieuwe of verkochte toren zoekt de vijand meteen een nieuwe weg (`repath`); wie al loopt, gaat verder vanaf waar hij staat.
- **Doorgeven.** Loopt een vijand je vesting uit, dan vraagt `E.step` via `G.pass` aan de spellaag of hij door kan. `passOn` in `client/js/game.js` zoekt de volgende vesting. Draait die in dezelfde browser (jij of een bot), dan komt de vijand er direct binnen (`E.inject`), met hetzelfde deel van zijn levens. Bij een andere speler gaat het via de presence `pz`: het totaal en de laatste 60 doorgegeven vijanden.
- **Levenspot.** Op Wintermaul telt elke vesting zijn eigen levens; de pot is de som van alle vestingen in het potje (`teamLives`). De poorten boven en onder liggen in kolom 8, bij de openingen in de muur.

### Hoe zwaar de levels worden

De levens van de vijanden groeien elk level. Daarbovenop komt een extra zwaarte:

| Level | Extra levens bij de vijanden |
| --- | --- |
| 1 tot 10 | geen |
| 11 tot 19 | loopt op van 0 naar 15% |
| 20 tot 30 | 15% |
| vanaf 31 | elk level 1,5% erbij (level 40 +33%, level 50 +55%, level 70 ×2,1, level 100 ×3,3) |

Dit staat in `B` bovenin `client/js/engine.js`: `midX` (de 15%), `rampFrom` (level 30) en `ramp` (de 1,5% per level). Het geldt voor elke moeilijkheidsgraad en komt bovenop de levens-instelling in de webadmin.
## Torens: de keten

Elke toren doorloopt dezelfde keten, en die leidt naar De Slapende Geers.

1. **5 upgrades.** Elke gewone toren kun je 5 keer upgraden.
2. **Ultra.** Daarna wordt hij een ultra versie van zichzelf: meer schade, 15% sneller, 10% meer bereik.
3. **Turbo.** Een ultra toren kan turbo worden zodra er nog een andere ultra toren staat (een toren die al turbo is telt ook). Turbo komt boven op ultra: 80% sneller en 30% meer schade.
4. **Geers Toren.** Staat er van elk van de tien torensoorten een turbo, dan kun je Geers Torens bouwen (toets G, na de bouwfase). Een Geers Toren kun je 13 keer upgraden.
5. **De Slapende Geers.** Bij 4 Geers Torens komt hij vrij (toets Z): een toren van 3 bij 3 vakken die alles binnen zijn bereik vertraagt en zware schade doet. Er kan er één staan.

**Wek poppetje Geers.** Selecteer De Slapende Geers en druk 10 keer op de knop (toets P). Dan wordt hij wakker: 10 seconden lang heeft hij 20 keer zo veel kracht en bereik. Daarna slaapt hij voorgoed en werkt de knop niet meer. Bots wekken hem zodra er een baas over hun veld loopt. De getallen staan in `WAKE` in `client/js/engine.js`.

De voorwaarden worden gecontroleerd op het moment dat je bouwt of upgradet. Prijzen, schade en de bonussen van ultra en turbo staan in `T`, `stats` en `specCost` in `client/js/engine.js`.

## Duwen en sprinten

In elke minigame heeft de held twee extra's, rechtsonder op de commandokaart.

- **Duwen (C).** Duwt andere spelers binnen 2,4 meter een klein stukje van je af. 6 seconden cooldown. Het doet geen schade.
- **Sprint (Shift).** 3 seconden lang 60% sneller. 10 seconden cooldown.

Vijf talenten in de boom Veldheer maken ze sterker: Brede schouders (verder duwen), Elleboogwerk (duwen laadt sneller), Lange adem (langer sprinten), Snel op adem (sprint laadt sneller) en Naverbrander (sneller sprinten). De vaste waarden staan in `MOVES` in `client/js/engine.js`.

## Minigames en eilanden

Rond het speelveld liggen zes minigame-eilanden: onder het ronde eiland, boven het vierkante, links het kruis, rechts de vier eilandjes met bruggen, links onderin het casino met de roulettetafel en linksboven het racecircuit. Elke minigame hoort bij één eiland (`isle` in zijn beschrijving). Het doolhof heeft een eigen baan naast het ronde eiland.

Na elke tiende golf volgt een minigame. Drie levels liggen vast, in `FIXED` in `client/js/game.js`: level 10 de Kolos, level 50 De Slapende Geers en level 100 de Titaan. Op de andere tientallen kiest `miniFor` een willekeurige uit alle overige, in één potje nooit twee keer dezelfde. De keuze volgt uit het potje, zodat alle spelers dezelfde krijgen.

De genummerde minigames staan in `client/js/minigames.js`; bovenin dat bestand staat welke velden een minigame heeft. De getallen die de moeilijkheid bepalen (duur `T`, doel `goal`, levenspunten, schade, tempo) staan per minigame bij elkaar. In een potje speelt iedereen zijn eigen ronde op hetzelfde eiland en wint de hoogste score.

In de lobby staat de knop **Minigames**. Daar kies je een minigame en speel je hem los, alleen, met je gekozen held en je skills. Het telt nergens voor mee: geen skillpunten, geen score, geen potje erbij. Andere spelers zien je in de lobby als "Test minigames".

## Hoe het online werkt

- **Accounts.** Een roepnaam met een wachtwoord. Wachtwoorden worden met scrypt gehasht. Na inloggen krijgt de browser een sessietoken; in de database staat alleen de hash daarvan. Er is geen e-mailadres en dus ook geen wachtwoordherstel.
- **Voortgang.** Skillpunten, skills, held, gekozen moeilijkheidsgraad en aantal potjes staan per account op de server en gaan mee naar elk apparaat. Een gast speelt alleen lokaal.
- **Leaderboard.** De beste score per account. Een nieuwe score verschijnt direct bij iedereen die online is.
- **Lobby's.** Na het openen kies je een lobby uit de lijst, of maak je er zelf een met een eigen naam. Een lobby heeft plek voor 25 spelers (de 25 vestingen van de wereld) en een eigen chat; spelers in andere lobby's zie en hoor je niet. Zodra een lobby start, gaat hij op slot: er kan niemand meer bij. Alleen wie tijdens het potje even de verbinding verliest, komt binnen twee minuten terug op zijn plek. Is niemand van de lobby meer aan het spelen, dan gaat hij weer open. Er is altijd minstens één open lobby; lege lobby's ruimt de server zelf op. Met **Andere lobby** ga je terug naar de lijst.
- **Samen spelen.** Elke browser houdt een WebSocket open. De server houdt per speler een stukje toestand bij (lobbystatus, vesting, held, minigamescore) en stuurt wijzigingen 20 keer per seconde gebundeld door naar de spelers in dezelfde lobby. Chatberichten gaan ook via de server; per lobby blijven de laatste zestig bewaard zolang de lobby bestaat.
- **Bots.** Wie alleen start krijgt acht bots erbij. Elke bot kiest een andere held dan de speler en heeft dezelfde talenten. Bots worden nagespeeld in de browser van die speler (`client/js/game.js`, onder "bots") en volgen dezelfde spelregels, omdat ze dezelfde code draaien: `asBot` wisselt alles wat bij één speler hoort even om naar de bot en laat dan de gewone spelcode lopen. Een bot krijgt dus dezelfde klappen, botsingen en afkoeltijden, loopt naar een vak voordat hij bouwt en speelt elke minigame echt mee. Alleen het beslissen is van de bot zelf (`botBrain`, en per lab-minigame een `bot(a, m, ai)` in `client/js/minigames.js`), met een reactietijd en een vaardigheid per bot, zodat ze niet allemaal even goed zijn. Andere spelers in de wereld zien ze niet, maar houden hun vestingen wel vrij. Start er een tweede mens mee, dan komen er geen bots.
- **Haperende verbinding.** De browser verbindt vanzelf opnieuw en krijgt dezelfde plek terug. Wie echt weg is valt binnen een halve minuut af, zodat een potje niet op hem blijft wachten.

Het spel zelf rekent in de browser van elke speler; de server geeft door wat spelers elkaar laten zien en bewaakt wie wie is. De server controleert de vorm en de grenzen van wat binnenkomt, maar speelt een potje niet na. Een speler die zijn eigen browser aanpast kan dus een score insturen die hij niet heeft gehaald.

## Webadmin

Op `/admin` staat een beheerpagina achter een wachtwoord. Zet dat wachtwoord op de server in `ADMIN_PASSWORD` (minstens 10 tekens); zonder die instelling staat de webadmin uit.

```bash
ADMIN_PASSWORD='kies-een-lang-wachtwoord' npm start
```

- **Spelers.** Alle accounts met aanmaakdatum, laatst gezien, potjes, beste score, ronde en skillpunten, en wie nu online is. Per speler kun je een nieuw wachtwoord instellen, de score wissen of het account verwijderen.
- **Instellingen.** Startcredits, levens, bouwtijd, vijandsterkte en credits per kill; nieuwe accounts aan of uit; de lobbychat aan of uit; een mededeling boven de chat. Ze staan in de database, gaan direct naar elke browser en gelden vanaf het volgende potje.

Na vijf foute wachtwoorden moet dat IP-adres een kwartier wachten. Een beheersessie duurt acht uur en vervalt als de server herstart. Zet de server online achter https, anders gaat het wachtwoord leesbaar over de lijn.

## API

Alles onder `/api`, in JSON. Waar "ingelogd" staat hoort de kop `Authorization: Bearer <token>` erbij.

| Methode | Pad | Wat |
| --- | --- | --- |
| POST | `/register` | account maken met `name` en `password`; geeft `token` en `user` |
| POST | `/login` | inloggen; geeft `token`, `user` en `save` |
| POST | `/logout` | ingelogd · sessie beëindigen |
| GET | `/me` | ingelogd · wie ben ik, plus opgeslagen voortgang |
| PATCH | `/account` | ingelogd · roepnaam wijzigen |
| PUT | `/save` | ingelogd · voortgang opslaan; geeft terug wat nu geldt |
| GET | `/scores` | de top 20 |
| POST | `/scores` | ingelogd · score insturen; alleen een betere score telt |
| GET | `/settings` | de spelinstellingen uit de webadmin |
| GET | `/health` | draait de server, en hoeveel spelers zijn online |

## Online zetten

Het spel kan op elke host draaien die een Node.js-server of een Docker-container kan draaien en WebSockets doorlaat. Twee dingen zijn belangrijk:

1. **Een schijf die blijft bestaan.** Alle accounts en scores staan in één bestand, `ratd.sqlite`, in de map `DATA_DIR` (in de container `/data`). Zonder vaste schijf is alles weg na elke herstart of update.
2. **`TRUST_PROXY=1`** als de host een proxy voor de server zet (dat doen vrijwel alle platforms). Dan ziet de inlogbeveiliging het echte IP-adres van een speler.

De overige instellingen staan in [`server/.env.example`](server/.env.example).

Staat de frontend ergens anders dan de server, vul dan het adres van de server in bij `client/js/config.js` en zet het adres van de frontend op de server in `CORS_ORIGINS`.

### Online zetten met een Cloudflare Tunnel

`docker-compose.yml` start twee containers: het spel en `cloudflared`. Die laatste maakt zelf een verbinding naar Cloudflare, dus je hoeft geen poorten in je router open te zetten en je IP-adres maakt niet uit. Alles draait in Docker; op de computer zelf hoef je niets anders te installeren. Cloudflare regelt HTTPS en stuurt ook de lobby-WebSocket door.

Voorwaarde: het domein `terpstack.dev` staat in je Cloudflare-account.

1. **Tunnel maken.** Ga in het Cloudflare-dashboard naar **Zero Trust → Networks → Tunnels** en kies **Create a tunnel → Cloudflared**. Noem hem `ermetd`. Kies bij de installatie **Docker** en kopieer de lange tekst achter `--token`. Dat commando zelf hoef je niet uit te voeren.
2. **Adres koppelen.** Voeg bij de tunnel een **Public Hostname** toe:

   | Veld | Waarde |
   |---|---|
   | Subdomain | `ermetd` |
   | Domain | `terpstack.dev` |
   | Service type | `HTTP` |
   | URL | `spel:3000` |

   Staat er al een DNS-record `ermetd` (bijvoorbeeld van een eerdere tunnel), verwijder dat dan eerst onder **DNS → Records**.
3. **Instellingen.** `cp .env.example .env` en vul `TUNNEL_TOKEN` (de tekst uit stap 1) en `ADMIN_PASSWORD` in.
4. **Starten.**

   ```bash
   docker compose up -d --build
   ```

   Na een paar seconden staat het spel op <https://ermetd.terpstack.dev>, en op de computer zelf op <http://localhost:3000>. In het dashboard staat de tunnel dan op **Healthy**. Werkt het niet: `docker compose logs tunnel`.

De database staat in het Docker-volume `speldata` en blijft bewaard bij `docker compose down` en bij een update. Een update: `git pull` en dan weer `docker compose up -d --build`.

Het spel is alleen bereikbaar zolang de computer aanstaat en niet slaapt. Zet het startgoud in de webadmin op 260 voordat anderen meespelen.

## Ontwikkelen

```bash
npm run dev     # server die herstart na elke wijziging
npm test        # tests van de API en de lobby
```

Open de pagina met `#dev` achter het adres om de testhulpmiddelen in `window.__ratd` beschikbaar te maken.

In de spelregels is het startgoud 260. De server stuurt zijn eigen instelling mee en die staat nog op een testwaarde (10.000). Zet het in de webadmin onder Instellingen op 260 voor de definitieve versie.

## Sterk en zwak

Elke toren doet 150% schade tegen de vijanden waar hij sterk tegen is en 50% tegen de vijanden waar hij zwak tegen is. De tabel staat als `VS` in `client/js/engine.js`; daar pas je een matchup aan. Het getal telt ook voor het gif per seconde van de Toxine Sproeier en voor hoe lang de Cryo Toren een vijand bevriest. Een bevroren Veldmech herstelt niet.

| Toren | Sterk tegen | Zwak tegen |
|---|---|---|
| Sentry Gun | Conscript, Aanvalshond | Hammer Tank, Luchtschip |
| Flak Kanon | Terror Drone, Luchtschip | Hammer Tank, Veldmech |
| Cryo Toren | Aanvalshond, Veldmech | Hazmat-trooper, Luchtschip |
| Toxine Sproeier | Conscript, Aanvalshond | Hazmat-trooper, Terror Drone, Hammer Tank |
| Tesla Spoel | Terror Drone, Veldmech | Hazmat-trooper, Luchtschip |
| Prisma Toren | Hammer Tank, Veldmech, Luchtschip | Terror Drone, Aanvalshond |
| Raketbatterij | Hammer Tank, Hazmat-trooper | Aanvalshond, Terror Drone |
| Railgun | Hammer Tank, Hazmat-trooper, Luchtschip | Conscript, Aanvalshond, Terror Drone |
| Golfkanon | Conscript, Aanvalshond | Hammer Tank, Luchtschip |

De Commandopost heeft geen matchups.
