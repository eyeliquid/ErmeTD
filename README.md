# Red Alert Towerdefense

Een towerdefense game geïnspireerd door Red Alert 3: een 3D-wereld waar je in third-person doorheen loopt met een held, je eigen weg en torens bouwt, en samen met andere spelers 100 levels probeert te overleven.

Het spel bestaat uit een frontend (de pagina in de browser) en een backend (een server met accounts, opgeslagen voortgang, het leaderboard en de gezamenlijke lobby).

## Starten

Nodig: [Node.js](https://nodejs.org) 22.13 of nieuwer.

```bash
npm install
npm start
```

Open daarna <http://localhost:3000>. Open het adres in een tweede venster om met twee spelers te testen.

Met Docker kan het ook:

```bash
docker compose up -d --build
```

## Opbouw

```
client/                 frontend: gewone bestanden, geen bouwstap
  index.html            de pagina
  admin.html            de webadmin (met css/admin.css en js/admin.js)
  css/style.css         opmaak
  js/config.js          adres van de backend (leeg = dezelfde server)
  js/engine.js          spelregels: torens, vijanden, golven, skills
  js/net.js             alle communicatie met de backend
  js/game.js            3D-wereld, bediening, lobby, minigames
  vendor/three.min.js   three.js r128
server/                 backend: Node.js, Express, WebSocket, SQLite
  src/index.js          startpunt: API, lobby en de frontend
  src/api.js            HTTP-API onder /api
  src/room.js           realtime lobby op /ws
  src/auth.js           wachtwoorden en sessies
  src/admin.js          beheer-API onder /api/admin
  src/settings.js       spelinstellingen uit de webadmin
  src/db.js             database en migraties
  src/validate.js       controle van wat spelers insturen
  test/                 tests van de API en de lobby
docs/game-design.md     het oorspronkelijke game design document
```

De server serveert ook de frontend, dus één adres is genoeg. `engine.js` wordt door beide kanten gebruikt: de browser speelt ermee, de server controleert er opgeslagen voortgang mee.

## Hoe het online werkt

- **Accounts.** Een roepnaam met een wachtwoord. Wachtwoorden worden met scrypt gehasht. Na inloggen krijgt de browser een sessietoken; in de database staat alleen de hash daarvan. Er is geen e-mailadres en dus ook geen wachtwoordherstel.
- **Voortgang.** Skillpunten, skills, held en aantal potjes staan per account op de server en gaan mee naar elk apparaat. Een gast speelt alleen lokaal.
- **Leaderboard.** De beste score per account. Een nieuwe score verschijnt direct bij iedereen die online is.
- **Lobby en samen spelen.** Elke browser houdt een WebSocket open. De server houdt per speler een stukje toestand bij (lobbystatus, vesting, held, minigamescore) en stuurt wijzigingen 20 keer per seconde gebundeld door. Chatberichten gaan ook via de server; de laatste zestig blijven bewaard.
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

## Ontwikkelen

```bash
npm run dev     # server die herstart na elke wijziging
npm test        # tests van de API en de lobby
```

Open de pagina met `#dev` achter het adres om de testhulpmiddelen in `window.__ratd` beschikbaar te maken.

Het startgoud staat nog op een testwaarde (10.000). Zet het in de webadmin onder Instellingen op 260 voor de definitieve versie.
