function visLoop(){requestAnimationFrame(visLoop);const box=$('vis');if(!box||$('visw').hidden||!PATCH.visual)return;
  if(window.V3FAIL){$('visw').hidden=true;return;}if(!window.V3)return;
  // every visual draws at the window's real pixel size, but its line widths and dot sizes scale with that size
  // (VLS = 1 at 900 px on the long side), so shrinking or growing the window scales the picture as a whole:
  // outlines keep their proportions and stay crisp instead of staying the same pixel width
  const pr=Math.min(2,devicePixelRatio||1),w=(box.clientWidth||16)*pr,h=(box.clientHeight||9)*pr,vb={clientWidth:Math.round(w),clientHeight:Math.round(h)};VLS=Math.max(w,h)/900;
  if(PATCH.visual==='sunflower')sunFrame(vb);else if(PATCH.visual==='mirror')mirrorFrame(vb);else if(PATCH.visual==='decks')decksFrame(vb);else if(PATCH.visual==='rain')rainFrame(vb);else circlesFrame(vb);
}
let VLS=1; // line and dot scale for the visuals, set every frame from the frame size
