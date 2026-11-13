/* =================== PATCH RENDERING =================== */
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const CW=6.6; // char width at 11px mono
const nodeEls={};
function layoutJitter(moduleIndex, axis) {
  const value = Math.sin(moduleIndex * 127.1 + axis * 311.7) * 43758.5453;
  return value - Math.floor(value);
}
function boxW(n){const [,t,, ,txt,len]=n;if(t==='obj'||t==='msg')return Math.max(28,txt.length*CW+10);if(t==='num')return (len||5)*CW+10;if(t==='tgl'||t==='bng')return 18;if(['arr','scope','grid','neck','move','vinyl-record','chord-bars','ribbon-trace'].includes(t))return n[5];return 0;}
function boxH(n){if(['arr','scope','grid','neck','move','vinyl-record','chord-bars','ribbon-trace'].includes(n[1]))return n[6];return 18;}
// draws one module's wires and boxes into an <svg> or <g>; returns the box positions in module coordinates
function drawModule(m,into){
    const pos={};m.nodes.forEach(n=>pos[n[0]]={x:n[2],y:n[3],w:boxW(n),h:boxH(n)});
  const wg=document.createElementNS(NS,'g');into.appendChild(wg);
  m.wires.forEach(([a,b,sig])=>{const A=pos[a],B=pos[b];if(!A||!B)return;const p=document.createElementNS(NS,'path');
    const x1=A.x+3,y1=A.y+A.h,x2=B.x+3,y2=B.y;p.setAttribute('d',wpath(x1,y1,x2,y2));p.setAttribute('class','wire'+(sig?' sig':''));wg.appendChild(p);flow(wg,x1,y1,x2,y2,sig);});
  m.nodes.forEach(n=>{let [id,t,x,y,txt]=n;const w=boxW(n),h=boxH(n),g=document.createElementNS(NS,'g');
    // every voice's on/off cross sits in the same place: the module's top-right corner (in its title bar in WIRES)
    if(t==='tgl'&&id==='tg'){if(WIREMODE){x=284;y=-19;}else{x=278;y=4;}}g.setAttribute('class',t);g.setAttribute('transform',`translate(${x} ${y})`);
    if(t==='vinyl-record')g.innerHTML='<g class="record-platter" aria-hidden="true"><circle cx="54" cy="54" r="51" fill="#161616" stroke="#666"/><g fill="none" stroke="#474747"><circle cx="54" cy="54" r="44"/><circle cx="54" cy="54" r="36"/><circle cx="54" cy="54" r="28"/></g><path d="M24 29a39 39 0 0 1 30-14m30 64a39 39 0 0 1-30 14" fill="none" stroke="#aaa" stroke-width="2"/><circle cx="54" cy="54" r="18" fill="#dededb"/><circle cx="54" cy="54" r="3" fill="#161616"/><path d="M60 44h7" stroke="#161616" stroke-width="2"/></g>';
    if(t==='obj'){g.innerHTML=`<rect width="${w}" height="${h}"/><text x="5" y="13">${txt}</text>`;}
    else if(t==='msg'){g.innerHTML=`<path d="M0 0H${w+6}L${w} 4V${h-4}L${w+6} ${h}H0Z"/><text x="5" y="13">${txt}</text>`;}
    else if(t==='num'){g.innerHTML=`<rect width="${w}" height="${h}" x=".5" y=".5"/><path d="M.5 .5H6L.5 6" fill="#e9e9e7"/><text x="8" y="13">${txt}</text>`;}
    else if(t==='cmt'){g.innerHTML=`<text x="0" y="0">${txt}</text>`;}
    else if(t==='tgl'){g.innerHTML=`<rect width="18" height="18" x=".5" y=".5"/><path d="M4 4L15 15M15 4L4 15"/>`;g.classList.add('click');}
    else if(t==='bng'){g.innerHTML=`<rect width="18" height="18" x=".5" y=".5"/><circle cx="9.5" cy="9.5" r="6.5"/>`;}
    else if(t==='arr'){g.innerHTML=`<rect class="frame" width="${w}" height="${h}" x=".5" y=".5"/><g class="bars"></g>`;}
    else if(t==='neck'){g.innerHTML=`<circle cx="${w/2}" cy="${h/2}" r="${Math.min(w,h)/2-10}" fill="none" style="stroke:var(--cell)"/><g class="dots"></g><path class="poly" fill="none" style="stroke:var(--box)" stroke-width="1.2"/>`;}
    else if(t==='grid'){const rows=PATCH.grids[txt].rows;let h2='';rows.forEach((v,r)=>{h2+=`<text x="0" y="${r*31+19}" style="fill:#8a8a86">${v.toUpperCase().slice(0,4)}</text>`;for(let c=0;c<16;c++)h2+=`<rect class="cell" data-c="${c}" x="${36+c*15.5}" y="${r*31+4}" width="13" height="24" fill="none" style="stroke:var(--cell)"/><rect class="lv" data-r="${r}" data-c="${c}" data-b="${r*31+28}" x="${36+c*15.5}" y="${r*31+28}" width="13" height="0" style="fill:var(--lv)"/>`;});g.innerHTML=h2;}
    else if(t==='move'){g.innerHTML=moveSVG();moveBind(g);}
    else if(t==='scope'){g.innerHTML=`<rect width="${w}" height="${h}" fill="#000"/><path class="scopep" data-w="${w}" data-h="${h}" fill="none" stroke="#e9e9e7" stroke-width="1.3" style="vector-effect:non-scaling-stroke" aria-label="Oscilloscope of the master output"/>`;}
    else if(t==='ribbon-trace'){
      g.innerHTML=`<rect width="${w}" height="${h}" fill="#080808" stroke="var(--edge2)"/><path d="M8 47H276" stroke="#2c2c2c"/><path class="ribbon-pitch-guide" d="M8 ${ribbonRestY}H276M276 ${ribbonRestY-5}v10" fill="none" stroke="#92928e"/><path class="ribbon-contour" fill="#dededa"/>`;
    }
    else if(t==='chord-bars'){
      g.innerHTML=`<rect width="${w}" height="${h}" fill="#080808" stroke="var(--edge2)"/>`
        +Array.from({length:5},(_,i)=>`<rect class="chord-voice" x="${66+i*36}" y="45" width="8" height="4" fill="#e9e9e7"/>`).join('');
      if(m.id==='birds'){
        g.insertAdjacentHTML('beforeend',`<svg class="bird-flock-screen" width="${w}" height="${h}" overflow="hidden" aria-hidden="true" pointer-events="none"><path fill="none" stroke="#dededa" stroke-width="1" stroke-linecap="round"/></svg>`);
      }
    }
    into.appendChild(g);nodeEls[m.id+'.'+id]=g;if(t==='grid')g.dataset.name=txt;
    if(t==='num'&&PATCH.edit&&PATCH.edit[m.id+'.'+id]){numEditor(g,m.id+'.'+id);const h=holds()[m.id+'.'+id];if(h!=null)g.querySelector('text').textContent=fmtN(m.id+'.'+id,h);}
    if(t==='msg'&&PATCH.msgs&&PATCH.msgs[m.id+'.'+id]){const fn=PATCH.msgs[m.id+'.'+id];g.classList.add('click');g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-label',txt);
      const act=e=>{e.stopPropagation();e.preventDefault();flash(m.id+'.'+id);fn();};g.addEventListener('pointerdown',act);g.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter')act(e);});}
    if(t==='tgl'){g.setAttribute('role','switch');g.setAttribute('tabindex','0');g.setAttribute('aria-label',m.masterEffect?m.title+' on/off':m.voice?'Mute or unmute '+m.title:'Play or stop');
      const act=()=>{
        if(m.masterEffect){
          const effect=mstState()[m.masterEffect];
          effect.on=!effect.on;
          MST.apply();
          saveMix();
          paintToggles();
        }else if(m.voice){MUTE[m.voice]=!MUTE[m.voice];paintToggles();}
        else toggleplay();
      };
      g.addEventListener('click',act);g.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();act();}});}
  });
  return pos;
}
let WIREMODE=false,WINDRAG=false,WRW=0,ZOOM=1,WZ=null;
let savedZoom,savedFrame;
try{savedZoom=+localStorage.getItem('ff-patch-zoom')||undefined;savedFrame=localStorage.getItem('ff-app-frame')??undefined;}catch(e){}
const PAN={x:0,y:0};let SPACE=false,SPACED=false;
// the canvas position is remembered across refreshes, like the zoom
try{const p=JSON.parse(localStorage.getItem('ff-patch-pan')||'null');if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){PAN.x=p.x;PAN.y=p.y;}}catch(e){}
let panSaveT=0;
// WIRES is an endless canvas: it fills the window under the bar and pans by transform,
// with or without the top bar
const panMode=()=>WIREMODE;
const appFrame=()=>document.documentElement.dataset.frame?document.body.getBoundingClientRect():{left:0,top:0,right:innerWidth,bottom:innerHeight,width:innerWidth,height:innerHeight};
function fitWires(){const h=$('wires');if(!h||!WIREMODE||h.hidden)return;if(document.body.classList.contains('ui-off')){h.style.height='';return;}
  if(!$('mixView').hidden){
    h.style.height=Math.max(0,$('patchView').getBoundingClientRect().bottom-h.getBoundingClientRect().top)/frameScale()+'px';
    return;
  }
  const frame=appFrame(),top=h.getBoundingClientRect().top;h.style.height=Math.max(document.documentElement.dataset.frame?0:260,(frame.bottom-top)/frameScale()-(document.documentElement.dataset.frame?document.body.scrollTop:scrollY))+'px';}
