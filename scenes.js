// Keep each landscape mounted so switching preserves its camera and marks.
const hero=document.querySelector('#home');
const scenes={ocean:document.querySelector('#ocean-scene'),sand:document.querySelector('#sand-scene')};
const buttons=[...document.querySelectorAll('[data-landscape]')];
const announcement=document.querySelector('#scene-announcement');
let active='sand',inView=true;

function syncVisibility(){
 for(const [id,frame] of Object.entries(scenes)){
  if(!frame?.getAttribute('src'))continue;
  const visible=id===active&&inView&&!document.hidden;
  frame.dataset.active=String(visible);
  frame.contentWindow?.postMessage({type:`ginter-${id}-visibility`,visible},location.origin);
 }
}
function chooseScene(id,updateURL=true){
 if(!scenes[id])id='sand';
 active=id;
 for(const [key,frame] of Object.entries(scenes)){
  frame.hidden=key!==id;
  if(key===id&&!frame.getAttribute('src')&&frame.dataset.src)frame.src=frame.dataset.src;
 }
 hero.dataset.scene=id;
 for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.landscape===id));
 if(announcement)announcement.textContent=id==='sand'?'Dune Garden. Move across the sand to rake.':'Dusk. Drag to look around.';
 if(updateURL){
  const url=new URL(location.href);
  if(id==='sand')url.searchParams.delete('scene');else url.searchParams.set('scene','dusk');
  history.replaceState(null,'',url);
 }
 syncVisibility();
}
if(hero&&scenes.ocean&&scenes.sand){
 for(const button of buttons)button.addEventListener('click',()=>chooseScene(button.dataset.landscape));
 for(const frame of Object.values(scenes))frame.addEventListener('load',syncVisibility);
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  for(const [id,frame] of Object.entries(scenes)){
   if(event.source!==frame.contentWindow)continue;
   if(event.data?.type===`ginter-${id}-ready`)syncVisibility();
   if(event.data?.type===`ginter-${id}-state`){
    frame.dataset.visible=String(event.data.visible);
    frame.dataset.lastFrame=String(event.data.frame);
    if(event.data.time!==undefined)frame.dataset.lastTime=String(event.data.time);
   }
   break;
  }
 });
 new IntersectionObserver(entries=>{
  inView=entries[0].isIntersecting&&entries[0].intersectionRatio>.12;
  syncVisibility();
 },{threshold:[0,.12]}).observe(hero);
 document.addEventListener('visibilitychange',syncVisibility);
 window.addEventListener('popstate',()=>chooseScene(['dusk','ocean'].includes(new URLSearchParams(location.search).get('scene'))?'ocean':'sand',false));
 chooseScene(['dusk','ocean'].includes(new URLSearchParams(location.search).get('scene'))?'ocean':'sand',false);
}
