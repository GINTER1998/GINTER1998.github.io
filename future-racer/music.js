export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
export function analyzePCM(channels,sampleRate){
 const length=channels[0].length,duration=length/sampleRate,hop=Math.max(1,Math.round(sampleRate*.02));
 const count=Math.ceil(length/hop),energy=new Float32Array(count),onset=new Float32Array(count),low=new Float32Array(count);
 let filter=0,previous=0;const alpha=1-Math.exp(-2*Math.PI*180/sampleRate);
 for(let f=0;f<count;f++){
  let sum=0,bass=0;const end=Math.min(length,(f+1)*hop),start=f*hop;
  for(let i=start;i<end;i++){let x=0;for(const channel of channels)x+=channel[i]/channels.length;sum+=x*x;filter+=alpha*(x-filter);bass+=filter*filter;}
  energy[f]=Math.sqrt(sum/Math.max(1,end-start));low[f]=Math.sqrt(bass/Math.max(1,end-start));
  onset[f]=Math.max(0,low[f]-previous);previous=low[f];
 }
 const sorted=Array.from(energy).sort((a,b)=>a-b),scale=sorted[Math.floor(count*.95)]||1;
 const maxOn=Math.max(.00001,...Array.from(onset).slice(0,20000));
 let best=0,bpm=0;const fps=sampleRate/hop;
 // Correlate low-frequency attacks. Silence and weak pulse retain low confidence.
 for(let tempo=65;tempo<=180;tempo++){
  const lag=Math.round(60/tempo*fps);let score=0,norm=0;
  for(let i=lag;i<count;i++){score+=onset[i]*onset[i-lag];norm+=onset[i]*onset[i];}
  score/=norm||1;
  if(score>best){best=score;bpm=tempo;}
 }
 const beats=[];let last=-1;
 for(let i=2;i<count-2;i++){
  let baseline=0;for(let k=Math.max(0,i-25);k<i;k++)baseline+=onset[k];baseline/=Math.min(25,i);
  const t=i/fps;if(onset[i]>Math.max(.0015,baseline*1.8,maxOn*.09)&&onset[i]>=onset[i-1]&&onset[i]>onset[i+1]&&t-last>.26){beats.push(t);last=t;}
 }
 let seed=2166136261;for(let i=0;i<count;i+=7){seed^=Math.round(energy[i]*100000);seed=Math.imul(seed,16777619);}
 const envelope=[];for(let t=0;t<duration;t+=.5){let e=0,c=0;for(let i=Math.floor(t*fps);i<Math.min(count,(t+.5)*fps);i++){e+=energy[i];c++;}envelope.push(clamp(e/Math.max(1,c)/scale));}
 const confidence=clamp(best);if(confidence<.12)bpm=0;
 if(bpm&&beats.length>=8){
  const intervals=beats.slice(1).map((t,i)=>t-beats[i]).sort((a,b)=>a-b),median=intervals[Math.floor(intervals.length/2)];
  const deviations=intervals.map(x=>Math.abs(x-median)).sort((a,b)=>a-b),spread=deviations[Math.floor(deviations.length/2)]/median;
  let candidate=60/median;while(candidate<65)candidate*=2;while(candidate>180)candidate/=2;
  const ratio=candidate/bpm;
  if(spread<.12&&[.5,1,2].some(r=>Math.abs(ratio-r)<.07))bpm=Math.round(candidate);
 }
 return{duration,bpm,confidence,beats,energy:envelope,seed:seed>>>0,peak:scale};
}
export function featureAt(profile,t){
 const f=clamp(t*2,0,profile.energy.length-1),i=Math.floor(f),u=f-i;
 return(profile.energy[i]||0)*(1-u)+(profile.energy[Math.min(i+1,profile.energy.length-1)]||0)*u;
}
export function demoProfile(duration=120){
 const bpm=120,energy=Array.from({length:Math.ceil(duration*2)},(_,i)=>.35+.28*Math.sin(i*.035)**2+.22*(i>80&&i<170));
 return{duration,bpm,confidence:1,beats:Array.from({length:Math.floor(duration*2)},(_,i)=>i*.5),energy,seed:9302025,peak:.5};
}
export function generateDemo(ctx){
 const duration=120,rate=ctx.sampleRate,buffer=ctx.createBuffer(2,duration*rate,rate),rng=random(930);
 const notes=[55,65.406,73.416,49],melody=[0,7,12,10,7,3,5,7];
 for(let ch=0;ch<2;ch++){
  const data=buffer.getChannelData(ch);
  for(let i=0;i<data.length;i++){
   const t=i/rate,beat=t%0.5,hat=t%0.25,phrase=Math.floor(t/8)%4,env=demoProfileEnergy(t);
   const kick=Math.sin(2*Math.PI*(45*beat+8*(1-Math.exp(-beat*35))))*Math.exp(-beat*18)*.42;
   const noise=(rng()*2-1),snare=(Math.floor(t*2)%2===1?noise*Math.exp(-beat*27)*.12:0);
   const bass=Math.sin(2*Math.PI*notes[phrase]*t)*(.1+.05*Math.sin(2*Math.PI*notes[phrase]*t))*Math.exp(-beat*3);
   const lead=Math.sin(2*Math.PI*notes[phrase]*2**(melody[Math.floor(t*4)%8]/12+2)*t)*Math.exp(-hat*15)*.042;
   const pad=Math.sin(2*Math.PI*notes[phrase]*2*t+ch*.12)*.025+Math.sin(2*Math.PI*notes[phrase]*3*t)*.018;
   data[i]=(kick+snare+bass+lead+pad+noise*Math.exp(-hat*70)*.035)*env*Math.min(1,t/2,(duration-t)/3);
  }
 }
 return buffer;
}
function demoProfileEnergy(t){return .55+.25*Math.sin(t*.07)**2+(t>40&&t<85?.2:0);}
export class MusicPlayer{
 constructor(){this.ctx=null;this.buffer=null;this.source=null;this.offset=0;this.started=0;this.playing=false;this.volume=.65;}
 async ready(){if(!this.ctx){this.ctx=new AudioContext();this.gain=this.ctx.createGain();this.gain.connect(this.ctx.destination);this.gain.gain.value=this.volume;}await this.ctx.resume();}
 async decode(file){await this.ready();return this.ctx.decodeAudioData(await file.arrayBuffer());}
 load(buffer){this.pause();this.buffer=buffer;this.offset=0;}
 play(){if(this.playing||!this.buffer)return;this.offset=Math.min(this.offset,this.buffer.duration-.001);this.source=this.ctx.createBufferSource();this.source.buffer=this.buffer;this.source.connect(this.gain);this.source.start(0,this.offset);this.started=this.ctx.currentTime;this.playing=true;}
 time(){return this.offset+(this.playing?this.ctx.currentTime-this.started:0);}
 pause(){if(!this.playing)return;this.offset=this.time();this.playing=false;this.source.stop();this.source.disconnect();this.source=null;}
 reset(){this.pause();this.offset=0;}
 setVolume(v){this.volume=v;if(this.gain)this.gain.gain.setTargetAtTime(v,this.ctx.currentTime,.03);}
}
