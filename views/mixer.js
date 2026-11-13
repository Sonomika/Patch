// MIXER view: one strip per sound, then the master. Faders are linear gain shown in dB; meters are post-fader peaks.
let mixerSelection='master';
const mixerSolos=new Set();
const stripIdsByInput=new WeakMap();
const isReturn=id=>id==='rret'||id==='dret';
const hasSourceSolo=()=>[...mixerSolos].some(id=>!isReturn(id)&&id!=='vinylNoise');
const hasReturnSolo=()=>[...mixerSolos].some(isReturn);
const soloSource=id=>!mixerSolos.size||mixerSolos.has(id)||(!hasSourceSolo()&&hasReturnSolo());
const soloReturn=id=>!mixerSolos.size||mixerSolos.has(id)||(!hasReturnSolo()&&hasSourceSolo());
function sendToReturn(output,destination,send){
  const id=stripIdsByInput.get(destination)??['drums','low','hats','fx'].find(key=>bus[key]===destination);
  if(!id){output.connect(bus[send]);return;}
  const channel=strip(id);
  channel.directSends??={};
  if(!channel.directSends[send]){
    const gate=ctx.createGain();
    gate.gain.value=soloSource(id)?1:0;
    gate.connect(bus[send]);
    channel.directSends[send]=gate;
  }
  output.connect(channel.directSends[send]);
}
function toggleMixerSolo(id){
  if(mixerSolos.has(id))mixerSolos.delete(id);else mixerSolos.add(id);
  for(const button of $('mixer').querySelectorAll('[data-solo]')){
    const active=mixerSolos.has(button.dataset.solo);
    button.classList.toggle('on',active);
    button.setAttribute('aria-pressed',String(active));
  }
  if(ctx)[...Object.keys(STR),'vinylNoise'].forEach(applyStrip);
}
function selectMixerChannel(id){
  if(mixerSelection===id)return;
  mixerSelection=id;
  $('mixer').querySelectorAll('.ch-select').forEach(button=>{
    const selected=button.dataset.channel===id;
    button.setAttribute('aria-pressed',selected);
    button.closest('.ch').classList.toggle('selected',selected);
  });
  $('mchain').scrollLeft=0;
  renderChain();
}
function bindRotaryDial(input){
  const dial=input.parentElement, min=+input.min, range=+input.max-min;
  const paint=()=>{
    dial.style.setProperty('--dial-angle',(-135+270*(input.value-min)/range)+'deg');
    dial.title=input.getAttribute('aria-label')+' '+(input.nextElementSibling?.textContent??(Math.round(input.value*100)+'%'));
  };
  paint();
  input.addEventListener('input',paint);
  input.addEventListener('sync',paint);
  let drag;
  input.addEventListener('pointerdown',event=>{
    if(event.button!==0||drag)return;
    event.preventDefault();
    input.focus({preventScroll:true});
    input.setPointerCapture(event.pointerId);
    drag={id:event.pointerId,y:event.clientY,value:+input.value};
  });
  input.addEventListener('pointermove',event=>{
    if(drag?.id!==event.pointerId)return;
    const value=Math.max(min,Math.min(+input.max,drag.value+(drag.y-event.clientY)*range/120));
    const previous=input.value;
    input.value=String(value);
    if(input.value!==previous)input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  input.addEventListener('lostpointercapture',()=>{
    const changed=drag&&+input.value!==drag.value;
    drag=null;
    if(changed)input.dispatchEvent(new Event('change',{bubbles:true}));
  });
}
function renderMixer(){const M=$('mixer'),scroll=M.scrollLeft;M.innerHTML='';[...mixIds(),'rret','dret',...(PATCH.vinyl===false?[]:['vinylNoise']),'master'].forEach(id=>{const st=mixState(id),ms=id==='master',rt=id==='dret',reverb=id==='rret'||id==='vinylNoise',el=document.createElement('section');el.className='ch'+(ms?' master':rt||reverb?' ret':'');el.classList.toggle('selected',id===mixerSelection);el.setAttribute('aria-label',MIXNAME[id]+' channel');
  const kn=(k,lab,min,max)=>`<label class="kn channel-dial"><span>${lab}</span><span class="dial-face" aria-hidden="true"></span><input type="range" min="${min}" max="${max}" step="0.01" value="${st[k]??0}" data-k="${k}" aria-label="${MIXNAME[id]} ${k==='pan'?lab:'Send '+lab}"></label>`;
  el.innerHTML=`<button type="button" class="chn ch-select" data-channel="${id}" aria-controls="mchain" aria-pressed="${id===mixerSelection}">${MIXNAME[id]}</button><div class="ch-controls">${ms||rt||reverb?'':kn('pan','PAN',-1,1)+kn('rev','A',0,1)+kn('dly','B',0,1)}</div>
    <div class="fw">
      <input class="fader" type="range" min="-60" max="4" step="0.1" value="${st.vol>0?20*Math.log10(st.vol):-60}" data-k="vol" aria-label="${MIXNAME[id]} level">
      <canvas class="meter" width="14" height="210" data-id="${id}"></canvas>
      <div class="meter-scale" aria-hidden="true">${[0,-12,-24,-36,-48,-60].map(db=>`<span style="top:${(4-db)/64*100}%">${db===0?'0':'−'+Math.abs(db)}</span>`).join('')}</div>
    </div>
    <div class="db"></div>${ms?'':`<div class="ch-actions">
      ${rt?'':`<button type="button" class="fld${st.mute?' on':''}" data-k="mute" aria-pressed="${!!st.mute}" aria-label="Mute" title="Mute"><i data-ic="VolumeX">MUTE</i></button>`}
      <button type="button" class="fld${mixerSolos.has(id)?' on':''}" data-solo="${id}" aria-pressed="${mixerSolos.has(id)}" aria-label="Solo ${MIXNAME[id]}" title="Solo">S</button>
    </div>`}`;
  const db=el.querySelector('.db'),fader=el.querySelector('.fader');
  const show=()=>{
    db.textContent=st.vol<=.001?'−∞ dB':(20*Math.log10(st.vol)).toFixed(1)+' dB';
    fader.setAttribute('aria-valuetext',db.textContent);
  };
  show();
  el.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>{
    const key=inp.dataset.k,value=+inp.value;
    if(key==='vol'){
      st.vol=value<=-60?0:Math.min(1.5,10**(value/20));
      show();
    }else st[key]=value;
    if(ctx){if(ms)applyMaster();else if(STR[id])applyStrip(id);}
    saveMix();
  }));
  el.querySelectorAll('select.msel').forEach(se=>se.onchange=()=>{st[se.dataset.k]=se.value;if(ctx)applyStrip(id);saveMix();});
  el.querySelectorAll('input[data-k="pan"]').forEach(inp=>inp.addEventListener('dblclick',()=>{inp.value=0;inp.dispatchEvent(new Event('input'));}));
  el.querySelectorAll('.channel-dial input').forEach(bindRotaryDial);
  const mb=el.querySelector('button[data-k="mute"]');if(mb)mb.onclick=()=>{st.mute=!st.mute;mb.classList.toggle('on',st.mute);mb.setAttribute('aria-pressed',st.mute);if(ctx&&STR[id])applyStrip(id);saveMix();};
  const solo=el.querySelector('[data-solo]');
  if(solo)solo.onclick=e=>{e.stopPropagation();toggleMixerSolo(id);};
  el.addEventListener('click',()=>selectMixerChannel(id));
  M.appendChild(el);});M.scrollLeft=scroll;fillIcons(M);renderChain();}