addEventListener('resize',()=>fitWires());
function applyPan(){const l=$('wpan');if(l)l.style.transform=panMode()?`translate(${PAN.x}px,${PAN.y}px)`:'';
  clearTimeout(panSaveT);panSaveT=setTimeout(()=>{try{localStorage.setItem('ff-patch-pan',JSON.stringify({x:Math.round(PAN.x),y:Math.round(PAN.y)}));}catch(e){}},150);}
function setZoom(z,cx,cy){const old=ZOOM;ZOOM=Math.max(.01,Math.min(2.5,Math.round(z*100)/100));savedZoom=ZOOM;try{localStorage.setItem('ff-patch-zoom',ZOOM);}catch(e){}
  $('zVal').textContent=Math.round(ZOOM*100)+'%';document.documentElement.style.setProperty('--mz',ZOOM);
  if(WIREMODE&&WZ){const host=$('wires'),k=ZOOM/old,ax=cx!=null?cx/frameScale():host.clientWidth/2,ay=cy!=null?cy:innerHeight/2;
    WZ.apply();if(panMode()){const ay2=cy!=null?(cy-host.getBoundingClientRect().top)/frameScale():host.clientHeight/2;PAN.x=ax-(ax-PAN.x)*k;PAN.y=ay2-(ay2-PAN.y)*k;applyPan();return;}
    host.scrollLeft=(host.scrollLeft+ax)*k-ax;const top=host.getBoundingClientRect().top+scrollY,py=scrollY+ay-top;scrollTo(scrollX,top+py*k-ay);}}
function renderPatch({grid=false}={}){Object.keys(nodeEls).forEach(k=>delete nodeEls[k]);{const v=$('visw');if(v.parentNode!==$('patchView'))$('patchView').insertBefore(v,$('sceneStrip'));}
  $('patch').hidden=WIREMODE;$('wires').hidden=!WIREMODE;$('patch').innerHTML='';$('wires').innerHTML='';
  if(WIREMODE)renderWires(grid);else{const host=$('patch');
    canvasModules().forEach(m=>{
      const sec=document.createElement('section');sec.className='mod';sec.setAttribute('aria-label',m.title+' module');
      sec.innerHTML=`<header><b>${m.title.replace(/~$/,'')}</b></header>`;
      const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 300 ${m.h}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',m.title+' patch: '+m.sub);
      drawModule(m,svg);sec.appendChild(svg);host.appendChild(sec);});}
  placeVis();fitWires();paintToggles();
}
/* WIRES view: every module shrunk onto one canvas, scattered a little, with the real sends and receives drawn as
   cables between them (s step → every r step, s~ drums → r~ drums ...), and the video window floating on top,
   cabled to the DAC. */
