import {works} from './work-data.js';
const grid=document.querySelector('#work-grid');
const filters=[...document.querySelectorAll('[data-filter]')];
for(const work of works){
 const article=document.createElement('article');article.className='work-card';article.dataset.category=work.category;
 const link=document.createElement('a');link.href=work.href;link.className='work-card-link';
 const media=document.createElement('div');media.className='work-card-image';const image=document.createElement('img');image.src=work.image;image.alt=work.alt;image.loading='lazy';image.decoding='async';const action=document.createElement('span');action.className='work-card-action';action.textContent=work.action+' ↗';media.append(image,action);
 const meta=document.createElement('div');meta.className='work-card-meta';const head=document.createElement('div');const label=document.createElement('p');label.className='work-label';label.textContent=work.label;const title=document.createElement('h3');title.textContent=work.title;head.append(label,title);const note=document.createElement('p');note.textContent=work.note;meta.append(head,note);link.append(media,meta);article.append(link);grid.append(article);
}
function select(category){let count=0;for(const card of grid.children){card.hidden=category!=='all'&&card.dataset.category!==category;if(!card.hidden)count++;}for(const button of filters){button.setAttribute('aria-pressed',String(button.dataset.filter===category));const n=button.dataset.filter==='all'?works.length:works.filter(w=>w.category===button.dataset.filter).length;button.querySelector('span').textContent=String(n).padStart(2,'0');}document.querySelector('#work-count').textContent=count+' selection'+(count===1?'':'s');}
for(const button of filters)button.addEventListener('click',()=>select(button.dataset.filter));select('all');

// The ocean is an independent, single-file scene. Suspend it whenever it
// leaves the page viewport so browsing the portfolio does not use GPU time.
const ocean=document.querySelector('#ocean-scene');
const hero=document.querySelector('.ocean-hero');
let oceanInView=true;
function syncOceanVisibility(){
 ocean?.contentWindow?.postMessage({type:'ginter-ocean-visibility',visible:oceanInView&&!document.hidden},location.origin);
}
if(ocean&&hero){
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==ocean.contentWindow)return;
  if(event.data?.type==='ginter-ocean-ready')syncOceanVisibility();
  if(event.data?.type==='ginter-ocean-state'){
   ocean.dataset.visible=String(event.data.visible);
   ocean.dataset.lastFrame=String(event.data.frame);
   ocean.dataset.lastTime=String(event.data.time);
  }
 });
 ocean.addEventListener('load',syncOceanVisibility);
 new IntersectionObserver(entries=>{
  oceanInView=entries[0].isIntersecting&&entries[0].intersectionRatio>.12;
  syncOceanVisibility();
 },{threshold:[0,.12]}).observe(hero);
 document.addEventListener('visibilitychange',syncOceanVisibility);
 syncOceanVisibility();
}
