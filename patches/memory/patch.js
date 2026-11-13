function drawLakeFog(g,w,h){
  const time=performance.now()/1000;
  const banks=[
    [.12,.57,.29,.034,.38,.049],
    [.65,.62,.36,.043,.32,.039],
    [.37,.69,.26,.036,.32,.053],
    [.87,.76,.33,.047,.27,.043]
  ];
  for(const [x,y,width,height,opacity,speed] of banks){
    const margin=width*1.6;
    const span=1+2*margin;
    const center=(x+margin+time*speed)%span-margin;
    g.save();
    g.globalCompositeOperation='source-over';
    g.translate(center*w,y*h);
    g.scale(width*w,height*h);
    const wisps=[[-.52,.14,.70,.61,.56],[0,0,1,1,1],[.63,-.24,.78,.48,.70]];
    for(const [offsetX,offsetY,length,depth,density] of wisps){
      g.save();
      g.translate(offsetX,offsetY);
      g.scale(length,depth);
      const fog=g.createRadialGradient(0,0,0,0,0,1);
      fog.addColorStop(0,`rgba(199,214,225,${opacity*density})`);
      fog.addColorStop(.45,`rgba(199,214,225,${opacity*density*.68})`);
      fog.addColorStop(1,'rgba(199,214,225,0)');
      g.fillStyle=fog;
      g.fillRect(-1,-1,2,2);
      g.restore();
    }
    g.restore();
  }
}
const P9={
  id:'drizzle',backdrop:'patches/memory/images/memory-mountain-lake.png',num:'09',title:'MEMORY',bpm:64,seed:9,visual:'rain',
  style:'Ambient · D hirajoshi',key:'Independent rain streams',readLabels:['DROPS/S','CHORD'],
  blurb:'Soft sine drops fall at their own pace over slow, quiet chords.',
  maths:'Three independent Poisson streams create near, middle and distant drops. Each impact has its own onset, pitch, decay, level and position. The rain keeps its free timing as the chords change.',
  sound:'Drops draw from D hirajoshi (D, E, F, A, B♭). A low analog-style organ pad moves through Dm9, B♭maj7, Fmaj7 and Dm9. A soft ribbon lead leans into sevenths and ninths with slow slides and swells. Wide, dark reverb trails into the next chord.',
  sections:[
    {name:'Mist',bars:8,density:.5},
    {name:'Drizzle',bars:8,density:1},
    {name:'Shower',bars:8,density:1.6},
    {name:'Stillness',bars:8,density:.4}
  ],
  modules:[
    {id:'rain',title:'SINE DROPS~',sub:'three independent rain streams',voice:'rain',h:145,nodes:[
      ['near','obj',8,12,'near'],['mid','obj',88,12,'middle'],['far','obj',180,12,'distant'],['tg','tgl',260,12],
      ['tone','obj',8,52,'D hirajoshi → osc~'],['env','obj',8,84,'*~ drop envelope'],['send','obj',8,116,'s~ rain']
    ],wires:[['near','tone'],['mid','tone'],['far','tone'],['tone','env',1],['env','send',1]]},
    {id:'pad',title:'LOW ORGAN~',sub:'Analog-style organ pad',voice:'pad',h:145,nodes:[
      ['chord','obj',8,12,'7th + 9th voicings'],['tg','tgl',260,12],['tone','obj',8,52,'drawbars + pulse → LPF'],
      ['env','obj',8,84,'*~ slow envelope'],['send','obj',8,116,'s~ pad']
    ],wires:[['chord','tone'],['tone','env',1],['env','send',1]]},
    {id:'chordView',title:'CHORD MONITOR',sub:'One bar per chord voice',h:110,nodes:[
      ['bars','chord-bars',8,8,'',284,94]
    ],wires:[]},
    {id:'ribbon',title:'RIBBON LEAD~',sub:'Gliding pitch and pressure swells',voice:'ribbon',h:147,nodes:[
      ['pitch','obj',8,10,'pitch ribbon'],['pressure','obj',142,10,'pressure'],['tg','tgl',260,12],
      ['tone','obj',8,48,'sine + triangle'],['filter','obj',8,85,'lop~ → swell'],['send','obj',8,119,'s~ ribbon']
    ],wires:[['pitch','tone'],['pressure','filter'],['tone','filter',1],['filter','send',1]]},
    {id:'ribbonView',title:'RIBBON MONITOR',sub:'Pitch and expression over time',h:110,nodes:[
      ['trace','ribbon-trace',8,8,'',284,94]
    ],wires:[]},
    {id:'birds',title:'BIRD MONITOR',sub:'Quiet bird calls, positioned in stereo',voice:'birds',h:145,nodes:[
      ['call','obj',8,8,'s~ birds'],['tg','tgl',260,12],
      ['bars','chord-bars',8,42,'',284,94]
    ],wires:[['call','bars',1]]},
    {id:'move',title:'MIDI CONTROLLER',sub:'Select scenes, play and adjust the mix',h:284,nodes:[
      ['dev','move',8,6,'',284,134],
      ['mi','obj',8,152,'midiin'],
      ['nt','obj',8,186,'notein 36 / 68'],['cc','obj',150,186,'ctlin 71–78'],
      ['sc','obj',8,220,'pad → scene'],['n','num',150,220,'0',4],
      ['pl','obj',8,254,'CC 85 → play'],['k1','obj',150,254,'enc 1 → rain'],['k8','obj',212,220,'enc 2–8']
    ],wires:[['mi','nt'],['mi','cc'],['nt','sc'],['cc','n'],['cc','pl'],['n','k1'],['n','k8']]},
    {id:'out',title:'DAC~',h:125,nodes:[
      ['rain','obj',8,12,'r~ rain'],['pad','obj',110,12,'r~ pad'],['birds','obj',206,12,'r~ birds'],
      ['ribbon','obj',110,52,'r~ ribbon'],['dac','obj',8,87,'dac~']
    ],wires:[['rain','dac',1],['pad','dac',1],['birds','dac',1],['ribbon','dac',1]]}
  ]
};
const drizzleScale=[62,64,65,69,70];
const drizzleChords=[
  ['Dm9',[38,53,57,60,64]],
  ['B♭maj7',[34,53,57,58,62]],
  ['Fmaj7',[41,53,57,60,64]],
  ['Dm9',[38,53,57,60,64]]
];
let drizzleOrganWave;
const drizzleStreams=[
  {rate:1.4,octave:1,depth:.84,level:.072},
  {rate:3.1,octave:1,depth:.71,level:.045},
  {rate:5.5,octave:0,depth:.59,level:.024}
];
const drizzleHz=note=>440*2**((note-69)/12);
const drizzleOutputs=new Map();
function drizzleOutput(id){
  if(!drizzleOutputs.has(id)){
    const output=ctx.createGain();
    output.connect(chan(id));
    drizzleOutputs.set(id,output);
  }
  return drizzleOutputs.get(id);
}
P9.mix=['rain','pad','ribbon','birds'];
P9.cables=[
  ['pad.env','chordView.bars',1],['ribbon.filter','ribbonView.trace',1],
  ['move.sc','pad.chord'],['move.pl','out.dac'],['move.k1','out.rain']
];
P9.mixDef={
  rain:{vol:0,rev:.76},
  pad:{vol:.27,drv:.125,rev:.88,on:true,type:'bigf',mix:.52,eq:{on:true,lo:-12,mid:0,hi:-12}},
  ribbon:{dly:1,rev:1},
  birds:{dly:1,rev:1},
  rret:{vol:.33,on:true,decay:1.5,preDelay:0,damping:6272,mode:'space',drift:.21,shimmer:.35,eq:{on:true,lo:-.6,mid:0,hi:0}},
  dret:{vol:.73,drv:.17,mode:'tape',on:true,timeScale:2,feedback:.73,feedbackAmount:.765,timeMs:1075},
  vinylNoise:{vol:.26}
};
P9.masterDef={
  eq:{on:true,lo:0,mid:0,hi:0},
  glue:{on:true,thr:-18,rat:1.8,mk:1},
  sat:{on:false,drv:0,mix:1,type:'over'},
  width:{on:true,w:1.15,bm:120,ug:0},
  vinyl:{on:true,tone:.22,wow:.305,dust:.08},
  lim:{on:true,gain:1.38,ceil:-1},
  lufs:{target:-10,trim:0}
};
P9.layoutDef={
  frame:'portrait',zoom:1.06,
  modules:{
    rain:{x:44,y:67},pad:{x:316,y:241},out:{x:322,y:722},
    masterVinyl:{x:56,y:237},chordView:{x:295,y:37},birds:{x:49,y:678},
    ribbon:{x:382,y:319},ribbonView:{x:307,y:139},move:{x:49,y:820}
  },
  video:{x:76.56862745098042,y:392.9609189500996,bw:422,bh:237}
};
// Each phrase spans four bars. Events give the onset and duration in sixteenths,
// the MIDI note, the approach pitch in semitones, and the pressure peak.
const drizzleRibbonPhrases=[
  [],
  [[10,19,69,-2,.030],[31,22,72,-3,.035]],
  [[5,24,76,-2,.040],[34,23,79,-3,.042]],
  [[7,20,77,2,.034],[28,23,76,1,.038],[53,10,74,2,.022]],
  [[7,20,72,-3,.035],[30,27,76,-4,.048]],
  [[3,25,77,-2,.039],[31,21,81,-3,.047],[53,10,79,2,.025]],
  [[9,22,79,-2,.043],[34,23,76,3,.036]],
  [[5,19,77,2,.027],[26,17,76,1,.026],[45,18,74,2,.021]]
];
const ribbonGestures=[];
const ribbonPressure=[[0,0],[.18,.4],[.43,1],[.7,.67],[1,0]];
const ribbonVibratoRate=[4.3,5.1];
const ribbonVibratoDepth=[[0,0],[.25,0],[.63,19],[1,7]];
function ribbonEnvelope(points,phase){
  const segment=points.findIndex(([p],i)=>i>0&&phase<=p);
  const [from,fromLevel]=points[segment-1], [to,toLevel]=points[segment];
  return fromLevel+(toLevel-fromLevel)*(phase-from)/(to-from);
}
function playDrizzleRibbon(at,bar,step,stepLength,ui){
  if(MUTE.ribbon)return;
  const phrase=drizzleRibbonPhrases[Math.floor(bar/4)%drizzleRibbonPhrases.length];
  const note=phrase.find(([onset])=>onset===(bar%4)*16+step);
  if(!note)return;
  const [,length,pitch,approach,peak]=note;
  const duration=length*stepLength,end=at+duration,frequency=drizzleHz(pitch);
  ribbonGestures.push({at,duration,pitch,approach,peak});
  if(ribbonGestures.length>4)ribbonGestures.shift();
  const output=drizzleOutput('ribbon');
  const pressure=ctx.createGain(),filter=ctx.createBiquadFilter(),vibratoDepth=ctx.createGain();
  filter.type='lowpass';
  filter.Q.value=.65;
  filter.frequency.setValueAtTime(680,at);
  filter.frequency.exponentialRampToValueAtTime(1700,at+duration*.43);
  filter.frequency.exponentialRampToValueAtTime(740,end);
  pressure.gain.setValueAtTime(0,at);
  for(const [phase,level] of ribbonPressure.slice(1)){
    pressure.gain.linearRampToValueAtTime(peak*level,at+duration*phase);
  }
  filter.connect(pressure);pressure.connect(output);
  const vibrato=ctx.createOscillator();
  vibrato.frequency.setValueAtTime(ribbonVibratoRate[0],at);
  vibrato.frequency.linearRampToValueAtTime(ribbonVibratoRate[1],end);
  vibratoDepth.gain.setValueAtTime(0,at);
  for(const [phase,cents] of ribbonVibratoDepth.slice(1)){
    vibratoDepth.gain.linearRampToValueAtTime(cents,at+duration*phase);
  }
  vibrato.connect(vibratoDepth);
  for(const [wave,blend,detune] of [['sine',.82,0],['triangle',.18,-6]]){
    const oscillator=ctx.createOscillator(),voice=ctx.createGain();
    oscillator.type=wave;
    oscillator.detune.value=detune;
    oscillator.frequency.setValueAtTime(drizzleHz(pitch+approach),at);
    oscillator.frequency.exponentialRampToValueAtTime(frequency,at+duration*.24);
    oscillator.frequency.exponentialRampToValueAtTime(drizzleHz(pitch-.14),end);
    vibratoDepth.connect(oscillator.detune);
    voice.gain.value=blend;
    oscillator.connect(voice);voice.connect(filter);
    oscillator.start(at);oscillator.stop(end);
  }
  vibrato.start(at);vibrato.stop(end);
  ui.push(['ribbon.pitch'],['ribbon.pressure'],['ribbon.tone']);
}
const ribbonRestY=82;
let ribbonGuideY=ribbonRestY,ribbonGuideFrame;
function drawDrizzleRibbon(){
  const monitor=nodeEls['ribbonView.trace'];
  if(!monitor||$('patchView').hidden)return;
  const path=monitor.querySelector('.ribbon-contour');
  const guide=monitor.querySelector('.ribbon-pitch-guide');
  const mixer=mixState('ribbon');
  let contour='',targetY=ribbonRestY;
  if(!MUTE.ribbon&&!mixer.mute&&mixer.vol>0){
    const now=ctx.currentTime,history=7;
    for(const {at,duration,pitch,approach,peak} of ribbonGestures){
      const start=Math.max(at,now-history),end=Math.min(at+duration,now);
      if(start>=end)continue;
      const upper=[],lower=[];
      const samples=Math.ceil((end-start)*60);
      for(let i=0;i<=samples;i++){
        const time=start+(end-start)*i/samples,phase=Math.min(1,Math.max(0,(time-at)/duration));
        const bend=phase<.24?approach*(1-phase/.24):-.14*(phase-.24)/.76;
        const pressure=ribbonEnvelope(ribbonPressure,phase);
        const [rateStart,rateEnd]=ribbonVibratoRate;
        const cycles=(time-at)*(rateStart+(rateEnd-rateStart)*phase/2);
        const wobble=Math.sin(2*Math.PI*cycles)*ribbonEnvelope(ribbonVibratoDepth,phase)/100;
        const x=8+268*(1-(now-time)/history);
        const y=47-(pitch+bend+5*wobble-75)*3; // Magnify the sub-semitone vibrato for readability.
        const width=.5+6*Math.min(1,pressure*peak*mixer.vol/.048);
        upper.push(`${x.toFixed(1)} ${(y-width).toFixed(1)}`);
        lower.push(`${x.toFixed(1)} ${(y+width).toFixed(1)}`);
        if(i===samples&&now<at+duration){
          targetY=y;
        }
      }
      contour+='M'+upper.concat(lower.reverse()).join('L')+'Z';
    }
  }
  path.setAttribute('d',contour);
  const frame=performance.now();
  const elapsed=frame-(ribbonGuideFrame??frame);
  ribbonGuideFrame=frame;
  const glideMs=targetY===ribbonRestY?650:32;
  ribbonGuideY=REDUCED?targetY:targetY+(ribbonGuideY-targetY)*Math.exp(-elapsed/glideMs);
  guide.setAttribute('d',`M8 ${ribbonGuideY.toFixed(1)}H276M276 ${(ribbonGuideY-5).toFixed(1)}v10`);
}
const drizzleVisualChords=[];
const drizzleBirdNotes=[];
let nextDrizzleBird=null;
P9.read=(S,bar)=>[(10*S.density).toFixed(0),drizzleChords[Math.floor(bar/4)%drizzleChords.length][0]];
P9.secLabel=S=>`${10*S.density} drops/s`;
function resetDrizzle(at){
  rainImpacts.length=0;
  ribbonGestures.length=0;
  drizzleVisualChords.length=0;
  drizzleBirdNotes.length=0;
  nextDrizzleBird=null;
  thunderTime=-Infinity;
  for(const output of drizzleOutputs.values()){
    output.gain.setTargetAtTime(0,at,.012);
    setTimeout(()=>output.disconnect(),100+Math.max(0,(at-ctx.currentTime)*1000));
  }
  drizzleOutputs.clear();
}
P9.reset=P9.jump=()=>resetDrizzle(ctx?.currentTime??0);
P9.onStop=at=>resetDrizzle(at??ctx.currentTime);
function playDrizzleBird(t,windowLength,ui){
  nextDrizzleBird??=t+2+Math.random()*3;
  if(nextDrizzleBird>=t+windowLength)return;
  const at=Math.max(t,nextDrizzleBird);
  nextDrizzleBird=at+6+Math.random()*9;
  if(MUTE.birds)return;
  const pan=(Math.random()*2-1)*.84;
  const base=1350+Math.random()*600;
  const output=drizzleOutput('birds');
  const notes=Math.random()<.45?3:2;
  for(let i=0;i<notes;i++){
    const onset=at+i*.135,duration=.075+Math.random()*.035;
    const frequency=base*(i===1?1.24:1-i*.065);
    const level=.013*(1-i*.19);
    sine(frequency,onset,duration,level,output,{
      f0:frequency*(i===1?.75:1.28),drop:duration*.72,atk:.016,pan
    });
    drizzleBirdNotes.push({onset,duration,level,pan});
  }
  if(drizzleBirdNotes.length>6)drizzleBirdNotes.splice(0,drizzleBirdNotes.length-6);
  ui.push(['birds.call']);
}
P9.play=(t,bar,s,S,ui)=>{
  const windowLength=sd();
  if(s===0)setDelayTime(6*windowLength,t);
  playDrizzleRibbon(t,bar,s,windowLength,ui);
  playDrizzleBird(t,windowLength,ui);
  if(!MUTE.rain){
    const output=drizzleOutput('rain');
    const impacts=[];
    // Exponential gaps give each stream its own clock. Restarting the draw
    // at a scheduler boundary preserves the process because gaps are memoryless.
    for(const stream of drizzleStreams){
      const rate=stream.rate*S.density;
      const nextGap=()=>-Math.log(1-Math.random())/rate;
      for(let offset=nextGap();offset<windowLength;offset+=nextGap()){
        const note=drizzleScale[Math.floor(Math.random()*drizzleScale.length)]+12*stream.octave;
        const x=.1+Math.random()*.8;
        const y=stream.depth+(Math.random()-.5)*.11;
        const level=stream.level*(.2+.8*Math.random()**2);
        const at=t+offset;
        sine(drizzleHz(note),at,.075+Math.random()*.19,level,output,{atk:.009,pan:(x-.5)*1.8});
        impacts.push({at,x,y,level:level*2});
      }
    }
    impacts.sort((a,b)=>a.at-b.at);
    rainImpacts.push(...impacts);
    if(impacts.length)ui.push(['rain.tone'],['rain.env']);
  }
  if(!MUTE.pad&&s===0&&bar%4===0){
    const [,notes]=drizzleChords[Math.floor(bar/4)%drizzleChords.length];
    const output=drizzleOutput('pad');
    const chordDelay=windowLength*(.15+1.65*Math.random());
    const chordTouch=.88+.24*Math.random();
    if(!drizzleOrganWave){
      const drawbars=Float32Array.of(0,1,.68,.28,.23,.14,.10,.065,.05);
      drizzleOrganWave=ctx.createPeriodicWave(new Float32Array(drawbars.length),drawbars);
    }
    const voices=notes.map((note,i)=>{
      const at=t+chordDelay+(i===0?0:.035+.22*Math.random());
      const duration=windowLength*(66+5*Math.random());
      const release=duration*(.74+.08*Math.random());
      const attack=Math.min(1.65+i*.24+.45*Math.random(),release*.8);
      const touch=chordTouch*(.8+.4*Math.random());
      const peak=(i===0?.028:.012)*touch;
      const frequency=drizzleHz(note);
      const detune=[3,5,4,6,5][i];
      const cutoff=hz=>Math.log(hz/80)/Math.log(200);
      const opts={atk:attack,holdUntil:release,pan:[0,-.35,.35,-.18,.18][i],
        cut:cutoff(420+i*55),sweep:[cutoff((850+i*95)*touch),.95]};
      sine(frequency*2**(-detune/1200),at,duration,peak*.74,output,{...opts,periodicWave:drizzleOrganWave});
      sine(frequency*2**(detune/1200),at,duration,peak*.26,output,{...opts,wave:'square'});
      return {at,duration,frequency,attack,peak,release};
    });
    drizzleVisualChords.push(voices);
    if(drizzleVisualChords.length>2)drizzleVisualChords.shift();
    ui.push(['pad.chord'],['pad.tone'],['pad.env']);
  }
};
function drawDrizzleChordBars(){
  const display=nodeEls['chordView.bars'];
  if(!display||$('patchView').hidden)return;
  const now=ctx.currentTime;
  const mixer=mixState('pad');
  display.querySelectorAll('.chord-voice').forEach((bar,i)=>{
    let height=4;
    const voice=drizzleVisualChords.findLast(voices=>voices[i].at<=now)?.[i];
    if(voice&&!MUTE.pad&&!mixer.mute){
      const {at,duration,frequency,attack,peak,release}=voice,age=now-at;
      if(age<duration){
        const level=age<attack?peak*age/attack:peak*(.0001/peak)**(Math.max(0,age-release)/(duration-release));
        const vibration=REDUCED?1:1+.14*Math.sin(age*(12+frequency*.085)+i);
        height+=68*Math.min(1,Math.sqrt(level*mixer.vol/.022)*vibration);
      }
    }
    bar.setAttribute('y',47-height/2);
    bar.setAttribute('height',height);
  });
}
function drawDrizzleFlock(){
  if($('patchView').hidden)return;
  const screen=nodeEls['birds.bars']?.querySelector('.bird-flock-screen');
  if(!screen)return;
  const width=Number(screen.getAttribute('width')),height=Number(screen.getAttribute('height'));
  const time=REDUCED?0:performance.now()/1000;
  const horizontal=time*.19,vertical=time*.23+.6;
  const centerX=width/2+(width/2-30)*Math.sin(horizontal);
  const centerY=height/2+(height/2-24)*Math.sin(vertical);
  const heading=Math.cos(horizontal);
  let flock='';
  for(let i=0;i<7;i++){
    const x=centerX-(i-3)*7*heading+3*Math.sin(time*1.4+i);
    const y=centerY+(i%2?1:-1)*i*2.5+3*Math.cos(time*1.7+i);
    const lift=1.8+1.1*Math.sin(time*19+i*1.6);
    const wing=2.6+Math.abs(heading);
    flock+=`M${(x-wing).toFixed(1)} ${(y-lift).toFixed(1)} Q${(x-wing/2).toFixed(1)} ${(y-lift-.8).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)} Q${(x+wing/2).toFixed(1)} ${(y-lift-.8).toFixed(1)} ${(x+wing).toFixed(1)} ${(y-lift).toFixed(1)}`;
  }
  screen.firstElementChild.setAttribute('d',flock);
}
function drawDrizzleBirdBars(){
  const display=nodeEls['birds.bars'];
  if(!display||$('patchView').hidden||!ctx)return;
  const now=ctx.currentTime,mixer=mixState('birds');
  display.querySelectorAll('.chord-voice').forEach((bar,i)=>{
    let strength=0;
    if(!MUTE.birds&&!mixer.mute){
      for(const note of drizzleBirdNotes){
        const age=now-note.onset;
        if(age<0||age>=note.duration+.14)continue;
        const envelope=Math.min(1,age/.016)*Math.exp(-age/(note.duration*.85));
        const spread=Math.exp(-((i-2-note.pan*2)**2)/.85);
        strength=Math.max(strength,envelope*spread*note.level/.013);
      }
    }
    const height=4+68*Math.min(1,strength*mixer.vol);
    bar.setAttribute('y',47-height/2);
    bar.setAttribute('height',height);
  });
}