const WSC=.66;
const VIDEO_LAYOUT_KEY='ff-patch-video-layout';
let videoLayouts={};
try{videoLayouts=JSON.parse(localStorage.getItem(VIDEO_LAYOUT_KEY)||'{}')||{};}catch(e){}
function saveVideoLayout(patchId,layout){
  videoLayouts[patchId]={...layout};
  try{localStorage.setItem(VIDEO_LAYOUT_KEY,JSON.stringify(videoLayouts));}catch(e){}
}
function videoLayout(patchId,vw,W){
  const saved=videoLayouts[patchId]??PATCH.layoutDef?.video;
  if(saved&&[saved.x,saved.y,saved.bw,saved.bh].every(Number.isFinite)&&saved.bw>0&&saved.bh>0){
    const measuredRatio=saved.bw/saved.bh;
    const preset=RATIOS.find(([, ,ratio])=>Math.abs(measuredRatio/ratio-1)<.03);
    const ratio=Number.isFinite(saved.ratio)&&saved.ratio>0?saved.ratio:preset?.[2]??measuredRatio;
    return {...saved,ratio,bh:saved.bw/ratio};
  }
  const narrow=vw<600,bw=narrow?Math.max(160,vw-16):Math.min(560,Math.max(300,W*.42));
  return {x:narrow?8:Math.round(W*.5-bw*.5+W*.08),y:narrow?8:24,bw,bh:bw*9/16,ratio:16/9};
}
let MPOS={};try{MPOS=JSON.parse(localStorage.getItem('ff-patch-mpos')||'{}')||{};}catch(e){}
function renderWires(grid=false){const host=$('wires');WRW=host.clientWidth;const W=Math.max(820,host.clientWidth||820),mw=300*WSC,gap=26,cols=Math.max(2,Math.floor((W+gap)/(mw+gap)));
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('class','wsvg');svg.setAttribute('role','img');svg.setAttribute('aria-label','All modules of the patch on one canvas, connected by cables');
  const cableL=document.createElementNS(NS,'g');const colY=new Array(cols).fill(70),G={},mods=[],LOC={},CABS=[];
  const saved={...PATCH.layoutDef?.modules,...MPOS[PATCH.id]};
  const vinylFeeds=[];
  const gridGap=24;
  const gridWidth=312*WSC;
  const gridCols=Math.max(1,Math.floor((host.clientWidth/ZOOM-gridGap)/(gridWidth+gridGap)));
  const positions={};
  let gridTop=gridGap, rowHeight=0;
  canvasModules().forEach((m,k)=>{let col=0;colY.forEach((y,i)=>{if(y<colY[col])col=i;});
    let X=Math.round(col*(W-mw)/(cols-1||1)+(layoutJitter(k,1)-.5)*34),Y=Math.round(colY[col]+layoutJitter(k,2)*30);colY[col]=Y+(m.h+20)*WSC+gap;
    const position=saved[m.id];
    if(grid){
      const column=k%gridCols;
      if(k&&column===0){gridTop+=rowHeight+gridGap;rowHeight=0;}
      X=gridGap+column*(gridWidth+gridGap)+6*WSC;
      Y=gridTop+20*WSC;
      rowHeight=Math.max(rowHeight,(m.h+26)*WSC);
      positions[m.id]={x:X,y:Y};
    }else if(Array.isArray(position)){X=position[0]*W;Y=position[1];}
    else if(position){X=position.x;Y=position.y;}
    const g=document.createElementNS(NS,'g');g.setAttribute('transform',`translate(${X} ${Y}) scale(${WSC})`);g.setAttribute('class','wmod');
    g.innerHTML=`<rect class="wframe" x="-6" y="-20" width="312" height="${m.h+26}"/><rect class="whead" x="-6" y="-20" width="312" height="20"/><text class="wtitle" x="0" y="-6">${m.title.replace(/~$/,'')}</text>`;
    let diagram=m;
    if(m.id==='out'&&PATCH.vinyl!==false){
      const feeds=m.wires.filter(([,target,signal])=>target==='dac'&&signal);
      vinylFeeds.push(...feeds.map(([source])=>'out.'+source));
      diagram={...m,wires:m.wires.filter(wire=>!feeds.includes(wire))};
    }
    const pos=drawModule(diagram,g);LOC[m.id]={X,Y,pos,g,m};setG(m.id);mods.push(g);});
  function setG(mid){const L=LOC[mid];Object.entries(L.pos).forEach(([id,p])=>{G[mid+'.'+id]={x:L.X+p.x*WSC,y:L.Y+p.y*WSC,w:p.w*WSC,h:p.h*WSC};});}
  const H=Math.max(...colY)+60;
  const extent={left:0,top:0,right:W,bottom:H};
  function includeBounds(left,top,right,bottom){
    extent.left=Math.min(extent.left,Math.floor(left-24));
    extent.top=Math.min(extent.top,Math.floor(top-24));
    extent.right=Math.max(extent.right,Math.ceil(right+24));
    extent.bottom=Math.max(extent.bottom,Math.ceil(bottom+24));
  }
  function includeModule(L){
    includeBounds(L.X-6*WSC,L.Y-20*WSC,L.X+306*WSC,L.Y+(L.m.h+6)*WSC);
  }
  function sizeCanvas(){
    const {left,top,right,bottom}=extent,width=right-left,height=bottom-top;
    svg.setAttribute('viewBox',`${left} ${top} ${width} ${height}`);
    svg.setAttribute('width',width*ZOOM);
    svg.setAttribute('height',height*ZOOM);
    svg.style.left=left*ZOOM+'px';
    svg.style.top=top*ZOOM+'px';
  }
  Object.values(LOC).forEach(includeModule);
  mods.forEach(g=>svg.appendChild(g));svg.appendChild(cableL); // cables on top
  // sends and receives: "s name", "s~ name", "r name", "r~ name" (r cells 0 1 → cells)
  const S={},R={};PATCH.modules.forEach(m=>m.nodes.forEach(n=>{if(n[1]!=='obj')return;const t=n[4],mm=t.match(/^(s|r)(~?)\s+(\S+)/);if(!mm)return;
    const key=mm[3],e={k:m.id+'.'+n[0],m:m.id,sig:!!mm[2]};(mm[1]==='s'?S:R)[key]=((mm[1]==='s'?S:R)[key]||[]).concat(e);}));
  // every cable remembers its two ends, so it can be redrawn when a module is dragged
  const cabDraw=c=>{const A=G[c.a],B=G[c.b],x1=A.x+2,y1=A.y+A.h,x2=B.x+2,y2=B.y;c.l.setAttribute('d',wpath(x1,y1,x2,y2));c.cg.querySelectorAll('.chev').forEach(e=>e.remove());flow(c.cg,x1,y1,x2,y2,c.sig);};
  const cab=(a,b,sig)=>{if(!G[a]||!G[b]||CABS.some(c=>c.a===a&&c.b===b))return; // one cable per pair, even when a send and a declared link both draw it
  const cg=document.createElementNS(NS,'g'),l=document.createElementNS(NS,'path');l.setAttribute('class','cable'+(sig?' sig':''));cg.appendChild(l);cableL.appendChild(cg);
    const c={a,b,sig,cg,l};CABS.push(c);cabDraw(c);};
  Object.keys(S).forEach(key=>(R[key]||[]).forEach(r=>S[key].forEach(se=>{if(se.m===r.m)return;cab(se.k,r.k,se.sig);})));
  // receives with no send of their own: bar, section and phrase come from the clock's section table
  ['bar','section','phrase'].forEach(key=>{if(S[key])return;(R[key]||[]).forEach(r=>{if(r.m!=='clock')cab('clock.sec',r.k);});});
  // and the hidden control links each patch declares (a grid of locks into the voices it drives, and so on)
  (PATCH.cables||[]).forEach(([a,b,sig])=>cab(a,b,sig));
  vinylFeeds.forEach(source=>cab(source,'masterVinyl.input',true));
  if(vinylFeeds.length)cab('masterVinyl.output','out.dac',true);
  const pan=document.createElement('div');pan.className='wpan';pan.id='wpan';pan.append(svg);host.appendChild(pan);applyPan();
  const placers=[],place=()=>placers.forEach(fn=>fn());
  WZ={apply:place};
  const dacK=G['out.dac']?'out.dac':'out.clip';
  const visualSources=new Set();
  const videoBoxes=[]; // every video window's box, so a cable can be routed around the others
  const segHitsBox=(ax,ay,bx,by,b)=>{ // does the line a→b pass through box b (canvas units)?
    for(let k=1;k<20;k++){const t=k/20,x=ax+(bx-ax)*t,y=ay+(by-ay)*t;if(x>b.x&&x<b.x+b.w&&y>b.y&&y<b.y+b.h)return true;}return false;};
  let screenX=gridGap, screenY=gridTop+rowHeight+gridGap, screenRowHeight=0;
  function visualWindow(layoutKey,WIN,monitor){
    const sourceKey=monitor?.sourceKey??dacK;
    visualSources.add(sourceKey.split('.')[0]);
    const win=document.createElement('div'),body=document.createElement('div');
    if(grid){
      const width=WIN.bw+2/ZOOM;
      if(screenX>gridGap&&screenX+width+gridGap>host.clientWidth/ZOOM){
        screenX=gridGap;
        screenY+=screenRowHeight+gridGap;
        screenRowHeight=0;
      }
      WIN={...WIN,x:screenX,y:screenY};
      saveVideoLayout(layoutKey,WIN);
      screenX+=width+gridGap;
      screenRowHeight=Math.max(screenRowHeight,WIN.bh+2/ZOOM);
    }
    win.className='wwin';body.className='wbody';win.append(body);pan.append(win);
    win.setAttribute('role','group');
    win.setAttribute('aria-label',monitor?monitor.title+' window':'Video window: drag to move, drag a corner to resize');
    if(monitor){win.classList.add('flock-window');body.append(monitor.element);}
    else{win.id='wwin';body.id='wbody';}
    const vcab=document.createElementNS(NS,'path'),vflow=document.createElementNS(NS,'g');
    vcab.setAttribute('class','cable sig');svg.append(vcab,vflow);let vkey='';
    const box={x:0,y:0,w:0,h:0};videoBoxes.push(box);
    const place=()=>{const Z=ZOOM;win.style.left=WIN.x*Z+'px';win.style.top=WIN.y*Z+'px';win.style.width=(WIN.bw*Z+2)+'px';body.style.height=WIN.bh*Z+'px';
      const right=WIN.x+win.offsetWidth/Z,bottom=WIN.y+win.offsetHeight/Z;
      includeBounds(WIN.x,WIN.y,right,bottom);sizeCanvas();fitWires();
      const source=G[sourceKey];if(!source)return;
      const ax=source.x+2,ay=source.y+source.h,x0=WIN.x,y0=WIN.y,x1=right,y1=bottom;
      // every video window is patched at its top-left corner, just inside it on the top edge
      let tx=x0+14/ZOOM,ty=y0;
      box.x=x0;box.y=y0;box.w=x1-x0;box.h=y1-y0;
      const others=videoBoxes.filter(o=>o!==box&&o.w);
      if(others.some(o=>segHitsBox(ax,ay,tx,ty,o))){
        // the straight cable would hide under another screen: drop down a lane just left of this one, then turn into the corner
        const lx=x0-7/ZOOM,top=Math.min(y0,...others.map(o=>o.y))-26/ZOOM;
        vcab.setAttribute('d',`M${ax} ${ay} L${lx} ${top} L${lx} ${ty} L${tx-1.5} ${ty}`);
        const k=[ax,ay,lx,ty].map(v=>Math.round(v)).join();
        if(k!==vkey){vkey=k;vflow.replaceChildren();flow(vflow,ax,ay,lx,top,true);}
        return;
      }
      const L=Math.hypot(tx-ax,ty-ay)||1;tx-=(tx-ax)/L*1.5;ty-=(ty-ay)/L*1.5;
      vcab.setAttribute('d',`M${ax} ${ay} L${tx} ${ty}`);const k=[ax,ay,tx,ty].map(v=>Math.round(v)).join();
      if(k!==vkey){vkey=k;vflow.replaceChildren();flow(vflow,ax,ay,tx,ty,true);}};
    placers.push(place);
    // drag by the title bar, resize from the corner grip. Listeners go on the window, so a fast move off the handle
    // (or a browser that will not capture the pointer inside the viewer) never drops the drag.
    // Corner drags scale both dimensions together at the selected frame ratio.
    // no handles drawn on the picture: drag anywhere on it to move; a corner (the outer 28 px) resizes from that corner
    const zone=e=>{const CZ=28*frameScale(),r=win.getBoundingClientRect(),lx=e.clientX-r.left,ly=e.clientY-r.top,L=lx<CZ,Rr=lx>r.width-CZ,T=ly<CZ,B=ly>r.height-CZ;
      return (L||Rr)&&(T||B)?{h:L?-1:1,v:T?-1:1}:null;};
    // right-click (or long-press) the picture for a menu of frame ratios: keeps the window's centre and its long side
    win.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();ratioMenu(e.clientX,e.clientY,r=>{
      const L=Math.max(WIN.bw,WIN.bh),cx=WIN.x+WIN.bw/2,cy=WIN.y+WIN.bh/2;
      WIN.ratio=r;
      WIN.bw=r>=1?L:L*r;
      WIN.bh=WIN.bw/r;
      WIN.x=cx-WIN.bw/2;WIN.y=cy-WIN.bh/2;place();saveVideoLayout(layoutKey,WIN);},WIN.ratio);});
    win.addEventListener('pointermove',e=>{if(WINDRAG)return;const z=zone(e);win.style.cursor=z?(z.h===z.v?'nwse-resize':'nesw-resize'):'move';});
    win.addEventListener('pointerdown',e=>{if(e.button>0||SPACE||WINDRAG)return;closeRatioMenu();e.preventDefault();e.stopPropagation();
      const z=zone(e),origin=pan.getBoundingClientRect();
      const st={x:e.clientX,y:e.clientY,wx:WIN.x,wy:WIN.y,w:WIN.bw,h:WIN.bh};
      const grabX=(st.x-origin.left)/(ZOOM*frameScale())-st.wx,grabY=(st.y-origin.top)/(ZOOM*frameScale())-st.wy;
      let x=st.x,y=st.y,raf=0,lastFrame=null;
      WINDRAG=true;win.classList.add('held');
      const update=()=>{
          const dx=(x-st.x)/(ZOOM*frameScale()),dy=(y-st.y)/(ZOOM*frameScale());
        if(!z){const bounds=pan.getBoundingClientRect();WIN.x=(x-bounds.left)/(ZOOM*frameScale())-grabX;WIN.y=(y-bounds.top)/(ZOOM*frameScale())-grabY;}
        else{
          const scale=1+(dx*z.h*st.w+dy*z.v*st.h)/(st.w**2+st.h**2);
          const minScale=Math.min(1,Math.max(160/st.w,120/st.h));
          WIN.bw=st.w*Math.max(minScale,scale);
          WIN.bh=WIN.bw/WIN.ratio;
          if(z.h<0)WIN.x=st.wx+st.w-WIN.bw;if(z.v<0)WIN.y=st.wy+st.h-WIN.bh;}
        place();};
      const dragFrame=now=>{
        raf=0;
        if(!host.contains(pan)){up();return;}
        if(!z&&panAtEdge(x,y,now-(lastFrame??now-16)))raf=requestAnimationFrame(dragFrame);
        lastFrame=raf?now:null;
        update();
      };
      const mv=ev=>{if(ev.pointerId!==e.pointerId)return;ev.preventDefault();x=ev.clientX;y=ev.clientY;if(!raf)raf=requestAnimationFrame(dragFrame);};
      const up=ev=>{if(ev&&ev.pointerId!==e.pointerId)return;if(raf){cancelAnimationFrame(raf);if(host.contains(pan))update();}
        if(WIN.x!==st.wx||WIN.y!==st.wy||WIN.bw!==st.w||WIN.bh!==st.h)saveVideoLayout(layoutKey,WIN);
        WINDRAG=false;win.classList.remove('held');removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);};
      addEventListener('pointermove',mv,{passive:false});addEventListener('pointerup',up);addEventListener('pointercancel',up);});
  }
  const vw=host.clientWidth||W;
  const monitors=PATCH.monitors;
  if(monitors){
    const narrow=vw<640,bw=Math.max(160,Math.min(370,narrow?vw-32:(vw-48)/2)),bh=bw*9/16;
    const list=monitors();
    list.forEach((monitor,i)=>{
      const key=PATCH.id+':'+monitor.id;
      const saved=videoLayouts[key]??PATCH.layoutDef?.monitors?.[monitor.id]; // a patch can ship default screen positions
      // a wall of four screens opens below the modules, so every module and its cable stays in view
      const top=list.length>2?Math.max(70,...Object.values(LOC).map(L=>L.Y+(L.m.h+6)*WSC))+40:14;
      const layout=saved?(videoLayouts[key]?videoLayout(key,vw,W):{ratio:16/9,...saved}):{x:narrow?16:(vw-2*bw-12)/2+(i%2)*(bw+12),y:top+(narrow?i*(bh+12):Math.floor(i/2)*(bh+12)),bw,bh,ratio:16/9};
      visualWindow(key,layout,monitor);
    });
  }else visualWindow(PATCH.id,videoLayout(PATCH.id,vw,W));
  if(grid){
    MPOS[PATCH.id]=positions;
    try{localStorage.setItem('ff-patch-mpos',JSON.stringify(MPOS));}catch(e){}
  }
  place();place(); // twice, so each cable knows where every screen is
  function edgeSpeed(value,min,max){
    const margin=Math.min(48,(max-min)/3);
    if(margin<=0)return 0;
    return Math.min(1,Math.max(0,(value-max+margin)/margin))
      -Math.min(1,Math.max(0,(min+margin-value)/margin));
  }
  function panAtEdge(x,y,elapsed){
    const bounds=host.getBoundingClientRect(),frame=appFrame();
    const dx=edgeSpeed(x,Math.max(bounds.left,frame.left),Math.min(bounds.right,frame.right));
    const dy=edgeSpeed(y,Math.max(bounds.top,frame.top),Math.min(bounds.bottom,frame.bottom));
    if(!dx&&!dy)return false;
    const distance=480*Math.min(32,elapsed)/1000;
    PAN.x-=dx*distance;PAN.y-=dy*distance;applyPan();
    return true;
  }
  // drag a module (mouse: anywhere on it except a number box or toggle; touch: by its title bar). Its cables follow,
  // and the layout is remembered per song.
  Object.values(LOC).forEach(L=>{L.g.addEventListener('pointerdown',e=>{if(e.button!==0||SPACE||NUMDRAG)return;if(e.target.closest('.tgl,.num.edit'))return;
    if(e.pointerType==='touch'&&!e.target.closest('.whead,.wtitle'))return;e.preventDefault();e.stopPropagation();
    const origin=pan.getBoundingClientRect(),patchId=PATCH.id;
    const grabX=(e.clientX-origin.left)/(ZOOM*frameScale())-L.X,grabY=(e.clientY-origin.top)/(ZOOM*frameScale())-L.Y;
    const pointerId=e.pointerId;
    let x=e.clientX,y=e.clientY,raf=0,lastFrame=null;
    L.g.classList.add('drag');svg.insertBefore(L.g,cableL);
    const moveModule=()=>{
      const bounds=pan.getBoundingClientRect();
      L.X=(x-bounds.left)/(ZOOM*frameScale())-grabX;L.Y=(y-bounds.top)/(ZOOM*frameScale())-grabY;
      L.g.setAttribute('transform',`translate(${L.X} ${L.Y}) scale(${WSC})`);
      includeModule(L);
      sizeCanvas();
      setG(L.m.id);
      CABS.forEach(c=>{if(c.a.startsWith(L.m.id+'.')||c.b.startsWith(L.m.id+'.'))cabDraw(c);});
      if(visualSources.has(L.m.id))place();
    };
    const dragFrame=now=>{
      raf=0;
      if(!host.contains(pan)){up();return;}
      if(panAtEdge(x,y,now-(lastFrame??now-16)))raf=requestAnimationFrame(dragFrame);
      lastFrame=raf?now:null;
      moveModule();
    };
    const mv=ev=>{
      if(ev.pointerId!==pointerId)return;
      ev.preventDefault();x=ev.clientX;y=ev.clientY;
      if(!raf)raf=requestAnimationFrame(dragFrame);
    };
    const up=ev=>{
      if(ev&&ev.pointerId!==pointerId)return;
      if(raf){cancelAnimationFrame(raf);if(host.contains(pan))moveModule();}
      L.g.classList.remove('drag');removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);
      const positions=MPOS[patchId]||(MPOS[patchId]={});
      positions[L.m.id]={x:Math.round(L.X),y:Math.round(L.Y)};
      try{localStorage.setItem('ff-patch-mpos',JSON.stringify(MPOS));}catch(err){}
    };
    addEventListener('pointermove',mv,{passive:false});addEventListener('pointerup',up);addEventListener('pointercancel',up);});});

}
// the visual lives above the sections in the PATCH view, and inside the floating window in the WIRES view
function openAllVisuals(){
  const canvases=[...$('patchView').querySelectorAll('.wwin canvas,#flockVisuals canvas,#visc')]
    .filter(canvas=>canvas.getClientRects().length);
  openVisualDisplay(canvases);
}

