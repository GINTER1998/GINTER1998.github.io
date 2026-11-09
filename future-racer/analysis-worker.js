import {analyzePCM} from './music.js';
self.onmessage=({data})=>{try{self.postMessage({profile:analyzePCM(data.channels,data.sampleRate)});}catch(e){self.postMessage({error:e.message});}};
