/* icons: Lucide (loaded above). IC(name) gives the SVG; <i data-ic="Name">fallback</i> is swapped for it */
const IC=(n,fb)=>{try{const e=lucide.createElement(lucide.icons[n]);e.setAttribute('aria-hidden','true');return e.outerHTML;}catch(err){return fb||'';}};
function fillIcons(root=document){root.querySelectorAll('i[data-ic]').forEach(i=>{const svg=IC(i.dataset.ic);if(!svg)return;i.innerHTML=svg;i.classList.add('ic');});}