const CHANNEL_DRIVE={id:'drive',name:'INPUT GAIN',p:[['drv','BOOST',0,1,0,'']]};
function effectOrder(channel,ids){
  const saved=mixState(channel).effectOrder??[];
  return [...new Set([...saved.filter(id=>ids.includes(id)),...ids])];
}
function bindEffectDrag(panel,channel,ids){
  const cards=[...panel.querySelectorAll('[data-reorderable]')];
  for(const card of cards){
    const header=card.querySelector('header');
    header.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest('button'))return;
      const pointer=event.pointerId;
      const start=event.clientX;
      let x=start,target=null,after=false,frame=0;
      header.setPointerCapture(pointer);
      const update=()=>{
        if(!header.isConnected)return;
        const bounds=panel.getBoundingClientRect();
        if(x>bounds.right-30)panel.scrollLeft+=8;
        else if(x<bounds.left+30)panel.scrollLeft-=8;
        target=null;
        for(const item of cards){
          item.classList.remove('drop-before','drop-after');
          const rect=item.getBoundingClientRect();
          if(x>=rect.left&&x<=rect.right&&x>=bounds.left&&x<=bounds.right){
            target=item;after=x>rect.left+rect.width/2;
          }
        }
        if(target&&target!==card)target.classList.add(after?'drop-after':'drop-before');
        frame=requestAnimationFrame(update);
      };
      const move=e=>{
        if(e.pointerId!==pointer)return;
        x=e.clientX;
        if(!frame&&Math.abs(x-start)>5){card.classList.add('moving');update();}
      };
      const finish=e=>{
        if(e.pointerId!==pointer)return;
        const drop=frame&&e.type==='pointerup'&&target&&target!==card;
        cancelAnimationFrame(frame);
        header.removeEventListener('pointermove',move);
        header.removeEventListener('pointerup',finish);
        header.removeEventListener('pointercancel',finish);
        header.removeEventListener('lostpointercapture',finish);
        card.classList.remove('moving');
        cards.forEach(item=>item.classList.remove('drop-before','drop-after'));
        if(!drop)return;
        const order=effectOrder(channel,ids).filter(id=>id!==card.dataset.d);
        order.splice(order.indexOf(target.dataset.d)+(after?1:0),0,card.dataset.d);
        mixState(channel).effectOrder=order;
        applyStrip(channel);saveMix();renderChain();
      };
      header.addEventListener('pointermove',move);
      header.addEventListener('pointerup',finish);
      header.addEventListener('pointercancel',finish);
      header.addEventListener('lostpointercapture',finish);
    });
  }
}
function renderChain(){const C=$('mchain');if(!C)return;
  const channel=mixerSelection,isMaster=channel==='master';
  const effect=returnDevice(channel);
  const S=isMaster?{...mstState()}:{eq:channelEqState(channel)};
  const masterDevices=MST_DEV.filter(device=>device.id!=='vinyl'||PATCH.vinyl!==false);
  const devices=isMaster?[...masterDevices]:[MST_DEV[0]];
  if(effect){
    S[channel]=returnSettings(channel,effect);
    if(channel==='dret'){
      const delay=S[channel];
      const baseTime=PATCH===P9?6*sd():bus?.delayBase??3*sd();
      devices.unshift({...effect,p:effect.p.map(param=>{
        if(param[0]==='timeMs')return [...param.slice(0,4),Math.min(7900,Math.round(baseTime*delay.timeScale*1000)),...param.slice(5)];
        if(param[0]==='feedbackAmount')return [...param.slice(0,4),(bus?.delayFeedbackBase??.4)*delay.feedback,...param.slice(5)];
        return param;
      })});
    }else devices.unshift(effect);
  }else if(channel!=='vinylNoise'){
    S.drive=mixState(channel);
    S.drive.on??=true;
    if(isMaster){
      devices.unshift(CHANNEL_DRIVE);
    }else{
      S.drive.type??='over';
      S.drive.mix??=1;
      const saturate=MST_DEV.find(device=>device.id==='sat');
      devices.unshift({...saturate,id:'drive',p:saturate.p.map(param=>param[0]==='drv'?['drv','DRIVE',0,1,0,'']:param)});
    }
  }
  const reorderable=isMaster?masterDevices.map(d=>d.id):effect||channel==='vinylNoise'?[]:['drive','eq'];
  if(reorderable.length){
    const order=effectOrder(channel,reorderable);
    const first=devices.findIndex(d=>reorderable.includes(d.id));
    devices.splice(first,order.length,...order.map(id=>devices.find(d=>d.id===id)));
  }
  const apply=()=>applyStrip(channel);
  C.setAttribute('aria-label',isMaster?'Mastering chain':MIXNAME[channel]+' effects');
  const fmt=(v,u)=>{
    if(u==='×')return (+v).toFixed(2)+'×';
    return u==='Hz'||u==='ms'?Math.round(v)+' '+u:u==='dB'?(v>0?'+':'')+(+v).toFixed(1)+' dB':u===':1'?(+v).toFixed(1)+':1':Math.round(v*100)+'%';
  };
  const cab=()=>`<div class="mcab" aria-hidden="true"><svg viewBox="0 0 34 20"><path class="wire sig" d="M0 10L34 10"/></svg></div>`;
  C.innerHTML=`<div class="mend">${MIXNAME[channel]}</div>`+cab()+devices.map(d=>`<div class="mdev${d.columns===2?' two-columns':''}${S[d.id].on?'':' off'}" data-d="${d.id}"${reorderable.includes(d.id)?' data-reorderable':''}>
    <header><button class="mpow" aria-pressed="${S[d.id].on}" aria-label="${d.name} on/off" title="On / off"><i data-ic="Power">●</i></button><b>${d.name}</b>${d.id==='vinyl'?'<span class="vinyl-disc" aria-hidden="true"></span>':''}${d.gr?`<canvas class="grm" width="40" height="6" data-d="${d.id}" title="Gain reduction"></canvas>`:''}</header>
    ${(d.selects??(d.sel?[d.sel]:[])).map(([key,label,options])=>`<label class="mk"><span>${label}</span><select class="msel" data-s="${key}" aria-label="${d.name} ${label}">${Object.entries(options).map(([k,n])=>`<option value="${k}"${k===S[d.id][key]?' selected':''}>${n}</option>`).join('')}</select></label>`).join('')}${d.p.map(([k,l,mn,mx,def,u,step=(mx-mn)/200])=>`<label class="mk channel-dial fx-dial"><span>${l}</span><span class="dial-face" aria-hidden="true"></span><input type="range" min="${mn}" max="${mx}" step="${step}" value="${S[d.id][k]??def}" data-k="${k}" data-def="${def}" aria-label="${d.name} ${l}"><em>${fmt(S[d.id][k]??def,u)}</em></label>`).join('')}
  </div>`+cab()).join('')+(isMaster?`<div class="mdev mlufs" aria-label="Loudness meter"><header><b>LOUDNESS</b><button class="fld" id="lufsMatch" aria-pressed="false" title="Turn the level to the target loudness">MATCH</button><button class="mpow" id="lufsReset" title="Reset integrated loudness and peak" aria-label="Reset loudness"><i data-ic="RotateCcw">R</i></button></header>
    <div class="lbar"><i id="luBar"></i><b title="−14 LUFS streaming target"></b></div>
    <div class="loudness-readings">
      <div class="lrow"><span>MOMENTARY</span><em id="luM">–</em></div>
      <div class="lrow"><span>SHORT-TERM</span><em id="luS">–</em></div>
      <div class="lrow"><span>INTEGRATED</span><em id="luI">–</em></div>
      <div class="lrow"><span>PEAK</span><em id="luP">–</em></div>
    </div>
    <label class="mk channel-dial fx-dial"><span>TARGET</span><span class="dial-face" aria-hidden="true"></span><input type="range" id="lufsTarget" min="-24" max="-6" step="0.5" value="${S.lufs.target}" aria-label="Target loudness"><em>${S.lufs.target.toFixed(1)} LUFS</em></label>
    <label class="mk channel-dial fx-dial"><span>OUT TRIM</span><span class="dial-face" aria-hidden="true"></span><input type="range" id="lufsTrim" min="-24" max="0" step="0.1" value="${S.lufs.trim}" aria-label="Output trim"><em>${(S.lufs.trim>0?'+':'')+S.lufs.trim.toFixed(1)} dB</em></label>
    </div>`+cab():'')+`<div class="mend">${isMaster?'OUT':'MASTER'}</div>`;
  C.querySelectorAll('.mdev[data-d]').forEach(el=>{const id=el.dataset.d,dv=devices.find(x=>x.id===id);
    el.querySelector('.mpow').onclick=e=>{S[id].on=!S[id].on;el.classList.toggle('off',!S[id].on);e.currentTarget.setAttribute('aria-pressed',S[id].on);apply();saveMix();if(id==='vinyl')paintToggles();};
    el.querySelectorAll('select[data-s]').forEach(se=>se.onchange=()=>{S[id][se.dataset.s]=se.value;apply();saveMix();});
    el.querySelectorAll('input').forEach(inp=>{const u=dv.p.find(p=>p[0]===inp.dataset.k)[5],em=inp.nextElementSibling;
      const decaySlider=id==='rret'&&inp.dataset.k==='decay';
      const commit=()=>{S[id][inp.dataset.k]=+inp.value;apply();saveMix();};
      inp.addEventListener('input',()=>{em.textContent=fmt(+inp.value,u);if(!decaySlider)commit();});
      // Rebuild the impulse once per adjustment to keep slider drags responsive.
      if(decaySlider)inp.addEventListener('change',commit);
      inp.addEventListener('dblclick',()=>{
        if(id==='dret'&&(inp.dataset.k==='timeMs'||inp.dataset.k==='feedbackAmount')){
          delete S[id][inp.dataset.k];
          apply();saveMix();renderChain();
          return;
        }
        inp.value=inp.dataset.def;inp.dispatchEvent(new Event('input'));if(decaySlider)commit();
      });});});
  C.querySelectorAll('.mcab svg').forEach(sv=>flow(sv,0,10,32,10,true));
  if(reorderable.length)bindEffectDrag(C,channel,reorderable);
  if(!isMaster){C.querySelectorAll('.fx-dial input').forEach(bindRotaryDial);fillIcons(C);return;}
  $('lufsReset').onclick=()=>LUFS.reset();
  const tg=$('lufsTarget');tg.oninput=()=>{S.lufs.target=+tg.value;tg.nextElementSibling.textContent=(+tg.value).toFixed(1)+' LUFS';saveMix();};
  const tr=$('lufsTrim');tr.oninput=()=>{S.lufs.trim=+tr.value;tr.nextElementSibling.textContent=(S.lufs.trim>0?'+':'')+S.lufs.trim.toFixed(1)+' dB';MST.apply();saveMix();};tr.ondblclick=()=>{tr.value=0;tr.dispatchEvent(new Event('input'));};
  $('lufsMatch').onclick=()=>LUFS.match(!LUFS.matching);paintMatch();
  C.querySelectorAll('.mdev[data-d] input').forEach(inp=>inp.addEventListener('sync',()=>{const id=inp.closest('.mdev').dataset.d,u=devices.find(x=>x.id===id).p.find(p=>p[0]===inp.dataset.k)[5];inp.nextElementSibling.textContent=fmt(+inp.value,u);}));
  C.querySelectorAll('.fx-dial input').forEach(bindRotaryDial);
  fillIcons(C);}
