// ErmeTD · talenten
// De twee talentbomen: T = torens (links), H = held (rechts). Wat een talent precies doet, rekent mods in engine.js uit;
// de tekst hier is wat de speler ziet.
(function(ERME){
'use strict';

//  id     sleutel (staat in opgeslagen voortgang: niet hernoemen)
//  tree   'T' of 'H'      t  rij (0-6, gaat open bij 5×t punten in die boom)      c  kolom (0-3)
//  max    aantal rangen   v  waarde per rang, komt op {v} in de tekst                req  talent dat eerst vol moet zijn
//  ic     icoon (zie iconDraw in game.js)
ERME.SKILLS=[
 {id:'dmg',tree:'T',t:0,c:0,max:5,ic:'blast',n:'Holle punten',d:'+{v}% schade voor alle torens',v:3},
 {id:'bulk',tree:'T',t:0,c:1,max:5,ic:'crate',n:'Massaproductie',d:'Torens bouwen {v}% goedkoper',v:2.5},
 {id:'chest',tree:'T',t:0,c:2,max:3,ic:'coin',n:'Oorlogskas',d:'+{v} startcredits',v:50},
 {id:'rate',tree:'T',t:1,c:0,max:5,ic:'clock',n:'Overklok',d:'+{v}% vuursnelheid',v:2.5},
 {id:'bounty',tree:'T',t:1,c:1,max:5,ic:'coin',n:'Oorlogsbuit',d:'+{v}% credits per kill',v:4},
 {id:'fort',tree:'T',t:1,c:3,max:4,ic:'shield',n:'Versterkte basis',d:'+{v} levens',v:2},
 {id:'range',tree:'T',t:2,c:0,max:5,ic:'cross',n:'Lange optiek',d:'+{v}% bereik',v:2},
 {id:'engineer',tree:'T',t:2,c:1,max:3,ic:'wrench',n:'Ingenieurskorps',d:'Upgrades {v}% goedkoper',v:5},
 {id:'freeze',tree:'T',t:2,c:2,max:3,ic:'snow',n:'Diepvries',d:'Bevriezing duurt {v}% langer',v:12},
 {id:'toxin',tree:'T',t:2,c:3,max:3,ic:'drop',n:'Neurotoxine',d:'Gif doet {v}% meer schade en vertraagt sterker',v:14},
 {id:'ap',tree:'T',t:3,c:0,max:5,ic:'sword',n:'Pantserbrekers',d:'Negeert {v}% van vijandelijk pantser',v:10},
 {id:'bonus',tree:'T',t:3,c:1,max:4,ic:'up',n:'Frontpremie',d:'+{v}% rondebonus',v:10},
 {id:'splash',tree:'T',t:3,c:2,max:4,ic:'blast',n:'Brede lading',d:'Explosies {v}% groter',v:5},
 {id:'salvage',tree:'T',t:3,c:3,max:2,ic:'wrench',n:'Sloopdienst',d:'Verkopen levert {v}% meer op',v:10},
 {id:'link',tree:'T',t:4,c:0,max:5,ic:'link',n:'Ultra-versterker',d:'De ultra-bonus is {v}% sterker',v:10},
 {id:'interest',tree:'T',t:4,c:1,max:5,ic:'coin',n:'Oorlogsobligaties',d:'{v}% rente op je credits na elke ronde (max 100)',v:1},
 {id:'turbo',tree:'T',t:4,c:2,max:5,ic:'bolt',n:'Turbo-injectie',d:'Turbo {v}% goedkoper',v:5},
 {id:'repair',tree:'T',t:4,c:3,max:2,ic:'plus',n:'Reparatieploeg',d:'+{v} leven na elke 10 rondes',v:1},
 {id:'boss',tree:'T',t:5,c:1,max:5,ic:'skull',n:'Bazenjager',d:'Torens doen +{v}% schade tegen bazen',v:6},
 {id:'overdrive',tree:'T',t:5,c:2,max:5,ic:'star',n:'Turbo-overdrive',d:'Turbo torens doen {v}% meer schade',v:7,req:'turbo'},
 {id:'war',tree:'T',t:6,c:1,max:1,ic:'trophy',n:'Totale oorlog',d:'Alle torens: +10% schade en +10% vuursnelheid',v:0,req:'boss'},
 {id:'hdmg',tree:'H',t:0,c:0,max:5,ic:'sword',n:'Wapentraining',d:'Je held doet +{v}% schade',v:4},
 {id:'hhp',tree:'H',t:0,c:1,max:5,ic:'heart',n:'Taai',d:'+{v}% levenspunten voor je held',v:5},
 {id:'hspd',tree:'H',t:0,c:2,max:5,ic:'boot',n:'Snelle voeten',d:'Je held loopt {v}% sneller',v:2},
 {id:'pushr',tree:'H',t:0,c:3,max:3,ic:'dodge',n:'Brede schouders',d:'Duwen duwt andere spelers {v}% verder weg',v:15},
 {id:'hrate',tree:'H',t:1,c:0,max:5,ic:'clock',n:'Vuurdiscipline',d:'Je held valt {v}% sneller aan',v:3},
 {id:'harm',tree:'H',t:1,c:1,max:5,ic:'shield',n:'Dikke huid',d:'Je held krijgt {v}% minder schade',v:3},
 {id:'sprint',tree:'H',t:1,c:2,max:3,ic:'boot',n:'Lange adem',d:'Sprint duurt {v} seconde langer',v:.5},
 {id:'hrange',tree:'H',t:1,c:3,max:3,ic:'cross',n:'Verrekijker',d:'+{v}% bereik voor je held',v:4},
 {id:'hap',tree:'H',t:2,c:0,max:3,ic:'bolt',n:'Pantserdoorn',d:'Aanvallen van je held negeren {v}% pantser',v:15},
 {id:'hregen',tree:'H',t:2,c:1,max:3,ic:'plus',n:'Tweede adem',d:'In missies en de arena herstelt je held {v}% levenspunten per seconde',v:.5},
 {id:'hgold',tree:'H',t:2,c:2,max:3,ic:'coin',n:'Premiejager',d:'Kills door je held leveren {v}% extra credits op',v:10},
 {id:'hboss',tree:'H',t:2,c:3,max:5,ic:'skull',n:'Bazenbreker',d:'Je held doet +{v}% schade tegen bazen en de Kolos',v:5},
 {id:'hcrit',tree:'H',t:3,c:0,max:5,ic:'blast',n:'Zwakke plek',d:'{v}% kans op een kritieke treffer met dubbele schade',v:4},
 {id:'hdodge',tree:'H',t:3,c:1,max:3,ic:'dodge',n:'Scherpe reflexen',d:'{v}% kans om een treffer te ontwijken',v:5},
 {id:'shdur',tree:'H',t:3,c:2,max:3,ic:'shield',n:'Schildgenerator',d:'Je schild op het parcours houdt {v} seconde langer stand',v:.5},
 {id:'hpvp',tree:'H',t:3,c:3,max:5,ic:'sword',n:'Arenavechter',d:'+{v}% schade tegen monsters en torens in minigames',v:4},
 {id:'hcritd',tree:'H',t:4,c:0,max:3,ic:'star',n:'Dodelijke precisie',d:'Kritieke treffers doen nog eens {v}% extra schade',v:25,req:'hcrit'},
 {id:'sprintcd',tree:'H',t:4,c:1,max:3,ic:'clock',n:'Snel op adem',d:'Sprint laadt {v} seconde sneller op',v:1},
 {id:'shcd',tree:'H',t:4,c:2,max:3,ic:'clock',n:'Snelle lader',d:'Je schild laadt {v} seconde sneller op',v:1,req:'shdur'},
 {id:'mission',tree:'H',t:4,c:3,max:3,ic:'up',n:'Missiepremie',d:'+{v} credits als je een missie of de arena wint',v:150},
 {id:'leech',tree:'H',t:5,c:0,max:3,ic:'drop',n:'Bloeddorst',d:'Zolang je held aanvalt herstelt hij {v}% levenspunten per seconde',v:1},
 {id:'second',tree:'H',t:5,c:1,max:1,ic:'heart',n:'Tweede kans',d:'Eén keer per missie staat je held na een dodelijke klap weer op met 30% levenspunten. Werkt niet tegen de ultra-aanval van de Kolos.',v:0},
 {id:'pushcd',tree:'H',t:5,c:2,max:2,ic:'clock',n:'Elleboogwerk',d:'Duwen laadt {v} seconde sneller op',v:1},
 {id:'sprintspd',tree:'H',t:5,c:3,max:3,ic:'bolt',n:'Naverbrander',d:'Sprint geeft nog eens {v}% extra snelheid',v:10},
 {id:'legend',tree:'H',t:6,c:1,max:1,ic:'trophy',n:'Legende',d:'Je held: +15% schade, +15% levenspunten en +10% snelheid',v:0,req:'second'}
];

})(typeof module!=='undefined'&&module.exports?module.exports:(window.ERME=window.ERME||{}));
