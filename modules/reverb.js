const REVERB_DEVICE = {id:'rret',name:'REVERB',columns:2,selects:[
    ['mode','MODE',{space:'SPACE',shimmer:'SHIMMER'},'space']
  ],p:[
    ['decay','DECAY',.25,2,1,'×',.01],
    ['preDelay','PRE-DELAY',0,200,0,'ms'],['damping','DAMPING',800,20000,20000,'Hz'],
    ['drift','PITCH DRIFT',0,1,0,''],['shimmer','SHIMMER MIX',0,.65,.35,'']
  ]};

function drizzleReverb(){
  if(bus.drizzleReverb)return bus.drizzleReverb.input;
  const input=ctx.createDelay(.3);
  input.delayTime.value=.052;
  const convolver=ctx.createConvolver();
  const impulse=ctx.createBuffer(2,Math.round(ctx.sampleRate*18),ctx.sampleRate);
  for(let channel=0;channel<impulse.numberOfChannels;channel++){
    const samples=impulse.getChannelData(channel);
    const bloom=channel===0?.27:.39;
    for(let i=0;i<samples.length;i++){
      const seconds=i/ctx.sampleRate;
      const envelope=(1-Math.exp(-seconds/bloom))*Math.exp(-seconds/3.6);
      samples[i]=(Math.random()*2-1)*envelope*Math.min(1,(18-seconds)/1.5);
    }
  }
  convolver.buffer=impulse;
  const highpass=ctx.createBiquadFilter(),lowpass=ctx.createBiquadFilter();
  highpass.type='highpass';highpass.frequency.value=155;highpass.Q.value=.707;
  lowpass.type='lowpass';lowpass.frequency.value=2300;lowpass.Q.value=.707;
  const wet=ctx.createGain();
  wet.gain.value=1.8;
  input.connect(convolver);convolver.connect(highpass);highpass.connect(lowpass);lowpass.connect(wet);wet.connect(bus.revReturn);
  bus.drizzleReverb={input,wet,convolver,impulse};
  applyReverbReturn();
  return input;
}
function buildReverbMotion(source){
  const drift=ctx.createDelay(.04),depth=ctx.createGain(),lfo=ctx.createOscillator();
  drift.delayTime.value=.012;
  depth.gain.value=0;
  lfo.frequency.value=.17;
  source.connect(drift);lfo.connect(depth);depth.connect(drift.delayTime);lfo.start();

  const output=ctx.createGain(),body=ctx.createGain(),shimmer=ctx.createGain();
  shimmer.gain.value=0;
  drift.connect(body);body.connect(output);shimmer.connect(output);
  // A falling delay reads the input at double speed. Two overlapping windows
  // hide the reset at the end of each sweep.
  const length=Math.round(ctx.sampleRate*.085),period=length/ctx.sampleRate;
  const control=ctx.createBufferSource(),split=ctx.createChannelSplitter(4);
  control.buffer=ctx.createBuffer(4,length,ctx.sampleRate);
  control.loop=true;
  control.connect(split);
  for(let tap=0;tap<2;tap++){
    const sweep=control.buffer.getChannelData(tap*2);
    const window=control.buffer.getChannelData(tap*2+1);
    for(let i=0;i<length;i++){
      const phase=(i/length+tap*.5)%1;
      sweep[i]=(1-phase)*period;
      window[i]=.5-.5*Math.cos(2*Math.PI*phase);
    }
    const delay=ctx.createDelay(.12),gain=ctx.createGain();
    delay.delayTime.value=0;gain.gain.value=0;
    split.connect(delay.delayTime,tap*2);
    split.connect(gain.gain,tap*2+1);
    drift.connect(delay);delay.connect(gain);gain.connect(shimmer);
  }
  control.start();
  bus.reverbMotion={depth,body,shimmer};
  return output;
}
function applyReverbReturn(){
  const state=returnSettings('rret'),at=ctx.currentTime;
  bus.revReturn.gain.setTargetAtTime(state.on&&!state.mute&&soloReturn('rret')?state.vol:0,at,.02);
  bus.revDamping.frequency.setTargetAtTime(state.damping,at,.03);
  const motion=bus.reverbMotion;
  const blend=state.mode==='shimmer'?state.shimmer:0;
  motion.depth.gain.setTargetAtTime(.009*state.drift,at,.08);
  motion.body.gain.setTargetAtTime(1-blend,at,.04);
  motion.shimmer.gain.setTargetAtTime(blend,at,.04);
  for(const room of [bus.reverbRoom,bus.drizzleReverb]){
    if(!room)continue;
    room.input.delayTime.setTargetAtTime((state.preDelay+(room===bus.drizzleReverb?52:0))/1000,at,.03);
    if(room.decay===state.decay)continue;
    room.decay=state.decay;
    const scale=state.decay;
    if(scale===1){if(room.convolver.buffer!==room.impulse)room.convolver.buffer=room.impulse;continue;}
    const original=room.impulse;
    const buffer=ctx.createBuffer(original.numberOfChannels,Math.round(original.length*scale),original.sampleRate);
    for(let channel=0;channel<buffer.numberOfChannels;channel++){
      const source=original.getChannelData(channel),target=buffer.getChannelData(channel);
      for(let i=0;i<target.length;i++){
        const index=i/scale,j=Math.floor(index),fraction=index-j;
        target[i]=(source[j]||0)*(1-fraction)+(source[j+1]||0)*fraction;
      }
    }
    room.convolver.buffer=buffer;
  }
}