function meterLoop(){requestAnimationFrame(meterLoop);if(VIEW!=='mixer'||!ctx)return;
  {const f=v=>Number.isFinite(v)&&v>-70?v.toFixed(1)+' LUFS':'–',M=$('luM');if(M){if(analyser){const b=LUFS.pb||(LUFS.pb=new Float32Array(analyser.fftSize));analyser.getFloatTimeDomainData(b);for(let i=0;i<b.length;i++)LUFS.pk=Math.max(LUFS.pk,Math.abs(b[i]));}
    M.textContent=LUFS.ok?f(LUFS.M):'n/a';$('luS').textContent=LUFS.ok?f(LUFS.S):'n/a';$('luI').textContent=LUFS.ok?f(LUFS.I):'n/a';$('luP').textContent=LUFS.pk>0?(20*Math.log10(LUFS.pk)).toFixed(1)+' dBFS':'–';
    $('luBar').style.width=Number.isFinite(LUFS.M)?Math.max(0,Math.min(100,(LUFS.M+40)/40*100))+'%':'0';}}
  document.querySelectorAll('canvas.grm').forEach(cv=>{const n=MST.n[cv.dataset.d];if(!n)return;const r=-(cv.dataset.d==='lim'?n.lim.reduction:n.cmp.reduction)||0,g=cv.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,40,6);g.fillStyle='#e9e9e7';g.fillRect(0,0,Math.min(40,r/12*40),6);});document.querySelectorAll('canvas.meter').forEach(cv=>{const id=cv.dataset.id,S=id==='master'?{an:analyser}:STR[id];const g=cv.getContext('2d');
  let pk=0;if(S&&S.an){const b=S.buf||(S.buf=new Float32Array(S.an.fftSize));S.an.getFloatTimeDomainData(b);for(let i=0;i<b.length;i++)pk=Math.max(pk,Math.abs(b[i]));}
  cv._p=Math.max(pk,(cv._p||0)*.92);const db=20*Math.log10(cv._p+1e-6),h=Math.max(0,Math.min(1,(db+60)/64))*cv.height;
  g.fillStyle='#000';g.fillRect(0,0,cv.width,cv.height);g.fillStyle=db>0?'#ffab65':'#80e8b3';g.fillRect(2,cv.height-h,cv.width-4,h);g.fillStyle='rgba(233,233,231,.45)';g.fillRect(0,cv.height*(4/64),cv.width,1);});}
