const UTILITY_DEVICE = {id:'width',name:'UTILITY',p:[['w','WIDTH',0,2,1.15,''],['bm','BASS MONO',20,250,120,'Hz'],['ug','GAIN',-12,12,0,'dB']]};

function buildStereoUtility(c,g,dev){
  // UTILITY: a Linkwitz–Riley crossover (two 12 dB filters per side, so the bands sum back flat). Below the
    // crossover the signal is folded to mono (a 1-channel gain node mixes L and R, and spreads back to both sides);
    // above it, the mid/side WIDTH. Then GAIN.
    const sp2=c.createChannelSplitter(2),mg=c.createChannelMerger(2),ll=g(),lr=g(),rr=g(),rl=g(),wi=g(),ug=g();
    const bq=t=>{const f=c.createBiquadFilter();f.type=t;f.Q.value=Math.SQRT1_2;return f;},lp1=bq('lowpass'),lp2=bq('lowpass'),hp1=bq('highpass'),hp2=bq('highpass'),mono=g();
    mono.channelCount=1;mono.channelCountMode='explicit';mono.channelInterpretation='speakers';
    wi.connect(lp1);lp1.connect(lp2);lp2.connect(mono);mono.connect(ug);wi.connect(hp1);hp1.connect(hp2);hp2.connect(sp2);
    sp2.connect(ll,0);sp2.connect(rl,0);sp2.connect(rr,1);sp2.connect(lr,1);ll.connect(mg,0,0);lr.connect(mg,0,0);rr.connect(mg,0,1);rl.connect(mg,0,1);mg.connect(ug);
    const device=dev('width',wi,ug);Object.assign(device,{ll,lr,rr,rl,ug,xo:[lp1,lp2,hp1,hp2]});
}
