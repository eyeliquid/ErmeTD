// ErmeTD · texturen
// Alle texturen worden in de browser getekend op een canvas; er zijn geen plaatjes. Elke functie geeft canvassen terug,
// game.js maakt er three.js-texturen van. De kleuren komen uit een thema (data/themes.js).
const Textures=(()=>{
'use strict';
function lcg(seed){let s=seed;return()=>(s=(s*16807)%2147483647)/2147483647;}
function mk(S){const c=document.createElement('canvas');c.width=c.height=S;return[c,c.getContext('2d')];}
const rgba=(hex,a)=>{const v=parseInt(hex.slice(1),16);return`rgba(${v>>16&255},${v>>8&255},${v&255},${a})`;};

// Vlekken: zachte cirkels in de kleuren van pal.
function blobs(g,S,r,pal,n,rad0,rad1,alpha){g.globalAlpha=alpha;
  for(let i=0;i<n;i++){const x=r()*S,y=r()*S,rad=rad0+r()*(rad1-rad0),gr=g.createRadialGradient(x,y,0,x,y,rad),c=pal[r()*pal.length|0];
    gr.addColorStop(0,c);gr.addColorStop(1,c+'00');g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);}
  g.globalAlpha=1;}
function grid(g,S,N,col,w){const u=S/N;g.strokeStyle=col;g.lineWidth=w;g.beginPath();for(let i=1;i<N;i++){g.moveTo(i*u,0);g.lineTo(i*u,S);g.moveTo(0,i*u);g.lineTo(S,i*u);}g.stroke();}
function vignette(g,S,a){const vg=g.createRadialGradient(S/2,S/2,S*.35,S/2,S/2,S*.75);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,`rgba(0,0,0,${a})`);g.fillStyle=vg;g.fillRect(0,0,S,S);}

// ---------- vaste texturen: metaal en metselwerk ----------
function grunge(){const[cv,g]=mk(256),r=lcg(11);g.fillStyle='#cfcfcf';g.fillRect(0,0,256,256);
  for(let i=0;i<2600;i++){const v=140+r()*110|0;g.fillStyle=`rgba(${v},${v},${v},.25)`;g.fillRect(r()*256,r()*256,1+r()*4,1+r()*4);}
  for(let i=0;i<26;i++){g.fillStyle=`rgba(40,36,30,${.05+r()*.1})`;g.beginPath();g.arc(r()*256,r()*256,10+r()*40,0,7);g.fill();}
  g.strokeStyle='rgba(20,20,20,.55)';g.lineWidth=5;g.strokeRect(6,6,244,244);g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1.5;g.strokeRect(11,11,234,234);
  for(const[x,y]of[[20,20],[236,20],[20,236],[236,236],[128,20],[128,236]]){g.fillStyle='#555';g.beginPath();g.arc(x,y,4,0,7);g.fill();g.fillStyle='#eee';g.beginPath();g.arc(x-1,y-1,1.5,0,7);g.fill();}
  for(let i=0;i<16;i++){g.strokeStyle=r()>.5?'rgba(255,255,255,.3)':'rgba(0,0,0,.3)';g.lineWidth=1;const x=r()*256,y=r()*256;g.beginPath();g.moveTo(x,y);g.lineTo(x+(r()-.5)*70,y+(r()-.5)*70);g.stroke();}
  return cv;}
function masonry(){const[cv,g]=mk(256),r=lcg(5);g.fillStyle='#4a4a4a';g.fillRect(0,0,256,256);
  for(let row=0;row<8;row++)for(let i=-1;i<4;i++){const x=i*64+(row%2?32:0),v=150+r()*75|0;g.fillStyle=`rgb(${v},${v},${v+6})`;g.fillRect(x+2,row*32+2,60,28);
    g.fillStyle='rgba(255,255,255,.12)';g.fillRect(x+2,row*32+2,60,3);g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x+2,row*32+26,60,4);}
  for(let i=0;i<2200;i++){g.fillStyle=r()>.5?'rgba(255,255,255,.08)':'rgba(0,0,0,.14)';g.fillRect(r()*256,r()*256,2,2);}
  for(let i=0;i<14;i++){g.fillStyle=`rgba(30,40,20,${.08+r()*.1})`;g.beginPath();g.arc(r()*256,r()*256,8+r()*26,0,7);g.fill();}
  return cv;}
