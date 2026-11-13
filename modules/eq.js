const EQ_DEVICE = {id:'eq',name:'EQ THREE',p:[['lo','LOW',-12,12,0,'dB'],['mid','MID',-12,12,0,'dB'],['hi','HIGH',-12,12,0,'dB']]};

function buildThreeBandEq(context){
  const lo=context.createBiquadFilter(),mid=context.createBiquadFilter(),hi=context.createBiquadFilter();
  lo.type='lowshelf';lo.frequency.value=120;
  mid.type='peaking';mid.frequency.value=1000;mid.Q.value=.8;
  hi.type='highshelf';hi.frequency.value=8000;
  lo.connect(mid);mid.connect(hi);
  return {lo,mid,hi};
}
function connectChannelEq(source,destination){
  const eq=buildThreeBandEq(ctx);
  source.connect(eq.lo);eq.hi.connect(destination);
  return eq;
}
