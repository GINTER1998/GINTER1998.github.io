// Native modal dialog provides focus containment and Escape support.
const triggers=[...document.querySelectorAll('[data-viewer]')];
if(triggers.length){
const modal=document.createElement('dialog');modal.className='image-viewer';modal.setAttribute('aria-labelledby','viewer-caption');
modal.innerHTML='<div class="viewer-top"><span id="viewer-count"></span><button type="button" class="viewer-close" aria-label="Close image viewer">CLOSE ×</button></div><figure><img id="viewer-image" alt=""><figcaption id="viewer-caption"></figcaption></figure><div class="viewer-bottom"><button type="button" class="viewer-prev" aria-label="Previous image">← PREVIOUS</button><span>USE ← → TO BROWSE · ESC TO CLOSE</span><button type="button" class="viewer-next" aria-label="Next image">NEXT →</button></div>';
document.body.append(modal);
let group=[],current=0,opener=null;
const image=modal.querySelector('img'),caption=modal.querySelector('figcaption'),count=modal.querySelector('#viewer-count'),prev=modal.querySelector('.viewer-prev'),next=modal.querySelector('.viewer-next');
function show(){const button=group[current],thumb=button.querySelector('img');image.src=button.dataset.viewerSrc||thumb.currentSrc||thumb.src;image.alt=thumb.alt||button.dataset.viewerCaption||'Portfolio image';caption.textContent=button.dataset.viewerCaption||thumb.alt;count.textContent=String(current+1).padStart(2,'0')+' / '+String(group.length).padStart(2,'0');prev.disabled=current===0;next.disabled=current===group.length-1;}
for(const button of triggers)button.addEventListener('click',()=>{opener=button;group=triggers.filter(t=>!t.closest('[hidden]')&&(t.dataset.viewerGroup||'default')===(button.dataset.viewerGroup||'default'));current=group.indexOf(button);show();modal.showModal();document.body.classList.add('viewer-open');modal.querySelector('.viewer-close').focus();});
modal.querySelector('.viewer-close').addEventListener('click',()=>modal.close());
prev.addEventListener('click',()=>{if(current>0){current--;show();}});next.addEventListener('click',()=>{if(current<group.length-1){current++;show();}});
modal.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'&&current>0){e.preventDefault();current--;show();}if(e.key==='ArrowRight'&&current<group.length-1){e.preventDefault();current++;show();}});
modal.addEventListener('click',e=>{if(e.target===modal)modal.close();});
modal.addEventListener('close',()=>{document.body.classList.remove('viewer-open');image.removeAttribute('src');opener?.focus();});
}
