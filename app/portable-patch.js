// The existing patches share a classic-script runtime. Package that runtime
// in its original load order so even patches with cross-patch helpers can run.
async function buildPortablePlayer(patch,snapshot){
  const html=await fetchPortableResource('index.html','text');
  const player=new DOMParser().parseFromString(html,'text/html');
  const assets=portableAssets(patch);
  const media=Object.fromEntries(await Promise.all(assets.map(async path=>{
    const blob=await fetchPortableResource(path,'blob');
    const data=await new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(reader.result);
      reader.onerror=()=>reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return [path,data];
  })));
  const stylesheet=player.querySelector('link[href^="styles/"]');
  const style=player.createElement('style');
  style.textContent=await fetchPortableResource(stylesheet.getAttribute('href'),'text');
  stylesheet.replaceWith(style);
  const bootstrap=player.createElement('script');
  bootstrap.textContent=`
    const PORTABLE_PATCH = ${portableScriptJSON(snapshot)};
    const portableMedia = ${portableScriptJSON(media)};
    function patchAsset(path){
      return portableMedia[path.split('?')[0]] ?? 'data:,';
    }
  `;
  player.head.prepend(bootstrap);
  await Promise.all([...player.querySelectorAll('script[src]')].map(async script=>{
    const source=script.getAttribute('src');
    if(source.startsWith('https:'))return;
    script.textContent=(await fetchPortableResource(source,'text')).replace(/<\/script/gi,'<\\/script');
    script.removeAttribute('src');
    script.removeAttribute('defer');
  }));
  return '<!doctype html>\n'+player.documentElement.outerHTML;
}

function portableScriptJSON(value){
  return JSON.stringify(value).replace(/</g,'\\u003c');
}

async function fetchPortableResource(path,method){
  const response=await fetch(path);
  if(!response.ok)throw new Error('Could not bundle '+path);
  return response[method]();
}

function portableAssets(patch){
  if(patch.backdrop)return [patch.backdrop];
  if(patch===P11)return olLeakPhotos.slice(0,9).map(name=>'patches/security/images/'+name);
  return [];
}

function openPortablePlayer(data){
  if(typeof data.player!=='string'||!data.player.trim())throw new Error('The portable patch is missing its player.');
  if(!confirm('Open this portable patch? It contains executable code and runs in an isolated player. Only open files you trust.'))return;
  if(playing)stop();
  const dialog=document.createElement('dialog');
  dialog.className='portable-player';
  const close=document.createElement('button');
  close.className='fld';
  close.textContent='Close patch';
  close.onclick=()=>dialog.close();
  const frame=document.createElement('iframe');
  frame.title='Portable Sonomika patch';
  frame.setAttribute('sandbox','allow-scripts');
  frame.allow='autoplay';
  const policy=document.createElement('meta');
  policy.httpEquiv='Content-Security-Policy';
  policy.content="default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data: blob:; media-src data: blob:; connect-src data: blob:";
  // Put the policy before any markup from the imported file.
  frame.srcdoc='<!doctype html>'+policy.outerHTML+data.player;
  dialog.append(close,frame);
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.append(dialog);
  dialog.showModal();
}
