// ErmeTD · de wereld
// Waar de vestingen van een map liggen, welke bruggen ze verbinden en waar een doorgelaten vijand heen loopt.
// De indeling zelf staat per map in data/maps.js (veld world); dit bestand rekent hem uit. Het draait ook op de server (tests).
const World=(()=>{
'use strict';
const D=typeof module!=='undefined'&&module.exports&&typeof require==='function'?require('./data/maps.js'):window.ERME;
const N=D.N,FW=20; // een vesting is N bij N vakken; FW is de standaardafstand van de ene vesting tot de volgende
// De punten net binnen de vier poorten van een vesting, vanaf de linkerbovenhoek van het speelveld. Hier beginnen de bruggen.
const GATE={e:[13.36,6.5],w:[-.36,6.5],s:[8.5,13.36],n:[8.5,-.36]};
const OUT={e:[1,0],w:[-1,0],s:[0,1],n:[0,-1]};

// Een brug van poort ga van vesting a naar poort gb van vesting b. Liggen de poorten niet recht tegenover elkaar, dan gaat de brug eerst
// een stukje recht naar buiten, dan schuin over het water en het laatste stuk weer recht de poort in.
function bridge(pa,ga,pb,gb){const p=[pa[0]+GATE[ga][0],pa[1]+GATE[ga][1]],q=[pb[0]+GATE[gb][0],pb[1]+GATE[gb][1]];
  if(Math.abs(p[0]-q[0])<.01||Math.abs(p[1]-q[1])<.01)return[p,q];
  const S=2.5,o=OUT[ga],i=OUT[gb];return[p,[p[0]+o[0]*S,p[1]+o[1]*S],[q[0]+i[0]*S,q[1]+i[1]*S],q];}
// Welke poort van a naar b wijst: de richting die het meest overeenkomt.
function gatesFor(pa,pb){const dx=pb[0]-pa[0],dz=pb[1]-pa[1];return Math.abs(dx)>=Math.abs(dz)?(dx>0?['e','w']:['w','e']):(dz>0?['s','n']:['n','s']);}

// Bouwt de indeling van map M. Geeft:
//  n        aantal vestingen (en dus spelers)
//  pos      per vesting de linkerbovenhoek van het speelveld [x, z]
//  bridges  lijnen [[x,z], [x,z], …] waar een brug ligt
//  next     per vesting de vestingen waar een doorgelaten vijand heen gaat (om en om als het er meer zijn)
//  hub      het midden van de wereld als daar iets moet staan (de reactor van een ring), anders null
//  box      de rand van de wereld: [x0, z0, x1, z1]
function build(M){const w=(M&&M.world)||{kind:'grid',cols:5,rows:5},pos=[],links=[],next=[];let hub=null;
  if(w.kind==='grid'){const dx=FW*(w.dx||1),dz=FW*(w.dz||1),E=(w.links||'ES').includes('E'),S=(w.links||'ES').includes('S');
    for(let r=0;r<w.rows;r++)for(let c=0;c<w.cols;c++){const s=r*w.cols+c;pos[s]=[c*dx,r*dz];next[s]=[];
      if(E&&c<w.cols-1)links.push([s,s+1]);if(S&&r<w.rows-1)links.push([s,s+w.cols]);
      if(M.pass==='row'&&c<w.cols-1)next[s].push(s+1);if(M.pass==='col'&&r<w.rows-1)next[s].push(s+w.cols);}}
  else if(w.kind==='pyramid'){ // rijen van breed naar smal; elke vesting geeft door aan de één of twee vestingen schuin eronder
    const dx=FW*(w.dx||1),dz=FW*(w.dz||1.5),start=[];let s=0;
    w.rows.forEach((k,r)=>{start[r]=s;for(let i=0;i<k;i++){pos[s]=[(i+r/2)*dx,r*dz];next[s]=[];s++;}});
    w.rows.forEach((k,r)=>{if(r===w.rows.length-1)return;const kn=w.rows[r+1];
      for(let i=0;i<k;i++)for(const j of[i-1,i])if(j>=0&&j<kn){const a=start[r]+i,b=start[r+1]+j;next[a].push(b);links.push([a,b,'s','n']);}});}
  else if(w.kind==='ring'){ // de rand van een vierkant van side bij side, met de klok mee; in het midden is plaats voor de hub
    const side=w.side,d=FW*(w.dx||1),cells=[];
    for(let c=0;c<side;c++)cells.push([c,0]);for(let r=1;r<side;r++)cells.push([side-1,r]);for(let c=side-2;c>=0;c--)cells.push([c,side-1]);for(let r=side-2;r>0;r--)cells.push([0,r]);
    cells.forEach(([c,r],s)=>{pos[s]=[c*d,r*d];next[s]=[];});
    for(let s=0;s<cells.length;s++)links.push([s,(s+1)%cells.length]);
    hub=[(side-1)*d/2+N/2,(side-1)*d/2+N/2];}
  const bridges=links.map(([a,b,ga,gb])=>{if(!ga)[ga,gb]=gatesFor(pos[a],pos[b]);return bridge(pos[a],ga,pos[b],gb);});
  let x0=1e9,z0=1e9,x1=-1e9,z1=-1e9;for(const[x,z]of pos){x0=Math.min(x0,x);z0=Math.min(z0,z);x1=Math.max(x1,x+N);z1=Math.max(z1,z+N);}
  return{n:pos.length,pos,bridges,next,hub,box:[x0,z0,x1,z1]};}

// Ligt (x, z) op een brug? Een brug is 1,3 breed om op te lopen.
function onBridge(L,x,z){for(const b of L.bridges)for(let i=0;i+1<b.length;i++){const[ax,az]=b[i],[bx,bz]=b[i+1],vx=bx-ax,vz=bz-az,l2=vx*vx+vz*vz||1,
    t=Math.max(0,Math.min(1,((x-ax)*vx+(z-az)*vz)/l2)),dx=ax+vx*t-x,dz=az+vz*t-z;if(dx*dx+dz*dz<=.65*.65)return true;}return false;}

return{build,onBridge,GATE,FW};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=World;
