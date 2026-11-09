import {MusicPlayer,demoProfile,generateDemo,featureAt,clamp} from './music.js';
import {buildTrack,initialCar,stepCar,startBoost,sampleTrack} from './track.js';
import {RaceScene} from './scene.js';
const $=id=>document.getElementById(id),player=new MusicPlayer();
let profile=demoProfile(),track=buildTrack(profile),car=initialCar(track),scene,state='loading',title='CONCRETE AFTER HOURS',isDemo=true,loading=false,worker=null,loadId=0,keys=new Set(),accumulator=0,previous=performance.now(),uiClock=0,toastTimer,lowQuality=false,fpsTime=0,fpsFrames=0,fps=0;
const formatTime=t=>`${String(Math.floor(Math.max(0,t)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
const show=(id,visible)=>$(id).hidden=!visible;
function toast(message){$('toast').textContent=message;show('toast',true);clearTimeout(toastTimer);toastTimer=setTimeout(()=>show('toast',false),2600);}
function setStatus(message){$('status').textContent=message;}
function startLabel(text){$('start').firstElementChild.textContent=text;}
function updateProfile(){
 $('track-name').textContent=title;$('playing-name').textContent=title;
 $('track-description').textContent=isDemo?'内置原创电子音乐 / 120 BPM / 2:00':`本地音频 / ${profile.bpm?`估计 ${profile.bpm} BPM`:'节拍不明显 · 平顺赛道'} / ${formatTime(profile.duration)}`;
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
 active.onmessage=({data})=>{active.terminate();if(worker===active)worker=null;data.error?reject(Error(data.error)):resolve(data.profile);};active.onerror=e=>{active.terminate();reject(Error(e.message||'音乐分析失败'));};active.postMessage({channels,sampleRate:buffer.sampleRate},channels.map(c=>c.buffer));
});}
async function loadAudio(file){
 if(!file||loading)return;if(file.size>80*1024*1024){toast('请选择小于 80 MB 的音频文件。');return;}
 const id=++loadId;loading=true;$('start').disabled=true;startLabel('读取音乐…');setStatus('正在解码音频，随后分析节奏和能量变化…');
 try{
  const buffer=await player.decode(file);if(buffer.duration<5||buffer.duration>600)throw Error('请选择 5 秒至 10 分钟的音乐。');
  startLabel('分析节奏…');const next=await analyze(buffer);if(id!==loadId)return;
  profile=next;title=file.name.replace(/\.[^.]+$/,'');isDemo=false;player.load(buffer);track=buildTrack(profile);car=initialCar(track);scene.setTrack(track);updateProfile();show('demo',true);
  setStatus(profile.bpm?`已生成 ${(track.length/1000).toFixed(2)} 公里赛道。BPM 为自动估计，实际拍点与能量参与道路设计。`:'节拍不明显，已按音乐能量生成较平顺赛道。');
 }catch(e){setStatus(`未能载入：${e.message} 当前音乐仍可使用。`);}
 finally{loading=false;$('start').disabled=state==='loading';startLabel('开始驾驶');$('audio-file').value='';}
}
async function startRace(){
 if(loading||state==='loading')return;loading=true;$('start').disabled=true;startLabel('准备音乐…');
 try{
  await player.ready();if(!player.buffer){await new Promise(requestAnimationFrame);player.load(generateDemo(player.ctx));}
  player.reset();car=initialCar(track);scene.setTrack(track);scene.mode=0;scene.lightsOpen=false;keys.clear();accumulator=0;
  document.body.classList.add('racing');for(const id of ['intro','music-panel','footer','pause-overlay','finish-overlay'])show(id,false);show('hud',true);show('menu-button',true);
  $('state-label').innerHTML='<i></i> LIVE / MUSIC STAGE';state='running';player.play();$('play-pause').textContent='Ⅱ';toast('W 加速 · A/D 转向 · Shift 氮气 · P 暂停');document.activeElement?.blur();
 }catch(e){setStatus(`音频启动失败：${e.message}`);}
 finally{loading=false;$('start').disabled=false;startLabel('开始驾驶');}
}
function pause(){if(state!=='running')return;player.pause();state='paused';keys.clear();show('pause-overlay',true);$('play-pause').textContent='▶';$('state-label').innerHTML='<i></i> PAUSED';}
async function resume(){if(state!=='paused')return;try{await player.ready();player.play();state='running';accumulator=0;show('pause-overlay',false);$('play-pause').textContent='Ⅱ';$('state-label').innerHTML='<i></i> LIVE / MUSIC STAGE';document.activeElement?.blur();}catch(e){toast(e.message);}}
function toMenu(){player.reset();state='menu';keys.clear();document.body.classList.remove('racing');for(const id of ['hud','menu-button','pause-overlay','finish-overlay'])show(id,false);for(const id of ['intro','music-panel','footer'])show(id,true);car=initialCar(track);scene.setTrack(track);$('state-label').innerHTML='<i></i> MUSIC DRIVEN CITY';}
function finish(reached){
 if(state!=='running')return;player.pause();state='finished';keys.clear();show('finish-overlay',true);
 $('finish-kicker').textContent=reached?'ACROSS THE LINE.':'THE LAST NOTE.';$('finish-note').textContent=reached?'你在最后一个音符前抵达终点。':'音乐已结束。换一种速度，再走一次这首歌。';
 $('result-distance').textContent=(car.distance/1000).toFixed(2);$('result-speed').textContent=Math.round(car.maxSpeed*3.6);$('result-progress').textContent=Math.round(clamp(car.s/track.length)*100);$('state-label').innerHTML='<i></i> STAGE COMPLETE';
}
function resetToRoad(){const p=sampleTrack(track,car.s);car.x=p.x;car.z=p.z;car.heading=p.heading;car.speed=0;car.steer=0;toast('已回到路面');}
$('audio-file').addEventListener('change',e=>loadAudio(e.target.files[0]));
for(const event of ['dragenter','dragover'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.add('dragging');});
for(const event of ['dragleave','drop'])$('drop-zone').addEventListener(event,e=>{e.preventDefault();$('drop-zone').classList.remove('dragging');if(event==='drop')loadAudio(e.dataTransfer.files[0]);});
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
$('demo').onclick=()=>{if(loading)return;player.reset();player.buffer=null;profile=demoProfile();track=buildTrack(profile);car=initialCar(track);title='CONCRETE AFTER HOURS';isDemo=true;scene.setTrack(track);updateProfile();show('demo',false);setStatus('时长决定赛程，节奏与能量塑造弯道。音乐仅在你的设备上处理。');};
$('start').onclick=startRace;$('resume').onclick=resume;$('restart').onclick=startRace;$('again').onclick=startRace;$('change-music').onclick=toMenu;$('finish-back').onclick=toMenu;$('menu-button').onclick=pause;$('play-pause').onclick=()=>state==='running'?pause():resume();
$('volume').oninput=e=>player.setVolume(Number(e.target.value));
$('quality').onclick=()=>{lowQuality=!lowQuality;scene.setQuality(lowQuality);$('quality').textContent=`画质 · ${lowQuality?'省电':'高'}`;$('quality').setAttribute('aria-pressed',lowQuality);};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器不支持全屏，可使用浏览器全屏模式。');}};
window.addEventListener('keydown',e=>{
 if(e.target instanceof HTMLInputElement)return;
 if(e.target instanceof HTMLButtonElement&&(e.code==='Space'||e.code==='Enter'))return;
 const controlled=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyP','Escape','KeyR','KeyT','KeyC','KeyO','KeyH'];if(!controlled.includes(e.code))return;
 if(state==='running'||state==='paused')e.preventDefault();if(e.repeat)return;keys.add(e.code);
 if(e.code==='KeyP'||e.code==='Escape'){if(state==='running')pause();else if(state==='paused')resume();return;}
 if(e.code==='KeyR'&&(state==='running'||state==='paused')){startRace();return;}
 if(state!=='running')return;
 if(e.code.startsWith('Shift')){startBoost(car);if(car.boost===0)toast(car.nitro<.999?'氮气充能中':'先踩下油门，再启动氮气');}
 if(e.code==='KeyT')resetToRoad();if(e.code==='KeyC'||e.code==='KeyO'){scene.mode=(scene.mode+1)%4;toast(['跟车镜头','高位跟车','车头镜头','前方回望'][scene.mode]);}if(e.code==='KeyH')scene.lightsOpen=!scene.lightsOpen;
});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
function updateHUD(t){
 $('speed').textContent=String(Math.round(Math.abs(car.speed)*3.6)).padStart(3,'0');$('gear').textContent=car.speed<-.3?'R':car.speed<.3?'N':String(Math.min(6,Math.floor(car.speed/12)+1));
 $('nitro-fill').style.transform=`scaleX(${car.nitro})`;$('nitro-state').textContent=car.boost>0?`BOOST / ${car.boost.toFixed(1)} SEC`:car.nitro<.999?`CHARGING / ${Math.round(car.nitro*100)}%`:'READY / 5 SEC';
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
 const idle=state==='menu'||state==='loading';scene.render(car,state==='paused'?0:dt,t,featureAt(profile,t),keys.has('Space')||keys.has('ArrowDown'),idle);
 uiClock+=dt;if(uiClock>.08){uiClock=0;if(!idle)updateHUD(t);}
 $('world').dataset.qa=JSON.stringify({state,speed:Math.round(car.speed*3.6),s:Math.round(car.s),audioTime:Math.round(t*100)/100,boost:Math.round(car.boost*100)/100,nitro:Math.round(car.nitro*100)/100,fps,drawCalls:scene.renderer.info.render.calls,vehicle:scene.vehicleInfo?.id,parts:scene.vehicleInfo?.parts,bpm:profile.bpm,duration:profile.duration,trackLength:track.length});
}
try{
 scene=new RaceScene($('world'));scene.setTrack(track);updateProfile();scene.renderer.setAnimationLoop(frame);
 scene.loadVehicle().then(()=>{state='menu';$('start').disabled=false;startLabel('开始驾驶');if(innerWidth<700)setStatus('请使用带键盘的电脑驾驶。音乐仅在本地处理。');}).catch(fatal);
}catch(e){fatal(e);}
function fatal(e){show('load-error',true);$('error-message').textContent=`${e.message}。请使用支持 WebGL 2 的最新版 Chrome、Edge 或 Safari，并开启硬件加速。`;console.error(e);}
// Read-only diagnostics for manual QA; no control or file data is exposed.
Object.defineProperty(window,'racerDiagnostics',{get:()=>({state,vehicle:scene?.vehicleInfo,profile:{duration:profile.duration,bpm:profile.bpm,confidence:profile.confidence,beats:profile.beats.length},trackLength:track.length,car:{s:car.s,speed:car.speed,nitro:car.nitro,boost:car.boost,collisions:car.collisions},audioTime:player.time(),drawCalls:scene?.renderer.info.render.calls,triangles:scene?.renderer.info.render.triangles})});