function halo(){const[cv,g]=mk(128),gr=g.createRadialGradient(64,64,0,64,64,64);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.55)');gr.addColorStop(.6,'rgba(255,255,255,.14)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,128,128);return cv;}

// ---------- de grond van een vesting: [kleur, reliëf] ----------
// th = theme.ground, N = vakken per kant
function ground(th,N){const S=2048,[cv,g]=mk(S),[bv,b]=mk(S/2),u=S/N,r=lcg(7),kind=th.kind||'grass';b.scale(.5,.5);
  g.fillStyle=th.base;g.fillRect(0,0,S,S);b.fillStyle='#707070';b.fillRect(0,0,S,S);
  const blades=(n,l,d)=>{for(let i=0;i<n;i++){const x=r()*S,y=r()*S,li=r()>.5;g.fillStyle=li?l:d;g.fillRect(x,y,1+r()*3,2+r()*5);b.fillStyle=li?'rgba(255,255,255,.2)':'rgba(0,0,0,.2)';b.fillRect(x,y,3,5);}};
  if(kind==='grass'||kind==='lawn'||kind==='meadow'){
    blobs(g,S,r,th.pal,420,40,210,.55);
    if(kind==='lawn')for(let i=0;i<N;i++){g.fillStyle=i%2?'rgba(255,255,255,.07)':'rgba(0,0,0,.08)';g.fillRect(i*u,0,u,S);} // gemaaide banen
    blades(60000,th.blade[0],th.blade[1]);
    if(kind==='meadow')for(let i=0;i<1800;i++){const x=r()*S,y=r()*S,c=th.flowers[r()*th.flowers.length|0];g.fillStyle=c;g.beginPath();g.arc(x,y,2+r()*2.5,0,7);g.fill();g.fillStyle='rgba(255,230,120,.8)';g.fillRect(x-.8,y-.8,1.6,1.6);}
    grid(g,S,N,'rgba(0,0,0,.13)',2);vignette(g,S,.4);}
  else if(kind==='snow'){
    blobs(g,S,r,th.pal,380,50,240,.6);
    for(let i=0;i<30000;i++){const x=r()*S,y=r()*S;g.fillStyle=r()>.7?'rgba(120,150,190,.12)':'rgba(255,255,255,.35)';g.fillRect(x,y,1+r()*3,1+r()*3);b.fillStyle=r()>.5?'rgba(255,255,255,.15)':'rgba(0,0,0,.12)';b.fillRect(x,y,4,4);}
    for(let i=0;i<900;i++){g.fillStyle='rgba(255,255,255,.95)';g.fillRect(r()*S,r()*S,1.5,1.5);} // glinstering
    grid(g,S,N,'rgba(70,100,140,.12)',2);vignette(g,S,.18);}
  else if(kind==='metal'){
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const c=th.pal[(x*7+y*3)%th.pal.length];g.fillStyle=c;g.fillRect(x*u+3,y*u+3,u-6,u-6);
      g.fillStyle='rgba(255,255,255,.05)';g.fillRect(x*u+3,y*u+3,u-6,4);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x*u+3,y*u+u-7,u-6,4);
      for(const[px,py]of[[10,10],[u-10,10],[10,u-10],[u-10,u-10]]){g.fillStyle='#3a444e';g.beginPath();g.arc(x*u+px,y*u+py,3.5,0,7);g.fill();}
      b.fillStyle='#8a8a8a';b.fillRect(x*u+4,y*u+4,u-8,u-8);if(r()<.35){g.strokeStyle='rgba(255,255,255,.05)';g.lineWidth=1;for(let k=0;k<6;k++){g.beginPath();const yy=y*u+8+r()*(u-16);g.moveTo(x*u+8,yy);g.lineTo(x*u+u-8,yy);g.stroke();}}}
    for(let i=0;i<14000;i++){g.fillStyle=r()>.5?'rgba(255,255,255,.04)':'rgba(0,0,0,.1)';g.fillRect(r()*S,r()*S,2,2);}
    g.shadowColor=th.glow;g.shadowBlur=14;grid(g,S,N,rgba(th.glow,.55),2.5);g.shadowBlur=0;vignette(g,S,.45);}
  return[cv,bv];}

