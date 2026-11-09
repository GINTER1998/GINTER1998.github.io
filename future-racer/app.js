import {MusicPlayer,demoProfile,generateDemo,featureAt,clamp} from './music.js';
import {buildTrack,initialCar,stepCar,startBoost,sampleTrack} from './track.js';
import {RaceScene} from './scene.js?v=20261108-2';
const $=id=>document.getElementById(id),player=new MusicPlayer();
let profile=demoProfile(),track=buildTrack(profile),car=initialCar(track),scene,state='loading',title='CONCRETE AFTER HOURS',isDemo=true,loading=false,worker=null,loadId=0,keys=new Set(),accumulator=0,previous=performance.now(),uiClock=0,toastTimer,lowQuality=false,fpsTime=0,fpsFrames=0,fps=0;
const formatTime=t=>`${String(Math.floor(Math.max(0,t)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
const show=(id,visible)=>$(id).hidden=!visible;
function toast(message){$('toast').textContent=message;show('toast',true);clearTimeout(toastTimer);toastTimer=setTimeout(()=>show('toast',false),2600);}
function setStatus(message=''){ $('status').textContent=message;show('status',!!message); }
function startLabel(text){$('start').firstElementChild.textContent=text;}
function updateProfile(){
 $('track-name').textContent=title;$('playing-name').textContent=title;
 $('bpm').innerHTML=`${profile.bpm||'—'} <small>BPM</small>`;$('track-length').innerHTML=`${(track.length/1000).toFixed(2)} <small>KM</small>`;$('duration').innerHTML=`${formatTime(profile.duration)} <small>TIME</small>`;
 const canvas=$('waveform'),ctx=canvas.getContext('2d');canvas.width=600;canvas.height=84;ctx.clearRect(0,0,600,84);ctx.fillStyle='#b9ceac';
 for(let x=0;x<600;x+=4){const e=featureAt(profile,x/600*profile.duration),h=Math.max(2,e*65);ctx.fillRect(x,(84-h)/2,2,h);}
 drawMap();
}
function drawMap(){
 const canvas=$('minimap'),ctx=canvas.getContext('2d'),w=180;ctx.clearRect(0,0,w,w);
 // Show the next 600 metres in the car's frame, so the map remains useful on long songs.
 const p=sampleTrack(track,car.s),project=q=>{const dx=q.x-p.x,dz=q.z-p.z;return[90+(dx*Math.cos(p.heading)-dz*Math.sin(p.heading))*.18,150-(dx*Math.sin(p.heading)+dz*Math.cos(p.heading))*.2];};
 ctx.lineWidth=2;ctx.strokeStyle='#d0ddbd70';ctx.beginPath();for(let s=Math.max(0,car.s-80);s<Math.min(track.length,car.s+660);s+=8){const xy=project(sampleTrack(track,s));if(s===Math.max(0,car.s-80))ctx.moveTo(...xy);else ctx.lineTo(...xy);}ctx.stroke();ctx.fillStyle='#e4edcc';ctx.beginPath();ctx.moveTo(90,144);ctx.lineTo(86,155);ctx.lineTo(94,155);ctx.fill();
}
function analyze(buffer){return new Promise((resolve,reject)=>{
 worker?.terminate();worker=new Worker(new URL('./analysis-worker.js',import.meta.url),{type:'module'});const active=worker;
 const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i).slice());
 active.onmessage=({data})=>{active.terminate();if(worker===active)worker=null;data.error?reject(Error(data.error)):resolve(data.profile);};active.onerror=e=>{active.terminate();reject(Error(e.message||'Could not analyze this track'));};active.postMessage({channels,sampleRate:buffer.sampleRate},channels.map(c=>c.buffer));
});}
async function loadAudio(file){
 if(!file||loading)return;if(file.size>80*1024*1024){toast('Choose an audio file under 80 MB.');return;}
 const id=++loadId;loading=true;$('start').disabled=true;startLabel('Loading music…');setStatus('Analyzing…');
 try{
  const buffer=await player.decode(file);if(buffer.duration<5||buffer.duration>600)throw Error('Choose a track between 5 seconds and 10 minutes.');
  startLabel('Analyzing…');const next=await analyze(buffer);if(id!==loadId)return;
  profile=next;title=file.name.replace(/\.[^.]+$/,'');isDemo=false;player.load(buffer);track=buildTrack(profile);car=initialCar(track);scene.setTrack(track);updateProfile();show('demo',true);
  setStatus();
 }catch(e){setStatus(`Unable to load audio. ${e.message}`);}
 finally{loading=false;$('start').disabled=state==='loading';startLabel('Drive');$('audio-file').value='';}
}
async function startRace(){
 if(loading||state==='loading')return;loading=true;$('start').disabled=true;startLabel('Loading music…');
 try{
  await player.ready();if(!player.buffer){await new Promise(requestAnimationFrame);player.load(generateDemo(player.ctx));}
  player.reset();car=initialCar(track);scene.setTrack(track);scene.mode=0;scene.lightsOpen=false;keys.clear();accumulator=0;
  document.body.classList.add('racing');for(const id of ['intro','music-panel','pause-overlay','finish-overlay'])show(id,false);show('hud',true);show('menu-button',true);
  state='running';player.play();$('play-pause').textContent='Ⅱ';$('play-pause').setAttribute('aria-label','Pause');document.activeElement?.blur();
 }catch(e){setStatus(`Unable to start audio. ${e.message}`);}
 finally{loading=false;$('start').disabled=false;startLabel('Drive');}
}
function pause(){if(state!=='running')return;player.pause();state='paused';keys.clear();show('pause-overlay',true);$('play-pause').textContent='▶';$('play-pause').setAttribute('aria-label','Resume');}
async function resume(){if(state!=='paused')return;try{await player.ready();player.play();state='running';accumulator=0;show('pause-overlay',false);$('play-pause').textContent='Ⅱ';$('play-pause').setAttribute('aria-label','Pause');document.activeElement?.blur();}catch(e){toast(e.message);}}
function toMenu(){player.reset();state='menu';keys.clear();document.body.classList.remove('racing');for(const id of ['hud','menu-button','pause-overlay','finish-overlay'])show(id,false);for(const id of ['intro','music-panel'])show(id,true);car=initialCar(track);scene.setTrack(track);}
function finish(reached){
 if(state!=='running')return;player.pause();state='finished';keys.clear();show('finish-overlay',true);
 $('finish-title').textContent=reached?'FINISH':'TIME UP';
 $('result-distance').textContent=(car.distance/1000).toFixed(2);$('result-speed').textContent=Math.round(car.maxSpeed*3.6);$('result-progress').textContent=Math.round(clamp(car.s/track.length)*100);
}
function resetToRoad(){const p=sampleTrack(track,car.s);car.x=p.x;car.z=p.z;car.heading=p.heading;car.speed=0;car.steer=0;}
$('audio-file').addEventListener('change',e=>loadAudio(e.target.files[0]));
for(const event of ['dragenter','dragover'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.add('dragging');});
for(const event of ['dragleave','drop'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.remove('dragging');if(event==='drop')loadAudio(e.dataTransfer.files[0]);});
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
$('demo').onclick=()=>{if(loading)return;player.reset();player.buffer=null;profile=demoProfile();track=buildTrack(profile);car=initialCar(track);title='CONCRETE AFTER HOURS';isDemo=true;scene.setTrack(track);updateProfile();show('demo',false);setStatus();};
$('start').onclick=startRace;$('resume').onclick=resume;$('restart').onclick=startRace;$('again').onclick=startRace;$('change-music').onclick=toMenu;$('finish-back').onclick=toMenu;$('menu-button').onclick=pause;$('play-pause').onclick=()=>state==='running'?pause():resume();
$('volume').oninput=e=>player.setVolume(Number(e.target.value));
$('quality').onclick=()=>{lowQuality=!lowQuality;scene.setQuality(lowQuality);$('quality').textContent=`Graphics: ${lowQuality?'Low':'High'}`;$('quality').setAttribute('aria-pressed',lowQuality);};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}};
window.addEventListener('keydown',e=>{
 if(e.target instanceof HTMLInputElement)return;
 if(e.target instanceof HTMLButtonElement&&(e.code==='Space'||e.code==='Enter'))return;
 const controlled=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyP','Escape','KeyR','KeyT','KeyC','KeyO','KeyH'];if(!controlled.includes(e.code))return;
 if(state==='running'||state==='paused')e.preventDefault();if(e.repeat)return;keys.add(e.code);
 if(e.code==='KeyP'||e.code==='Escape'){if(state==='running')pause();else if(state==='paused')resume();return;}
 if(e.code==='KeyR'&&(state==='running'||state==='paused')){startRace();return;}
 if(state!=='running')return;
 if(e.code.startsWith('Shift'))startBoost(car);
 if(e.code==='KeyT')resetToRoad();if(e.code==='KeyC'||e.code==='KeyO'){scene.mode=(scene.mode+1)%4;}if(e.code==='KeyH')scene.lightsOpen=!scene.lightsOpen;
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function updateHUD(t){
 $('speed').textContent=String(Math.round(Math.abs(car.speed)*3.6)).padStart(3,'0');$('gear').textContent=car.speed<-.3?'R':car.speed<.3?'N':String(Math.min(6,Math.floor(car.speed/12)+1));
 $('nitro-fill').style.transform=`scaleX(${car.nitro})`;$('nitro-state').textContent=car.boost>0?`BOOST / ${car.boost.toFixed(1)} SEC`:car.nitro<.999?`CHARGING / ${Math.round(car.nitro*100)}%`:'READY';
 $('distance').textContent=`${(Math.max(0,car.s-24)/1000).toFixed(2)} / ${(track.length/1000).toFixed(2)} KM`;$('elapsed').textContent=`${formatTime(t)} / ${formatTime(profile.duration)}`;$('song-progress').style.transform=`scaleX(${clamp(t/profile.duration)})`;
 $('route-state').textContent=car.contact?'BARRIER CONTACT':car.boost>0?'NITRO ACTIVE':car.speed<0?'REVERSE':'DRIVE TO THE FINISH';drawMap();
}
function frame(now){
 const dt=Math.min((now-previous)/1000,.06);previous=now;const t=player.time();
 fpsTime+=dt;fpsFrames++;if(fpsTime>=1){fps=Math.round(fpsFrames/fpsTime);fpsFrames=0;fpsTime=0;}
 if(state==='running'){
  accumulator+=dt;const input={forward:keys.has('KeyW')||keys.has('ArrowUp'),reverse:keys.has('KeyS'),left:keys.has('KeyA')||keys.has('ArrowLeft'),right:keys.has('KeyD')||keys.has('ArrowRight'),brake:keys.has('Space')||keys.has('ArrowDown')};
  while(accumulator>=1/120){stepCar(car,input,1/120,track);accumulator-=1/120;}
  if(car.s>=track.length-3)finish(true);else if(t>=profile.duration)finish(false);
 }
 const idle=state==='menu'||state==='loading';scene.render(car,state==='paused'?0:dt,t,featureAt(profile,t),keys.has('Space')||keys.has('ArrowDown'),idle,state==='running'||state==='paused');
 uiClock+=dt;if(uiClock>.08){uiClock=0;if(!idle)updateHUD(t);}
 $('world').dataset.qa=JSON.stringify({state,speed:Math.round(car.speed*3.6),s:Math.round(car.s),audioTime:Math.round(t*100)/100,boost:Math.round(car.boost*100)/100,nitro:Math.round(car.nitro*100)/100,fps,drawCalls:scene.renderer.info.render.calls,vehicle:scene.vehicleInfo?.id,parts:scene.vehicleInfo?.parts,bpm:profile.bpm,duration:profile.duration,trackLength:track.length});
}
try{
 scene=new RaceScene($('world'));scene.setTrack(track);updateProfile();scene.renderer.setAnimationLoop(frame);
 scene.loadVehicle().then(()=>{state='menu';$('start').disabled=false;startLabel('Drive');if(innerWidth<700)setStatus('Keyboard required.');}).catch(fatal);
}catch(e){fatal(e);}
function fatal(e){show('load-error',true);$('error-message').textContent=`${e.message}. Use a browser with WebGL 2 and hardware acceleration.`;console.error(e);}
// Read-only diagnostics for manual QA; no control or file data is exposed.
Object.defineProperty(window,'racerDiagnostics',{get:()=>({state,vehicle:scene?.vehicleInfo,profile:{duration:profile.duration,bpm:profile.bpm,confidence:profile.confidence,beats:profile.beats.length},trackLength:track.length,car:{s:car.s,speed:car.speed,nitro:car.nitro,boost:car.boost,collisions:car.collisions},audioTime:player.time(),drawCalls:scene?.renderer.info.render.calls,triangles:scene?.renderer.info.render.triangles})});
