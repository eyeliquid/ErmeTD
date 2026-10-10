# Red Alert Towerdefense

Een towerdefense game geïnspireerd door Red Alert 3: een 3D-wereld waar je in third-person doorheen loopt met een held, je eigen weg en torens bouwt, en samen met andere spelers 100 levels probeert te overleven.

## Inhoud

- `index.html` — het volledige spel in één bestand (HTML, CSS en JavaScript, met three.js r128 via cdnjs).
- `docs/game-design.md` — het oorspronkelijke game design document.

## Spelen

Open `index.html` in een browser. Het 3D-slagveld, bouwen en vechten werken dan lokaal.

De online onderdelen (accounts, leaderboard, lobby en chat met andere spelers) gebruiken de runtime van de gepubliceerde Claude-artifact (`window.claude`). Buiten die omgeving zijn ze niet beschikbaar en valt het spel terug op lokale opslag in de browser. Om het spel zelfstandig te hosten is daarvoor een eigen backend nodig.

## Ontwikkelmodus

Open de pagina met `#dev` achter de URL om de testhulpmiddelen in `window.__ratd` beschikbaar te maken.