// ---------- de weg en het pad over het gras: [weg, reliëf weg, pad] ----------
function road(th,trail,trailGlow){const S=256,[cv,g]=mk(S),[bv,b]=mk(S),[tv,t]=mk(S),r=lcg(13),kind=th.kind||'cobble';
  g.fillStyle='#241a16';g.fillRect(0,0,S,S);b.fillStyle='#3a3a3a';b.fillRect(0,0,S,S);
  const shade=(hex,q)=>{const v=parseInt(hex.slice(1),16),f=.75+q*.5;return`rgb(${Math.min(255,(v>>16&255)*f)|0},${Math.min(255,(v>>8&255)*f)|0},${Math.min(255,(v&255)*f)|0})`;};
  if(kind==='cobble'){ // bakstenen in verband (de oorspronkelijke weg)
    for(let row=0;row<8;row++)for(let i=-1;i<4;i++){const x=i*64+(row%2?32:0),y=row*32,q=r(),v=150+q*50|0;
      g.fillStyle=r()<.12?shade(th.b,q):shade(th.a,q);g.fillRect(x+2,y+2,60,28);b.fillStyle=`rgb(${v},${v},${v})`;b.fillRect(x+3,y+3,58,26);}
    for(let i=0;i<9;i++){const x=r()*S,y=r()*S,rad=20+r()*50,gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,'rgba(10,8,8,.3)');gr.addColorStop(1,'rgba(10,8,8,0)');g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);}}
  else if(kind==='flagstone'){ // grote, onregelmatige stenen
    g.fillStyle='#2a2622';g.fillRect(0,0,S,S);
    for(let i=0;i<46;i++){const x=r()*S,y=r()*S,w=34+r()*30,h=28+r()*26,q=r();g.fillStyle=shade(r()<.25?th.b:th.a,q);g.beginPath();g.ellipse(x,y,w/2,h/2,r()*3,0,7);g.fill();
      b.fillStyle=`rgb(${170+q*60|0},${170+q*60|0},${170+q*60|0})`;b.beginPath();b.ellipse(x,y,w/2-3,h/2-3,0,0,7);b.fill();}
    for(let i=0;i<500;i++){g.fillStyle=r()>.5?'rgba(255,255,255,.06)':'rgba(0,0,0,.18)';g.fillRect(r()*S,r()*S,2,2);}}
  else if(kind==='asphalt'){
    g.fillStyle=th.a;g.fillRect(0,0,S,S);
    for(let i=0;i<5000;i++){const v=r();g.fillStyle=v>.6?'rgba(200,200,200,.12)':'rgba(0,0,0,.2)';g.fillRect(r()*S,r()*S,1+r()*2,1+r()*2);b.fillStyle=v>.5?'#9a9a9a':'#5a5a5a';b.fillRect(r()*S,r()*S,2,2);}
    for(let i=0;i<4;i++){g.fillStyle='rgba(10,10,12,.22)';g.fillRect(40+i*55+r()*10,0,10+r()*6,S);}} // bandensporen
  else if(kind==='plate'){ // metalen platen met een lichtende rand
    g.fillStyle=th.a;g.fillRect(0,0,S,S);g.fillStyle='rgba(255,255,255,.05)';g.fillRect(12,12,S-24,S-24);
    for(let i=0;i<1500;i++){g.fillStyle=r()>.5?'rgba(255,255,255,.04)':'rgba(0,0,0,.14)';g.fillRect(r()*S,r()*S,2,2);}
    g.shadowColor=th.b;g.shadowBlur=12;g.strokeStyle=th.b;g.lineWidth=5;g.strokeRect(8,8,S-16,S-16);g.shadowBlur=0;
    for(const s of[-1,1]){g.fillStyle=rgba(th.b,.35);g.beginPath();g.moveTo(S/2-40,S/2+s*0);g.lineTo(S/2,S/2-s*30);g.lineTo(S/2+40,S/2);g.lineTo(S/2,S/2-s*10);g.fill();}
    b.fillStyle='#808080';b.fillRect(10,10,S-20,S-20);}
  else if(kind==='snow'){ // aangestampte sneeuw met sporen
    g.fillStyle=th.a;g.fillRect(0,0,S,S);
    for(let i=0;i<3000;i++){g.fillStyle=r()>.5?'rgba(255,255,255,.25)':rgba(th.b,.35);g.fillRect(r()*S,r()*S,1+r()*3,1+r()*3);}
    for(let i=0;i<10;i++){g.fillStyle=rgba(th.b,.4);const x=r()*S,y=r()*S;g.beginPath();g.ellipse(x,y,7,11,r(),0,7);g.fill();b.fillStyle='#606060';b.beginPath();b.ellipse(x,y,7,11,0,0,7);b.fill();}}
  // het pad over het gras
  const gr=t.createRadialGradient(S/2,S/2,30,S/2,S/2,S*.72);gr.addColorStop(0,trail[0]);gr.addColorStop(1,trail[1]);t.fillStyle=gr;t.fillRect(0,0,S,S);
  if(trailGlow){t.strokeStyle='rgba(180,255,210,.55)';t.lineWidth=3;t.strokeRect(4,4,S-8,S-8);}
  else for(let i=0;i<1100;i++){t.fillStyle=r()>.5?'rgba(255,255,255,.12)':'rgba(26,20,12,.3)';t.fillRect(r()*S,r()*S,2+r()*5,2+r()*3);}
  return[cv,bv,tv];}