function openVisualDisplay(sources){
  sources=sources.filter(Boolean);
  if(!sources.length){alert('Open a patch with a visual first.');return;}
  const display=window.open('','_blank','popup,width=960,height=600');
  if(!display){alert('Allow pop-ups for this app to open a visual window.');return;}
  const patch=PATCH;
  const doc=display.document;
  doc.title=PATCH.title+' · '+(sources.length===1?'Visual':'Visuals');
  doc.documentElement.style.cssText='height:100%;color-scheme:dark;background:#000';
  const columns=Math.ceil(Math.sqrt(sources.length));
  const rows=Math.ceil(sources.length/columns);
  doc.body.style.cssText='margin:0;height:100%;display:grid;grid-template-columns:repeat('+columns+',minmax(0,1fr));grid-template-rows:repeat('+rows+',minmax(0,1fr))';
  const outputs=sources.map(source=>{
    const canvas=doc.createElement('canvas');
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label',source.getAttribute('aria-label')||'Patch visual');
    canvas.style.cssText='width:100%;height:100%;object-fit:contain';
    doc.body.appendChild(canvas);
    return canvas.getContext('2d');
  });
  const fullscreen=doc.createElement('button');
  fullscreen.textContent='Fullscreen';
  fullscreen.style.cssText='position:fixed;right:8px;top:8px;opacity:0';
  fullscreen.onpointerenter=fullscreen.onfocus=()=>{fullscreen.style.opacity='1';};
  fullscreen.onpointerleave=fullscreen.onblur=()=>{fullscreen.style.opacity='0';};
  fullscreen.onclick=doc.body.ondblclick=()=>{
    if(doc.fullscreenElement)doc.exitFullscreen().catch(()=>{});
    else doc.documentElement.requestFullscreen().catch(()=>{});
  };
  doc.body.appendChild(fullscreen);
  const listeners=new AbortController();
  function copyFrame(source,output){
    if(!source?.width||!source.height||!output)return;
    const canvas=output.canvas;
    if(canvas.width!==source.width)canvas.width=source.width;
    if(canvas.height!==source.height)canvas.height=source.height;
    output.clearRect(0,0,canvas.width,canvas.height);
    output.drawImage(source,0,0);
  }
  sources.forEach((source,index)=>{
    source.addEventListener('visualframe',()=>{
      if(!display.closed&&PATCH===patch)copyFrame(source,outputs[index]);
    },{signal:listeners.signal});
  });
  function paint(){
    if(display.closed||PATCH!==patch){
      listeners.abort();
      if(!display.closed)display.close();
      return;
    }
    sources.forEach((original,index)=>{
      if(original.hasAttribute('data-webgl'))return;
      const source=original.isConnected?original:original.matches('canvas.scope.big')?$('wbody')?.querySelector('canvas.scope.big'):null;
      copyFrame(source,outputs[index]);
    });
    display.requestAnimationFrame(paint);
  }
  paint();
  addEventListener('pagehide',()=>display.close(),{once:true,signal:listeners.signal});
}

