// ErmeTD · maps
// Een map bepaalt hoe de vijand door een vesting loopt (de spelregels). Hoe de map eruitziet, staat in data/themes.js:
// elke map wijst met `theme` naar een thema. Een nieuwe map: kopieer er een, geef hem een eigen id en zet hem in de lijst hieronder.
(function(ERME){
'use strict';

// Een vesting is N bij N vakken. Vak c ligt op kolom c % N en rij floor(c / N); vak 0 is linksboven.
const N=13,MID=6,GATE=8;
ERME.N=N;
ERME.MID=MID;   // de middelste rij: daar zitten de poorten links en rechts in de muur
ERME.GATE=GATE; // de kolom van de openingen in de boven- en ondermuur
const at=(x,y)=>y*N+x,ROW=(y,x0,x1)=>{const o=[];for(let x=x0;x<=x1;x++)o.push(at(x,y));return o;},LEFT=y=>at(0,y),RIGHT=y=>at(N-1,y),TOP=x=>at(x,0),BOTTOM=x=>at(x,N-1);
const C_IN=LEFT(MID),C_OUT=RIGHT(MID);
ERME.C_IN=C_IN;ERME.C_OUT=C_OUT;

// De ring van Groene Cirkel: de rand van het vierkant van (2,2) tot (10,10). De vijand komt links binnen en stapt bij (2,6) op de ring.
const RING=(()=>{const c=[at(0,MID),at(1,MID)],L=2,R=N-3;
  for(let y=MID;y>=L;y--)c.push(at(L,y));for(let x=L+1;x<=R;x++)c.push(at(x,L));
  for(let y=L+1;y<=R;y++)c.push(at(R,y));for(let x=R-1;x>=L;x--)c.push(at(x,R));for(let y=R-1;y>MID;y--)c.push(at(L,y));
  return c;})();
ERME.RING=RING;

// De ijsmuurtjes van Wintermaul: drie muren dwars over het veld, om en om met een opening links en rechts.
// De vijand moet er zigzaggend tussendoor: links langs de bovenste, rechts langs de middelste, links langs de onderste.
// Een weg langs hoekpunten: van [x, y] naar [x, y], telkens recht. Geeft de vakken in volgorde.
const WALK=pts=>{const c=[];pts.forEach(([x,y],i)=>{if(!i){c.push(at(x,y));return;}let[cx,cy]=pts[i-1];while(cx!==x||cy!==y){cx+=Math.sign(x-cx);cy+=Math.sign(y-cy);c.push(at(cx,cy));}});return c;};
// De vier wegen van Zandstorm: uit elke poort kronkelt er een door zijn eigen kwart van de vesting naar de kern in het midden (6, 6).
const CORE=at(MID,MID);
const SANDLANES=[WALK([[0,6],[2,6],[2,10],[5,10],[5,7],[6,7],[6,6]]),            // west
  WALK([[GATE,0],[8,2],[3,2],[3,4],[5,4],[5,5],[6,5],[6,6]]),                     // noord
  WALK([[N-1,6],[10,6],[10,3],[8,3],[8,5],[7,5],[7,6],[6,6]]),                    // oost
  WALK([[GATE,N-1],[8,10],[11,10],[11,8],[8,8],[8,7],[7,7],[6,7],[6,6]])];        // zuid
const ZIGZAG=[...ROW(3,3,N-1),...ROW(6,0,N-4),...ROW(9,3,N-1)];

// De velden van een map:
//  id, n, k, d  sleutel, naam, soort en uitleg in de lobby
//  theme        het thema uit data/themes.js: hoe de map eruitziet en klinkt
//  in, out      het vak aan de rand waar de vijand binnenkomt en weggaat (out -1: er is geen uitgang).
//               Kies een vak met een opening in de muur: links of rechts op rij MID, boven of onder in kolom GATE.
//  roads        je legt in de bouwfase zelf een weg (anders loopt de vijand over het gras, om je torens heen)
//  maze         je bouwt het doolhof met je torens: ook tijdens het spel, de vijand zoekt meteen een nieuwe weg
//  loop         vaste ring: {cells: de vakken, at: waar de ring begint}. De vijand blijft rondjes lopen, elk rondje kost levens
//  pass         wat erdoor komt loopt door naar een volgende vesting: 'row' naar rechts, 'col' naar beneden,
//               'down' naar de vesting(en) schuin eronder in een piramide (bij twee: om en om)
//  world        hoe de vestingen in de wereld liggen (uitgerekend in world.js):
//                 {kind:'grid', cols, rows, dx, dz, links}  een raster; dx/dz = afstand (1 = gewoon), links 'ES' = bruggen naar rechts en onder
//                 {kind:'pyramid', rows:[4,3,2,1], dz}       rijen van breed naar smal, elke rij een halve vesting ingesprongen
//                 {kind:'ring', side, dx}                    de rand van een vierkant, met in het midden plaats voor de hub van de burcht
//               Het aantal vestingen is ook het aantal spelers dat mee kan doen.
//  pool         alle vestingen delen één levenspot
//  lanes        vaste wegen: een lijst van wegen, elk een rij vakken van een poort naar de uitgang. De vijanden verdelen zich om en om.
//               De uitgang (out) mag dan midden in het veld liggen: daar staat de kern van de burcht (stuk core)
//  fly          luchtaanval: de vijand vliegt in een rechte lijn over alles heen, elke golf uit een andere richting
//               (west, noord, oost, zuid). Je kunt overal bouwen; torens houden hem niet tegen
//  duel         één tegen één: van elke derde vijand die je verslaat stuurt het spel een kopie naar je tegenstander.
//               Wie als laatste overeind staat, wint
//  block        vaste muurtjes: vakken waar niemand kan bouwen en waar de vijand omheen moet. Hoe ze eruitzien bepaalt de burcht (block)
//  mini         de minigames na elke tiende golf doen mee
//  hard         hoe zwaar de map is ten opzichte van Klassiek: de levens van elke vijand gaan keer dit getal (weglaten = 1)
// De volgorde hier is de volgorde in de lobby. De eerste is de standaard.
ERME.MAPS={
 classic:{id:'classic',theme:'alarm',n:'Klassiek',k:'Je eigen weg',d:'Zoals je gewend bent: de vijand komt links binnen en gaat rechts weg. In de bouwfase leg je zelf de weg. Met minigames na elke tiende golf.',in:C_IN,out:C_OUT,roads:true,mini:true,world:{kind:'grid',cols:5,rows:5}},
 relay:{id:'relay',hard:1.5,theme:'racing',n:'Estafette',k:'Doorlopen',d:'Vijf losse banen van vijf vestingen. Wat jij doorlaat, loopt verder door de vesting rechts van je. Alleen de laatste vesting op de baan verliest er levens door. Hoe verder rechts, hoe zwaarder het wordt.',in:C_IN,out:C_OUT,roads:true,pass:'row',world:{kind:'grid',cols:5,rows:5,dz:1.45,links:'E'}},
 wintermaul:{id:'wintermaul',hard:2,theme:'winter',n:'Wintermaul',k:'Samenwerken',d:'Tien vestingen in een piramide: 4, 3, 2 en 1. De vijand komt boven binnen en zakt naar de vesting(en) schuin eronder; ligt er een tussen twee in, dan gaat de helft naar links en de helft naar rechts. Alles komt uit bij de onderste. IJsmuurtjes dwingen hem te zigzaggen; met je torens maak je het doolhof nog langer. Iedereen deelt één levenspot; is die leeg, dan verliest het hele team.',in:GATE,out:BOTTOM(GATE),maze:true,block:ZIGZAG,pass:'down',pool:true,world:{kind:'pyramid',rows:[4,3,2,1],dz:1.5}},
 circle:{id:'circle',hard:3,theme:'scifi',n:'Groene Cirkel',k:'Rondje',d:'Twaalf vestingen in een ring rond een reactor. In elke vesting stapt de vijand op een vaste ring en blijft hij rondjes lopen tot hij dood is. Er is geen uitgang: elk rondje dat een vijand afmaakt kost levens. Bouw binnen en buiten de ring.',in:C_IN,out:-1,loop:{cells:RING,at:2},world:{kind:'ring',side:4,dx:1.15}},
 maze:{id:'maze',hard:5,theme:'knights',n:'Doolhofbouwer',k:'Vrij bouwen',d:'Zestien kastelen in een koninkrijk van vier bij vier. Geen weg en geen vaste route. De vijand komt links binnen en wil onder weg. Je torens zijn je muren: maak zijn weg zo lang mogelijk, ook tijdens een golf.',in:C_IN,out:BOTTOM(GATE),maze:true,world:{kind:'grid',cols:4,rows:4,dx:1.2,dz:1.2}},
 sand:{id:'sand',hard:2,theme:'desert',n:'Zandstorm',k:'Belegering',d:'Vier spelers. De vijand komt uit alle vier de poorten tegelijk en volgt vaste wegen die naar de kern midden in je vesting kronkelen. Bewaak alle kanten: wat de kern bereikt, kost levens.',in:SANDLANES[0][0],out:CORE,lanes:SANDLANES,world:{kind:'grid',cols:2,rows:2,dx:1.35,dz:1.35}},
 pirates:{id:'pirates',hard:1.5,theme:'pirates',n:'Kaapvaart',k:'Duel',d:'Twee kapiteins, elk op een eigen schip. Je legt zelf je weg. Van elke derde vijand die je verslaat, stuurt het spel een kopie naar je tegenstander. Wie als laatste overeind staat, wint.',in:C_IN,out:C_OUT,roads:true,duel:true,world:{kind:'grid',cols:2,rows:1,dx:1.9,links:'E'}},
 sky:{id:'sky',hard:1,theme:'sky',n:'Hemelrijk',k:'Luchtaanval',d:'Zes spelers. De vijand vliegt in een rechte lijn over alles heen en komt elke golf uit een andere richting: west, noord, oost en zuid. Je kunt overal bouwen, maar niets houdt hem tegen.',in:C_IN,out:C_OUT,fly:true,world:{kind:'grid',cols:3,rows:2,dx:1.4,dz:1.4}}
};
})(typeof module!=='undefined'&&module.exports?module.exports:(window.ERME=window.ERME||{}));
