/* =================== LIVE UI =================== */
const xHist=new Array(64).fill(.5);
let transportStep=0;
function paintTransportTime(step=transportStep){
  transportStep=step;
  const total=Math.round(TOTAL_BARS*16*sd());
  const elapsed=step>=TOTAL_BARS*16?total:Math.floor(step*sd()+1e-8);
  for(const [id,seconds] of [['elapsedTime',elapsed],['totalTime',total]]){
    const time=$(id),duration=`PT${seconds}S`;
    if(time.dateTime===duration)continue;
    time.dateTime=duration;
    time.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  }
}
function uiStep(bar,s,si,S,ui){
  if(PATCH.visual==='sunflower'){sunHits(ui);SUN.r=ov('logistic.rn',S.r)||3.7;SUN.x=x;SUN.fold=LOCKS[0][s]||0;}
  $('pos').textContent=`${bar+1}. ${(s>>2)+1}. ${(s&3)+1}`;
  paintTransportTime(bar*16+s);
  const rd=PATCH.read(S,bar,s);$('rv').textContent=rd[0];$('xv').textContent=rd[1];
  setNum('clock.stepn',String(s));setNum('clock.barn',String(bar));PATCH.ui&&PATCH.ui(bar,s,S);
  moveUI(bar,s);
  ui.forEach(u=>{if(u[0]==='num')setNum(u[1],u[2]);else flash(u[0]);});
  if(s%4===0)flash('clock.tick');
  drawLocks(s);
  const prog=((bar-SEC_START[si]+s/16)/PATCH.sections[si].bars*100)+'%';
  document.querySelectorAll('[data-si]').forEach(el=>{if(el.dataset.pid!==PATCH.id)return;const i=+el.dataset.si;el.classList.toggle('now',i===si);const b=el.querySelector('.bar,.bar2');if(b)b.style.width=i===si?prog:'0';});
}
function drawLocks(cur){document.querySelectorAll('g.grid').forEach(g=>{const T=PATCH.grids[g.dataset.name].T;g.querySelectorAll('rect.lv').forEach(el=>{const v=T[+el.dataset.r][+el.dataset.c],h=Math.max(0,Math.min(1,v))*24;el.setAttribute('y',String(+el.dataset.b-h));el.setAttribute('height',String(h));});
  g.querySelectorAll('rect.cell').forEach(el=>el.setAttribute('stroke',+el.dataset.c===cur?'#ffffff':'#3a3a38'));});}
function drawArr(){const g=nodeEls['logistic.arr'];if(!g)return;const bars=g.querySelector('.bars'),w=284,h=62,bw=w/xHist.length;
  bars.innerHTML=xHist.map((v,i)=>`<rect class="b" x="${(i*bw).toFixed(1)}" y="${(h-v*(h-4)).toFixed(1)}" width="${Math.max(1,bw-1).toFixed(1)}" height="2"/>`).join('');}
function scopeLoop(){requestAnimationFrame(scopeLoop);if(PATCH===P9){drawDrizzleFlock();drawDrizzleBirdBars();}if(!analyser)return;if(PATCH===P9){drawDrizzleChordBars();drawDrizzleRibbon();}const d=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(d);
  document.querySelectorAll('canvas.scope').forEach(cv=>{if(cv.classList.contains('big')){const W2=Math.round(cv.clientWidth*1.5),H2=Math.round(cv.clientHeight*1.5);if(W2&&H2&&(cv.width!==W2||cv.height!==H2)){cv.width=W2;cv.height=H2;}}const g=cv.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,cv.width,cv.height);g.strokeStyle='#e9e9e7';g.lineWidth=cv.classList.contains('big')?3*Math.max(cv.width,cv.height)/1350:2;g.beginPath();for(let i=0;i<d.length;i++){const X=i/d.length*cv.width,Y=cv.height/2-d[i]*cv.height*.45;i?g.lineTo(X,Y):g.moveTo(X,Y);}g.stroke();});
  document.querySelectorAll('path.scopep').forEach(pe=>{const w=+pe.dataset.w,h=+pe.dataset.h,N=96,st=Math.max(1,Math.floor(d.length/N));let a='';for(let k=0;k<N;k++){const v=Math.max(-1,Math.min(1,d[k*st]));a+=(k?'L':'M')+(k/(N-1)*w).toFixed(1)+' '+(h/2-v*h*.45).toFixed(1);}pe.setAttribute('d',a);});}