const defaultVisualLabel=$('visc').getAttribute('aria-label');
function placeVis(){const v=$('visw'),body=$('wbody'),grid=$('flockVisuals');
  const monitors=PATCH.monitors;
  grid.hidden=!monitors||WIREMODE;
  if(monitors){
    v.hidden=true;
    if(!WIREMODE)grid.replaceChildren(...monitors().map(m=>{
      return m.element;
    }));
    return;
  }
  $('visc').setAttribute('aria-label',PATCH===P9?'Independent raindrops and ripples synchronized to sine tones':defaultVisualLabel);
  if(WIREMODE&&body){if(PATCH.visual){v.hidden=false;body.prepend(v);}else{v.hidden=true;body.insertAdjacentHTML('afterbegin','<canvas class="scope big" width="1120" height="630" aria-label="Oscilloscope of the output"></canvas>');}}
  else{const pv=$('patchView');if(v.parentNode!==pv)pv.insertBefore(v,$('sceneStrip'));v.hidden=!PATCH.visual;}}
let wrT=0;addEventListener('resize',()=>{if(!WIREMODE||WINDRAG)return;const cw=$('wires').clientWidth;if(cw===WRW)return;clearTimeout(wrT);wrT=setTimeout(()=>{if(WINDRAG)return;WRW=$('wires').clientWidth;renderPatch();uiStep(Math.floor(stepIdx/16)%TOTAL_BARS,0,secOf(Math.floor(stepIdx/16)%TOTAL_BARS),PATCH.sections[secOf(Math.floor(stepIdx/16)%TOTAL_BARS)],[]);},200);});
const MUTE={};
const RATIOS=[['16:9','Landscape · YouTube',16/9],['4:5','Portrait · Instagram feed',4/5],['1:1','Square',1],['9:16','Vertical · TikTok, Reels',9/16],['4:3','Classic',4/3],['21:9','Cinema',21/9]];
function closeRatioMenu(){const m=document.getElementById('ratioMenu');if(m)m.remove();}
function ratioMenu(x,y,pick,cur){closeRatioMenu();const m=document.createElement('div');m.id='ratioMenu';m.className='ctxm';m.setAttribute('role','menu');m.setAttribute('aria-label','Frame ratio');
  m.innerHTML='<div class="ctxh">Frame ratio</div>'+RATIOS.map(([n,d,r],i)=>`<button role="menuitemradio" aria-checked="${Math.abs(cur/r-1)<.02}" data-i="${i}"><span class="ck">${Math.abs(cur/r-1)<.02?'●':''}</span><b>${n}</b><small>${d}</small></button>`).join('');
  document.body.appendChild(m);const R=m.getBoundingClientRect(),frame=appFrame();m.style.left=Math.max(8,Math.min((frame.width-R.width)/frameScale()-8,(x-frame.left)/frameScale()))+'px';m.style.top=Math.max(8,Math.min((frame.height-R.height)/frameScale()-8,(y-frame.top)/frameScale()))+'px';
  m.querySelectorAll('button').forEach(b=>b.onclick=()=>{pick(RATIOS[+b.dataset.i][2]);closeRatioMenu();});m.querySelector('button').focus();
  m.addEventListener('keydown',e=>{const bs=[...m.querySelectorAll('button')],i=bs.indexOf(document.activeElement);if(e.key==='Escape')closeRatioMenu();if(e.key==='ArrowDown'){e.preventDefault();bs[(i+1)%bs.length].focus();}if(e.key==='ArrowUp'){e.preventDefault();bs[(i-1+bs.length)%bs.length].focus();}});
  setTimeout(()=>{const off=e=>{if(!e.target.closest('#ratioMenu')){closeRatioMenu();removeEventListener('pointerdown',off,true);}};addEventListener('pointerdown',off,true);},0);}
