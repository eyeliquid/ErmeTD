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
const at=(x,y)=>y*N+x,LEFT=y=>at(0,y),RIGHT=y=>at(N-1,y),TOP=x=>at(x,0),BOTTOM=x=>at(x,N-1);
const C_IN=LEFT(MID),C_OUT=RIGHT(MID);
ERME.C_IN=C_IN;ERME.C_OUT=C_OUT;

// De ring van Groene Cirkel: de rand van het vierkant van (2,2) tot (10,10). De vijand komt links binnen en stapt bij (2,6) op de ring.
const RING=(()=>{const c=[at(0,MID),at(1,MID)],L=2,R=N-3;
  for(let y=MID;y>=L;y--)c.push(at(L,y));for(let x=L+1;x<=R;x++)c.push(at(x,L));
  for(let y=L+1;y<=R;y++)c.push(at(R,y));for(let x=R-1;x>=L;x--)c.push(at(x,R));for(let y=R-1;y>MID;y--)c.push(at(L,y));
  return c;})();
ERME.RING=RING;

// De velden van een map:
//  id, n, k, d  sleutel, naam, soort en uitleg in de lobby
//  theme        het thema uit data/themes.js: hoe de map eruitziet en klinkt
//  in, out      het vak aan de rand waar de vijand binnenkomt en weggaat (out -1: er is geen uitgang).
//               Kies een vak met een opening in de muur: links of rechts op rij MID, boven of onder in kolom GATE.
//  roads        je legt in de bouwfase zelf een weg (anders loopt de vijand over het gras, om je torens heen)
//  maze         je bouwt het doolhof met je torens: ook tijdens het spel, de vijand zoekt meteen een nieuwe weg
//  loop         vaste ring: {cells: de vakken, at: waar de ring begint}. De vijand blijft rondjes lopen, elk rondje kost levens
//  pass         wat erdoor komt loopt door naar de volgende vesting: 'row' naar rechts, 'col' naar beneden
//  pool         alle vestingen delen één levenspot
//  mini         de minigames na elke tiende golf doen mee
// De volgorde hier is de volgorde in de lobby. De eerste is de standaard.
ERME.MAPS={
 classic:{id:'classic',theme:'alarm',n:'Klassiek',k:'Je eigen weg',d:'Zoals je gewend bent: de vijand komt links binnen en gaat rechts weg. In de bouwfase leg je zelf de weg. Met minigames na elke tiende golf.',in:C_IN,out:C_OUT,roads:true,mini:true},
 relay:{id:'relay',theme:'racing',n:'Estafette',k:'Doorlopen',d:'Wat jij doorlaat, loopt verder door de vesting rechts van je. Alleen de laatste vesting op de rij verliest er levens door. Hoe verder rechts, hoe zwaarder het wordt.',in:C_IN,out:C_OUT,roads:true,pass:'row'},
 wintermaul:{id:'wintermaul',theme:'winter',n:'Wintermaul',k:'Samenwerken',d:'De vijand komt boven binnen en zakt van vesting naar vesting naar beneden. Er is geen weg: je bouwt het doolhof met je torens. Iedereen deelt één levenspot; is die leeg, dan verliest het hele team.',in:GATE,out:BOTTOM(GATE),maze:true,pass:'col',pool:true},
 circle:{id:'circle',theme:'scifi',n:'Groene Cirkel',k:'Rondje',d:'De vijand stapt op een vaste ring en blijft rondjes lopen tot hij dood is. Er is geen uitgang: elk rondje dat een vijand afmaakt kost levens. Bouw binnen en buiten de ring.',in:C_IN,out:-1,loop:{cells:RING,at:2}},
 maze:{id:'maze',theme:'knights',n:'Doolhofbouwer',k:'Vrij bouwen',d:'Geen weg en geen vaste route. De vijand komt links binnen en wil onder weg. Je torens zijn je muren: maak zijn weg zo lang mogelijk, ook tijdens een golf.',in:C_IN,out:BOTTOM(GATE),maze:true}
};
})(typeof module!=='undefined'&&module.exports?module.exports:(window.ERME=window.ERME||{}));
