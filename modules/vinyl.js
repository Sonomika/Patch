const VINYL_DEVICE = {id:'vinyl',name:'VINYL',p:[['tone','WARMTH',0,1,.35,''],['wow','WOW',0,1,.25,''],['dust','CRACKLE',0,1,.18,'']]};

const VINYL_MODULE={
  id:'masterVinyl',title:'VINYL',sub:'Master output effect',masterEffect:'vinyl',h:148,
  nodes:[
    ['input','obj',10,18,'Master mix'],
    ['effect','obj',10,59,'vinyl~'],
    ['output','obj',10,100,'To limiter'],
    ['record','vinyl-record',153,18,'',108,108],
    ['tg','tgl',260,10]
  ],
  wires:[['input','effect',1],['effect','output',1]]
};
const canvasModules=()=>PATCH.vinyl===false?PATCH.modules:[...PATCH.modules,VINYL_MODULE];

function buildVinyl(c){
  const drift=c.createDelay(.05);
  drift.delayTime.value=.008;
  const rolloff=c.createBiquadFilter();
  rolloff.type='lowpass';
  rolloff.Q.value=.5;
  const warmth=c.createWaveShaper();
  warmth.curve=Float32Array.from({length:2048},(_,i)=>Math.tanh(1.16*(i/1023.5-1))/1.16);
  warmth.oversample='2x';
  drift.connect(rolloff);
  rolloff.connect(warmth);

  const wow=c.createGain(),flutter=c.createGain();
  for(const [rate,depth] of [[33.333/60,wow],[5.7,flutter]]){
    depth.gain.value=0;
    const lfo=c.createOscillator();
    lfo.frequency.value=rate;
    lfo.connect(depth);
    depth.connect(drift.delayTime);
    lfo.start();
  }

  const surface=c.createBufferSource();
  surface.buffer=c.createBuffer(1,Math.round(c.sampleRate*14.4),c.sampleRate);
  surface.loop=true;
  const samples=surface.buffer.getChannelData(0);
  let crackle=0;
  for(let i=0;i<samples.length;i++){
    if(Math.random()<14/c.sampleRate)crackle+=(Math.random()<.5?-1:1)*(.08+.85*Math.random()**3);
    samples[i]=(Math.random()-.5)*.08+crackle;
    crackle*=.91;
  }
  const surfaceFilter=c.createBiquadFilter(),noise=c.createGain(),output=c.createGain();
  surfaceFilter.type='bandpass';
  surfaceFilter.frequency.value=1900;
  surfaceFilter.Q.value=.65;
  noise.gain.value=0;
  surface.connect(surfaceFilter);
  surfaceFilter.connect(noise);
  const eq=connectChannelEq(noise,output);
  const meter=c.createAnalyser();
  meter.fftSize=512;
  eq.hi.connect(meter);
  STR.vinylNoise={eq,an:meter,buf:new Float32Array(512)};
  warmth.connect(output);
  surface.start();
  return {input:drift,output,rolloff,wow,flutter,noise};
}
function applyVinylNoise(settings=mstState().vinyl){
  const vinyl=MST.n.vinyl;
  if(!vinyl)return;
  const channel=mixState('vinylNoise');
  const level=PATCH.vinyl!==false&&playing&&settings.on&&!channel.mute&&(!mixerSolos.size||mixerSolos.has('vinylNoise'))?settings.dust*.18*channel.vol:0;
  vinyl.noise.gain.setTargetAtTime(level,ctx.currentTime,.04);
}