/* The on-screen MIDI controller mirrors the patch and incoming MIDI:
   the playing scene's pad lit, a pad press on every scene change, encoder 1 turning with the riffle count, the
   play LED, the 16 step buttons running with the sequencer, the screen showing the last move. Click a pad to jump
   to that scene, drag an encoder to turn it, click play to start or stop. */
const MV={g:null,last:'',lastT:0};
// scenes run from the top-left pad, left to right, row by row. The alternate pad mapping start bottom-left (68), so flip them.
const padOf=n=>n>=68&&n<100?(3-Math.floor((n-68)/8))*8+(n-68)%8:n-36;
function moveSVG(){let h=`<rect class="mvbody" x=".5" y=".5" width="283" height="133" rx="9"/>`;
  const minimal=PATCH===P9;
  if(!minimal)h+=`<rect class="mvscr" x="9" y="8" width="49" height="19" rx="1.5"/><text class="mvtxt2" x="13" y="20"></text>`;
  if(!minimal)h+=`<g class="mvknob mvvol" transform="translate(70 17)"><circle r="7.5"/><path d="M0 -7.5V-3"/></g>`;
  for(let i=0;i<8;i++)h+=`<g class="mvknob" data-k="${i}" transform="translate(${minimal?26.5+i*33:92+i*24.5} 17)"><circle r="7.5"/><path d="M0 -7.5V-3"/></g>`;
  if(!minimal)h+=`<g class="mvwheel" transform="translate(33 50)"><circle r="12"/><circle r="4" class="mvhub"/></g>`;
  const btn=(x,y,cls,icon)=>`<g class="mvbtn ${cls}" transform="translate(${x} ${y})"><rect x="-9" y="-6" width="18" height="12" rx="2"/>${icon||''}</g>`;
  if(!minimal)h+=btn(20,80,'mvplay','<path class="mvic" d="M-2.5 -3.5L3.5 0L-2.5 3.5Z"/>')+btn(44,80,'mvrec','<circle class="mvic" r="2.8"/>')+btn(20,98,'mvsh','')+btn(44,98,'mvloop','')+btn(20,116,'mvb','')+btn(44,116,'mvb','');
  const padColors=['#ff6159','#ffc14e','#58e37e','#5cd9fa','#5684ff','#ae75ff','#ff69b5','#ff8c59'];
  for(let r=0;r<4;r++)for(let c=0;c<8;c++){const i=r*8+c;h+=`<rect class="mvpad" data-p="${i}" style="--pad-led:${padColors[c]}" x="${minimal?13+c*33:68+c*26}" y="${minimal?35+r*22:33+r*19.5}" width="${minimal?27:22.5}" height="${minimal?17:16.5}" rx="2"/>`;}
  if(!minimal)for(let i=0;i<16;i++)h+=`<rect class="mvstep" data-s="${i}" x="${68+i*13}" y="${115+6}" width="10" height="6" rx="1.5"/>`;
  return h;}
