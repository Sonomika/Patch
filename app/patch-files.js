const PATCH_FILE_LIMIT = 256 * 1024;
const PORTABLE_PATCH_LIMIT = 64 * 1024 * 1024;
const assetURL=path=>typeof patchAsset==='function'?patchAsset(path):path;

async function downloadPatchFile(){
  const snapshot = JSON.parse(patchSettingsText());
  const musicalKey = {
    'fibonacci-chance':'F-minor', 'coprime-drift':'A-major',
    'life-from-sine':'A-major', 'two-ways':'D-dorian',
    'seven-riffles':'Eb-minor', flock:'D-hirajoshi', 'rain-lock':'F-minor',
    drizzle:'D-hirajoshi', dialogue:'unkeyed', olympus:'unkeyed'
  }[PATCH.id] ?? 'variable-key';
  const tempo = PATCH.stepSeconds ? 'no-bpm' : `${PATCH.bpm}bpm`;
  const file = {format:'sonomika-patch',version:1,patchId:PATCH.id,musicalKey,...snapshot};
  file.player=await buildPortablePlayer(PATCH,file);
  file.version=2;
  const blob = new Blob([JSON.stringify(file,null,2)],{type:'application/json'});
  if(blob.size>PORTABLE_PATCH_LIMIT)throw new Error('The portable patch is too large.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${file.patch.toLowerCase()}-${musicalKey}-${tempo}-portable.patch`;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}

function readPatchFile(text){
  const file = JSON.parse(text);
  const patch = PATCHES.find(p=>p.id===file?.patchId);
  if(file?.format!=='sonomika-patch'||file.version!==1||!patch)throw new Error('This patch file needs a supported Sonomika Patch version.');
  const record = value=>value&&typeof value==='object'&&!Array.isArray(value);
  const number = (value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  const mixer = {};
  const channels = [...(patch.mix??['drums','low','hats','fx']),'rret','dret','vinylNoise','master'];
  const settings = (source,device,extra=[])=>{
    if(!record(source))throw new Error('The patch file has invalid mixer settings.');
    const result = {};
    for(const [key,,min,max] of [...(device?.p??[]),...extra]){
      if(source[key]===undefined)continue;
      if(!number(source[key],min,max))throw new Error('The patch file has an out-of-range mixer setting.');
      result[key]=source[key];
    }
    for(const [key,,options] of device?.selects??(device?.sel?[device.sel]:[])){
      if(Object.hasOwn(options,source[key]))result[key]=source[key];
    }
    for(const key of ['on','mute'])if(typeof source[key]==='boolean')result[key]=source[key];
    return result;
  };
  const eq = MST_DEV.find(d=>d.id==='eq');
  const sat = MST_DEV.find(d=>d.id==='sat');
  const channelRanges = [['vol','',0,1.5],['pan','',-1,1],['drv','',0,1],['rev','',0,1],['dly','',0,1]];
  for(const id of channels){
    const source=file.mixer?.[id];
    if(source===undefined)continue;
    mixer[id]=settings(source,RETURN_DEVICES[id]??sat,[
      ...channelRanges,['timeScale','',.01,10],['feedback','',0,1]
    ]);
    if(source.eq!==undefined)mixer[id].eq=settings(source.eq,eq);
    if(Array.isArray(source.effectOrder)){
      const ids=id==='master'?MST_DEV.map(d=>d.id):['drive','eq'];
      mixer[id].effectOrder=source.effectOrder.filter(key=>ids.includes(key));
    }
  }
  mixer.mst={};
  for(const device of MST_DEV){
    const source=file.masterEffects?.[device.id];
    if(source!==undefined)mixer.mst[device.id]=settings(source,device);
  }
  mixer.mst.lufs={target:-10,trim:0,...settings(file.masterEffects?.lufs??{},null,[['target','',-40,0],['trim','',-24,0]])};

  const layout=file.layout??{};
  const point=value=>number(value?.x,-1e6,1e6)&&number(value?.y,-1e6,1e6);
  const modules={};
  for(const module of [...patch.modules,VINYL_MODULE]){
    const position=layout.modules?.[module.id];
    if(point(position))modules[module.id]={x:position.x,y:position.y};
  }
  const video=layout.video;
  const videoLayout=point(video)&&number(video.bw,1,10000)&&number(video.bh,1,10000)
    ? {x:video.x,y:video.y,bw:video.bw,bh:video.bh,ratio:video.bw/video.bh}:null;
  const overrides=Object.fromEntries(Object.entries(patch.edit??{}).flatMap(([key,{min,max}])=>{
    const value=file.overrides?.[key];
    return number(value,min,max)?[[key,value]]:[];
  }));
  const pan=point(layout.pan)?layout.pan:{x:0,y:0};
  return {patch,mixer,modules,videoLayout,layout,pan,overrides,file};
}

function applyPatchSnapshot(text){
  const {patch,mixer,modules,videoLayout,layout,pan,overrides,file}=readPatchFile(text);
  if(playing)stop();
  mixerSelection='master';
  mixerSolos.clear();
  MIXST[patch.id]=mixer;
  MPOS[patch.id]=modules;
  if(videoLayout)saveVideoLayout(patch.id,videoLayout);
  else delete videoLayouts[patch.id];
  savedFrame=['portrait','landscape'].includes(layout.frame)?layout.frame:'';
  savedZoom=Number.isFinite(layout.zoom)?Math.max(.01,Math.min(2.5,layout.zoom)):1;
  PAN.x=pan.x;
  PAN.y=pan.y;
  HOLDS[patch.id]=overrides;
  if(Number.isFinite(file.bpm)&&file.bpm>=1&&file.bpm<=999&&!patch.stepSeconds)patch.bpm=file.bpm;
  if(Number.isSafeInteger(file.seed)&&file.seed>=0&&file.seed<=2147483647)patch.seed=file.seed;
  const muted=Array.isArray(file.mutedModules)?file.mutedModules:[];
  for(const module of patch.modules)if(module.voice)delete MUTE[module.voice];
  for(const module of patch.modules)if(module.voice&&muted.includes(module.id))MUTE[module.voice]=true;
  try{
    localStorage.setItem('ff-app-frame',savedFrame);
    localStorage.setItem('ff-patch-zoom',savedZoom);
    localStorage.setItem('ff-patch-mpos',JSON.stringify(MPOS));
    localStorage.setItem(VIDEO_LAYOUT_KEY,JSON.stringify(videoLayouts));
  }catch(e){}
  saveMix();
  loadPatch(patch);
  applyPan();
  const suffix=layout.view==='patch'?'-patch':layout.view==='mixer'?'-mixer':'';
  if(typeof PORTABLE_PATCH!=='undefined'){
    select(patch);
    showView(suffix==='-mixer'?'mixer':suffix==='-patch'?'patch':'wires',false,layout.mixerGrid===true);
  }else go(patch.id+suffix,false,layout.mixerGrid===true);
}

function bindPatchFiles(menu,setMenu){
  if(typeof PORTABLE_PATCH!=='undefined')return;
  const picker=document.createElement('input');
  picker.type='file';
  picker.accept='.patch';
  picker.hidden=true;
  menu.appendChild(picker);
  const importText=(text,fromClipboard=false)=>{
    const size=new Blob([text]).size;
    if(size>PORTABLE_PATCH_LIMIT)throw new Error('The patch file is too large.');
    let data;
    try{data=JSON.parse(text);}
    catch(error){throw new Error('The text is not valid patch data.');}
    if(data?.format==='sonomika-patch'&&data.version===2){
      openPortablePlayer(data);
    }else{
      if(size>PATCH_FILE_LIMIT)throw new Error('The settings are too large.');
      if(fromClipboard&&data?.format===undefined&&typeof data?.patch==='string'){
        const patch=PATCHES.find(p=>p.id===data.patchId||p.title===data.patch);
        if(!patch)throw new Error('This patch is not in the library.');
        text=JSON.stringify({...data,format:'sonomika-patch',version:1,patchId:patch.id});
      }
      applyPatchSnapshot(text);
    }
    setMenu(false);
  };
  const open=async file=>{
    if(!file)return;
    try{
      if(!file.name.toLowerCase().endsWith('.patch'))throw new Error('Choose a Sonomika .patch file.');
      if(file.size>PORTABLE_PATCH_LIMIT)throw new Error('The patch file is too large.');
      importText(await file.text());
    }catch(error){alert(error.message);}
  };
  const paste=()=>{
    const dialog=document.createElement('dialog');
    dialog.className='paste-patch';
    dialog.setAttribute('aria-labelledby','pastePatchTitle');
    dialog.innerHTML='<form><label id="pastePatchTitle" for="pastePatchText">Paste patch</label><textarea id="pastePatchText" rows="10" autofocus required spellcheck="false"></textarea><p role="alert" hidden></p><div><button class="fld" type="button">Cancel</button><button class="fld" type="submit">Load patch</button></div></form>';
    const form=dialog.querySelector('form');
    const field=form.querySelector('textarea');
    const message=form.querySelector('[role="alert"]');
    form.querySelector('[type="button"]').onclick=()=>dialog.close();
    form.onsubmit=event=>{
      event.preventDefault();
      try{
        importText(field.value,true);
        dialog.close();
      }catch(error){
        message.textContent=error.message;
        message.hidden=false;
      }
    };
    dialog.addEventListener('close',()=>dialog.remove(),{once:true});
    document.body.appendChild(dialog);
    dialog.showModal();
  };
  picker.onchange=()=>{open(picker.files[0]);picker.value='';};
  const actions=[['Save patch',downloadPatchFile],['Open patch',()=>picker.click()],['Paste patch',paste]];
  for(const [label,action] of actions){
    const button=document.createElement('button');
    button.type='button';
    button.className='fld';
    button.textContent=label;
    button.onclick=async()=>{
      button.disabled=true;
      try{await action();}catch(error){alert(error.message);}
      finally{button.disabled=false;}
    };
    menu.appendChild(button);
  }
  window.addEventListener('dragover',event=>{
    if(event.dataTransfer?.types.includes('Files')){
      event.preventDefault();
      event.dataTransfer.dropEffect='copy';
    }
  });
  window.addEventListener('drop',event=>{
    const files=event.dataTransfer?.files;
    if(!files?.length)return;
    event.preventDefault();
    if(files.length===1)open(files[0]);
    else alert('Drop one patch file at a time.');
  });
}