// ---------- de zee ----------
function sea(th){const S=256,[cv,g]=mk(S),r=lcg(3),kind=th.kind||'water';g.fillStyle=th.base;g.fillRect(0,0,S,S);
  for(let i=0;i<50;i++){g.fillStyle=`rgba(${r()>.5?th.light:th.dark},${th.blobs==null?.22:th.blobs})`;g.beginPath();g.arc(r()*S,r()*S,10+r()*30,0,7);g.fill();}
  if(kind==='water')for(let i=0;i<90;i++){const x=r()*S,y=r()*S,w=10+r()*26;g.strokeStyle=`rgba(${th.wave},${.04+r()*.1})`;g.lineWidth=1+r();
    for(const ox of[-S,0,S]){g.beginPath();g.moveTo(x+ox,y);g.quadraticCurveTo(x+ox+w/2,y-4,x+ox+w,y);g.stroke();}}
  else if(kind==='ice'){ // ijsschotsen en barsten
    for(let i=0;i<14;i++){g.fillStyle=`rgba(${th.wave},${.2+r()*.25})`;g.beginPath();const x=r()*S,y=r()*S,n=5+r()*3|0;for(let k=0;k<n;k++){const an=k/n*6.28,d=12+r()*22;k?g.lineTo(x+Math.cos(an)*d,y+Math.sin(an)*d):g.moveTo(x+Math.cos(an)*d,y+Math.sin(an)*d);}g.fill();}
    g.strokeStyle=`rgba(${th.dark},.45)`;g.lineWidth=1;for(let i=0;i<24;i++){let x=r()*S,y=r()*S;g.beginPath();g.moveTo(x,y);for(let k=0;k<4;k++){x+=(r()-.5)*40;y+=(r()-.5)*40;g.lineTo(x,y);}g.stroke();}}
  else if(kind==='void'){ // de leegte met een lichtend raster
    g.strokeStyle=`rgba(${th.wave},.35)`;g.lineWidth=1.5;g.beginPath();for(let i=0;i<=S;i+=64){g.moveTo(i,0);g.lineTo(i,S);g.moveTo(0,i);g.lineTo(S,i);}g.stroke();
    for(let i=0;i<60;i++){g.fillStyle=`rgba(${th.wave},${r()*.6})`;g.fillRect(r()*S,r()*S,1.5,1.5);}}
  return cv;}

// Een klein voorbeeld van de grond, de weg en het pad: voor de kaartjes in de lobby.
function swatch(th){return{ground:th.ground.base,road:th.road.a,trail:th.trail[0],accent:th.ui.accent,sea:th.sea.base};}

return{lcg,grunge,masonry,halo,ground,road,sea,swatch};
})();