function moveBind(g){MV.g=g;
  g.querySelectorAll('.mvpad').forEach(p=>p.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();const i=+p.dataset.p;if(i<PATCH.sections.length){jumpTo(i);if(!playing)toggleplay();moveHit('pad',i);moveSay('scene '+(i+1));}}));
  g.querySelector('.mvplay')?.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();toggleplay();moveHit('btn','mvplay');});
  g.querySelectorAll('.mvknob[data-k]').forEach(k=>k.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();const i=+k.dataset.k,P=midiParams(),p=P.find((q,j)=>ccFor(q,j)===71+i);if(!p)return;
    let y0=e.clientY;const mv=ev=>{const d=Math.trunc((y0-ev.clientY)/6);if(!d)return;y0-=d*6;midiApply(p,null,d);moveSay(p.name+' '+moveVal(p).txt);moveUI();};
    const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);};addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);}));
  moveUI();}
// d: how far the knob has been turned away from where the song had it, -1..1 (0 = knob at the top)
function moveVal(p){if(p.kind==='ch'){const v=mixState(p.ch).vol;return {d:(v-1)/.5,txt:v<=.001?'-inf':(20*Math.log10(v)).toFixed(1)+'dB'};}
  if(p.kind==='mst'){const [,,mn,mx,def,u]=mstP(p),v=mstState()[p.d][p.k];return {d:(v-def)/(mx-mn)*2,txt:u==='dB'?v.toFixed(1)+'dB':Math.round(v*100)+'%'};}
  if(p.kind==='mix'){const st=mixState('master'),k=p.id.split('.')[1];return k==='vol'?{d:(st.vol-.8)/.7,txt:(20*Math.log10(st.vol+1e-6)).toFixed(1)+'dB'}:{d:st.drv,txt:Math.round(st.drv*100)+'%'};}
  const e=PATCH.edit[p.id],h=holds()[p.id],t=nodeEls[p.id]?parseFloat(nodeEls[p.id].querySelector('text').textContent):e.min,v=h!=null?h:(Number.isFinite(t)?t:e.min);
  return {d:h!=null?(h-(HBASE[PATCH.id+p.id]??h))/(e.max-e.min):0,txt:v.toFixed(e.d)};}
function moveSay(t){MV.last=t;MV.lastT=performance.now();}
function moveHit(kind,i){const g=MV.g;if(!g||!g.isConnected)return;const el=kind==='pad'?g.querySelector(`.mvpad[data-p="${i}"]`):kind==='knob'?g.querySelector(`.mvknob[data-k="${i}"]`):g.querySelector('.'+i);
  if(!el)return;el.classList.remove('press');void el.getBBox();el.classList.add('press');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('press'),160);}
let MVsec=-1,MVvals={};
function moveUI(bar,s){const g=MV.g;if(!g||!g.isConnected)return;const si=secOf(Math.floor(stepIdx/16)%TOTAL_BARS);
  if(si!==MVsec){if(MVsec>=0&&playing)moveHit('pad',si);MVsec=si;}
  g.querySelectorAll('.mvpad').forEach(p=>{const i=+p.dataset.p;p.classList.toggle('has',i<PATCH.sections.length);p.classList.toggle('now',i===si);p.classList.toggle('loop',i===LOOPSI);});
  if(s!=null)g.querySelectorAll('.mvstep').forEach(b=>b.classList.toggle('on',+b.dataset.s===s));
  g.querySelector('.mvplay')?.classList.toggle('lit',playing);
  midiParams().forEach((p,j)=>{const k=ccFor(p,j)-71;if(k<0||k>7)return;const {d,txt}=moveVal(p),kg=g.querySelector(`.mvknob[data-k="${k}"]`);if(!kg)return;
    kg.querySelector('path').style.transform=`rotate(${135*Math.max(-1,Math.min(1,d))}deg)`;kg.classList.add('used');
    if(MVvals[p.id]!=null&&MVvals[p.id]!==txt){if(performance.now()-MV.lastT>400)moveSay(p.name+' '+txt);moveHit('knob',k);}MVvals[p.id]=txt;});
  const t2=g.querySelector('.mvtxt2');if(t2)t2.textContent=performance.now()-MV.lastT<1600?MV.last.slice(0,11):'S'+(si+1)+' '+sceneCode(PATCH,si);}
/* editable number boxes: drag up/down (Shift for fine), wheel, arrow keys, or double-click to type. An edited box
   holds its value and drives the sound until you clear it (double-click and leave it empty, or Delete/Backspace). */
const HOLDS={};const holds=()=>HOLDS[PATCH.id]||(HOLDS[PATCH.id]={});
const ov=(key,v)=>{const h=HOLDS[PATCH.id];return h&&h[key]!=null?h[key]:v;};
const fmtN=(key,v)=>{const e=PATCH.edit&&PATCH.edit[key];return e?v.toFixed(e.d):String(v);};
const HBASE={};
function setHold(key,v){const e=PATCH.edit[key];if(v==null||Number.isNaN(v)){delete holds()[key];delete HBASE[PATCH.id+key];}else{if(holds()[key]==null){const t=nodeEls[key]&&parseFloat(nodeEls[key].querySelector('text').textContent);HBASE[PATCH.id+key]=Number.isFinite(t)?t:v;}v=Math.max(e.min,Math.min(e.max,Math.round(v/e.step)*e.step));holds()[key]=+v.toFixed(e.d);}
  const g=nodeEls[key];if(g){g.classList.toggle('held',holds()[key]!=null);if(holds()[key]!=null){const t=g.querySelector('text');if(t)t.textContent=fmtN(key,holds()[key]);}g.setAttribute('aria-valuenow',holds()[key]??'');}
  if(!playing)uiStep(Math.floor(stepIdx/16)%TOTAL_BARS,0,secOf(Math.floor(stepIdx/16)%TOTAL_BARS),PATCH.sections[secOf(Math.floor(stepIdx/16)%TOTAL_BARS)],[]);}
