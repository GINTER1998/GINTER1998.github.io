import {photographs} from './photography-data.js';
const grid=document.querySelector('#photographs');
const groups=['All frames',...new Set(photographs.map(p=>p.series))];
for(const [i,p] of photographs.entries()){
 const figure=document.createElement('figure');figure.dataset.series=p.series;
 const button=document.createElement('button');button.type='button';button.className='photo-open';button.dataset.viewer='';button.dataset.viewerGroup='photography';button.dataset.viewerSrc=p.src;button.dataset.viewerCaption=p.title+' — '+p.caption;button.setAttribute('aria-label','View photograph: '+p.title);
 const img=document.createElement('img');img.src=p.src;img.alt=p.alt;if(p.width)img.width=p.width;if(p.height)img.height=p.height;img.loading=i<2?'eager':'lazy';img.decoding='async';button.append(img);
 const caption=document.createElement('figcaption');const name=document.createElement('span');name.textContent=p.title;const series=document.createElement('span');series.textContent=p.series;caption.append(name,series);figure.append(button,caption);grid.append(figure);
}
const filters=document.querySelector('#photo-filters');
function select(group){let count=0;for(const f of grid.children){f.hidden=group!=='All frames'&&f.dataset.series!==group;if(!f.hidden)count++;}filters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.textContent===group)));document.querySelector('#photo-count').textContent=count+' photograph'+(count===1?'':'s');const url=new URL(location.href);if(group==='All frames')url.searchParams.delete('series');else url.searchParams.set('series',group);history.replaceState(null,'',url);}
for(const group of groups){const b=document.createElement('button');b.type='button';b.textContent=group;b.addEventListener('click',()=>select(group));filters.append(b);}
const requested=new URLSearchParams(location.search).get('series');select(groups.includes(requested)?requested:'All frames');
await import('./viewer.js');