let NUMDRAG=false;
function numEditor(g,key){const e=PATCH.edit[key];g.classList.add('edit');g.setAttribute('tabindex','0');g.setAttribute('role','spinbutton');g.setAttribute('aria-label',key.split('.').pop()+' (drag to change, double-click to type)');
  g.setAttribute('aria-valuemin',e.min);g.setAttribute('aria-valuemax',e.max);if(holds()[key]!=null)g.classList.add('held');
  const cur=()=>{const h=holds()[key];if(h!=null)return h;const t=parseFloat(g.querySelector('text').textContent);return Number.isFinite(t)?t:e.min;};
  g.addEventListener('pointerdown',ev=>{if(ev.button!==0||SPACE)return;ev.preventDefault();ev.stopPropagation();g.focus({preventScroll:true});
    const y0=ev.clientY,v0=cur();let moved=false;NUMDRAG=true;
    const mv=m=>{const dy=y0-m.clientY;if(Math.abs(dy)>2)moved=true;if(!moved)return;const px=(e.max-e.min)/(e.step>=1?e.max-e.min:200);setHold(key,v0+dy*(m.shiftKey?px/10:px)*(e.step>=1?.25:1));};
    const up=()=>{NUMDRAG=false;removeEventListener('pointermove',mv);removeEventListener('pointerup',up);removeEventListener('pointercancel',up);};
    addEventListener('pointermove',mv);addEventListener('pointerup',up);addEventListener('pointercancel',up);});
  g.addEventListener('wheel',ev=>{if(ev.ctrlKey)return;ev.preventDefault();ev.stopPropagation();setHold(key,cur()-Math.sign(ev.deltaY)*e.step*(ev.shiftKey?1:e.step>=1?1:5));},{passive:false});
  g.addEventListener('keydown',ev=>{if(ev.key==='ArrowUp'||ev.key==='ArrowDown'){ev.preventDefault();setHold(key,cur()+(ev.key==='ArrowUp'?1:-1)*e.step*(ev.shiftKey?10:1));}
    else if(ev.key==='Delete'||ev.key==='Backspace'){ev.preventDefault();setHold(key,null);}else if(ev.key==='Enter'){ev.preventDefault();typeNum(g,key);}});
  g.addEventListener('dblclick',ev=>{ev.preventDefault();ev.stopPropagation();typeNum(g,key);});}
function typeNum(g,key){const r=g.querySelector('rect').getBoundingClientRect(),inp=document.createElement('input');inp.className='numtype';inp.type='text';inp.inputMode='decimal';
  inp.value=holds()[key]!=null?fmtN(key,holds()[key]):g.querySelector('text').textContent;Object.assign(inp.style,{left:r.left+'px',top:r.top+'px',width:Math.max(56,r.width)+'px',height:r.height+'px'});
  document.body.appendChild(inp);inp.focus();inp.select();let done=false;
  const fin=ok=>{if(done)return;done=true;if(ok){const v=inp.value.trim();setHold(key,v===''?null:parseFloat(v));}inp.remove();g.focus({preventScroll:true});};
  inp.addEventListener('keydown',ev=>{ev.stopPropagation();if(ev.key==='Enter')fin(true);if(ev.key==='Escape')fin(false);});inp.addEventListener('blur',()=>fin(true));}
function paintToggles(){canvasModules().forEach(m=>{
  const g=nodeEls[m.id+'.'+(m.voice||m.masterEffect?'tg':'play')];
  if(!g)return;
  const on=m.masterEffect?mstState()[m.masterEffect].on:m.voice?!MUTE[m.voice]:playing;
  g.classList.toggle('on',on);g.setAttribute('aria-checked',on);
  if(m.masterEffect)nodeEls[m.id+'.record']?.classList.toggle('on',on);
});}
function setNum(key,txt){const g=nodeEls[key];if(g){const t=g.querySelector('text');const h=HOLDS[PATCH.id]&&HOLDS[PATCH.id][key];if(t)t.textContent=h!=null?fmtN(key,h):txt;}}
const hotT={};
function flash(key){const g=nodeEls[key];if(!g)return;g.classList.add('hot');clearTimeout(hotT[key]);hotT[key]=setTimeout(()=>g.classList.remove('hot'),90);}

/* sections strip */
function computeSections(){SEC_START=[];let a=0;PATCH.sections.forEach(s=>{SEC_START.push(a);a+=s.bars;});TOTAL_BARS=a;}
/* each scene gets a 4-digit code in place of its name: random-looking, but fixed per song and scene */
const sceneCode=(P,i)=>{let h=2166136261;for(const c of P.id+'#'+i){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return String(1000+((h>>>0)%9000));};
/* cables carry a direction: each one is drawn through its midpoint so a chevron sits halfway
   along it, and a small arrowhead lands on the inlet it feeds */
const wpath=(x1,y1,x2,y2)=>Math.hypot(x2-x1,y2-y1)<44?`M${x1} ${y1} L${x2} ${y2}`:`M${x1} ${y1} L${(x1+x2)/2} ${(y1+y2)/2} L${x2} ${y2}`;
/* moving arrows: one chevron travels along every cable from outlet to inlet at a steady speed,
   so the patch shows which way the signal flows. Still when the viewer asks for reduced motion. */
const REDUCED=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}})();
function flow(parent,x1,y1,x2,y2,sig){const L=Math.hypot(x2-x1,y2-y1);if(L<30)return;const n=1,dur=L/(sig?55:38);
  for(let k=0;k<n;k++){const c=document.createElementNS(NS,'path');c.setAttribute('d','M-3.4 -3.6L1.8 0L-3.4 3.6');c.setAttribute('class','chev'+(sig?' sig':''));
    if(REDUCED){const a=Math.atan2(y2-y1,x2-x1)*180/Math.PI;c.setAttribute('transform',`translate(${(x1+x2)/2} ${(y1+y2)/2}) rotate(${a})`);}
    else{const m=document.createElementNS(NS,'animateMotion');m.setAttribute('path',`M${x1} ${y1} L${x2} ${y2}`);m.setAttribute('dur',dur.toFixed(2)+'s');m.setAttribute('rotate','auto');
      m.setAttribute('repeatCount','indefinite');m.setAttribute('begin',(-dur*k/n-Math.random()*dur/n).toFixed(2)+'s');c.appendChild(m);}
    parent.appendChild(c);}}
function renderSections(){const nav=$('sections');nav.innerHTML='';PATCH.sections.forEach((s,i)=>{const b=document.createElement('button');b.className='sec';b.dataset.si=i;b.dataset.pid=PATCH.id;b.innerHTML=`${i+1}<sup>${s.bars}</sup><i class="bar"></i>`;b.title=`Scene ${i+1}: ${s.name} · ${s.bars} bars`;b.setAttribute('aria-label',`Jump to scene ${i+1}, ${s.name}, ${s.bars} bars`);b.onclick=()=>jumpTo(i);nav.appendChild(b);});}
// LOOP: repeat the section that is playing; tapping another section while looping moves the loop there
let LOOPSI=null;
function paintLoop(){const b=$('loopb');b.classList.toggle('on',LOOPSI!=null);b.setAttribute('aria-pressed',LOOPSI!=null);
  document.querySelectorAll('.sec').forEach(el=>el.classList.toggle('looped',+el.dataset.si===LOOPSI));}
function toggleLoop(){LOOPSI=LOOPSI==null?secOf(Math.floor(stepIdx/16)%TOTAL_BARS):null;paintLoop();}
