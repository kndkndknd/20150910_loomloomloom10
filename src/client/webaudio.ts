import { io, Socket } from "socket.io-client";
import { erasePrint, textPrint, toBase64 } from './imageEvent'
import {cnvs, ctx,} from './globalVariable'


export let streamFlag = {
  chat: false,
  record: false,
  timelapse: false,
  simulate: false
}

let simsGain = 1


// const cnvs = <HTMLCanvasElement> document.getElementById('cnvs');
// const ctx  = <CanvasRenderingContext2D>cnvs.getContext('2d');


const socket: Socket = io();

let audioContext: AudioContext
let masterGain: GainNode
let javascriptnode: ScriptProcessorNode
let osc: OscillatorNode
let oscGain: GainNode
let feedbackGain: GainNode
let whitenoiseOsc: OscillatorNode
let whitenoiseNode: ScriptProcessorNode
let noiseGain: GainNode
let buf0: Float32Array
let buf1: Float32Array
let bassOsc: OscillatorNode
let bassGain: GainNode
let clickOsc: OscillatorNode
let clickGain: GainNode

let chatGain: GainNode

let convolver: ConvolverNode
let glitchGain: GainNode

let simulateOsc: OscillatorNode
let simulateGain: GainNode
let simFilter: BiquadFilterNode
let analyser: AnalyserNode



export const initAudio = () =>{
  audioContext = new AudioContext();
  masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(1,0)
  masterGain.connect(audioContext.destination);
  console.log(masterGain.gain.maxValue)

  //record/play
  // javascriptnode = audioContext.createScriptProcessor(8192, 1, 1);
  // sinewave
  osc = audioContext.createOscillator();
  oscGain = audioContext.createGain();
  osc.connect(oscGain);
  osc.frequency.setValueAtTime(440, 0);
  oscGain.gain.setValueAtTime(0,0);
  oscGain.connect(masterGain)
  osc.start(0);
 
  // feedback
  feedbackGain = audioContext.createGain();
  feedbackGain.gain.setValueAtTime(0,0);
  //whitenoise 
  whitenoiseOsc = audioContext.createOscillator();
  whitenoiseNode = audioContext.createScriptProcessor(1024)
  noiseGain = audioContext.createGain()
  noiseGain.gain.setValueAtTime(0,0)
  whitenoiseNode.onaudioprocess = (ev) => {
    buf0 = ev.outputBuffer.getChannelData(0)
    buf1 = ev.outputBuffer.getChannelData(1)
    for(let i=0;i<1024;++i) {
      buf0[i] = buf1[i] = (Math.random()-0.5)
    }
  }
  whitenoiseOsc.connect(whitenoiseNode)
  whitenoiseNode.connect(noiseGain)
  noiseGain.connect(masterGain)
  whitenoiseOsc.start(0)

  //bass
  bassOsc = audioContext.createOscillator()
  bassGain = audioContext.createGain()
  bassOsc.connect(bassGain)
  bassOsc.frequency.setValueAtTime(88, 0)
  bassGain.gain.setValueAtTime(0,0)
  bassGain.connect(masterGain)
  bassOsc.start(0)

  //click
  clickOsc = audioContext.createOscillator()
  clickGain = audioContext.createGain()
  clickOsc.connect(clickGain)
  clickOsc.frequency.setValueAtTime(440, 0)
  clickGain.gain.setValueAtTime(0,0)
  clickGain.connect(masterGain)
  clickOsc.start(0)

  // chat / feedback
  javascriptnode = audioContext.createScriptProcessor(8192, 1, 1)
  convolver = audioContext.createConvolver();
  glitchGain = audioContext.createGain();
  glitchGain.gain.setValueAtTime(0.1,0);
  convolver.connect(glitchGain);
  glitchGain.connect(audioContext.destination)
 

  feedbackGain = audioContext.createGain()
  feedbackGain.gain.setValueAtTime(0,0)

  chatGain = audioContext.createGain()
  chatGain.gain.setValueAtTime(1,0)
  chatGain.connect(masterGain)

  // SIMULATE
  simulateOsc = audioContext.createOscillator();
  simulateGain = audioContext.createGain();
  simulateOsc.connect(simulateGain);
  simulateOsc.frequency.setValueAtTime(440, 0);
  simulateGain.gain.setValueAtTime(0,0);
  simulateGain.connect(masterGain)
  simulateOsc.start(0);
  simFilter = audioContext.createBiquadFilter();
  simFilter.type = "lowpass";
  simFilter.frequency.setValueAtTime(1000,0);
}

export const initAudioStream = (stream) => {
  let mediastreamsource: MediaStreamAudioSourceNode
  mediastreamsource = audioContext.createMediaStreamSource(stream)
  mediastreamsource.connect(javascriptnode)
  mediastreamsource.connect(feedbackGain)
  feedbackGain.connect(masterGain)
  javascriptnode.onaudioprocess = onAudioProcess
  javascriptnode.connect(masterGain)
  //rec

  //SIMULATE
  analyser = audioContext.createAnalyser();
  mediastreamsource.connect(simFilter);
  simFilter.connect(analyser);
};

const onAudioProcess = (e: AudioProcessingEvent) => {
  const bufferSize = 8192
  if(streamFlag.chat) {
    let bufferData = {target: 'CHAT', video:toBase64(), audio: new Float32Array(bufferSize), bufferSize: bufferSize, duration: e.inputBuffer.duration}
    e.inputBuffer.copyFromChannel(bufferData.audio, 0);
    // console.log(bufferData.audio)
    socket.emit('chatFromClient', bufferData)
    streamFlag.chat = false
  }
  if(streamFlag.record) {
    let bufferData = {target: 'PLAYBACK', video:toBase64(), audio: new Float32Array(bufferSize), bufferSize: bufferSize, duration: e.inputBuffer.duration}
    e.inputBuffer.copyFromChannel(bufferData.audio, 0);
    console.log(bufferData)
    socket.emit('chatFromClient', bufferData)
  }
  if(streamFlag.timelapse) {
    let bufferData = {target: 'TIMELAPSE', video:toBase64(), audio: new Float32Array(bufferSize), bufferSize: bufferSize, duration: e.inputBuffer.duration}
    e.inputBuffer.copyFromChannel(bufferData.audio, 0);
    // console.log(bufferData.audio)
    socket.emit('chatFromClient', bufferData)
    streamFlag.timelapse = false
  }
  if(streamFlag.simulate){
    let freqData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqData);
    console.log(freqData.length)
    let freq = {freq:0,val:0}
    for (let i = 0, len = freqData.length; i < len; i++) {
      //if(freq.val < freqData[i]) freq = {freq:(i*20000/2048), val:freqData[i]/256}
      if(freq.val < freqData[i]) freq = {freq:(i*22050/analyser.fftSize), val:freqData[i]/256}
    }
    //let currentTime = audioContext.currentTime
    if(freq.val > simsGain) freq.val = simsGain
//    freq.val = simsGain
//    freq.val //later
//    if(freq.val > clientState.gain.manekkoGain) freq.val = clientState.gain.manekkoGain
    console.log(freq)
    let currentTime = audioContext.currentTime;
    simulateGain.gain.setTargetAtTime(freq.val,currentTime,0.1)
    simulateOsc.frequency.setTargetAtTime(freq.freq,currentTime,0.1)
    erasePrint(ctx, cnvs);
    textPrint(String(freq.freq) + "Hz", ctx, cnvs);
  }

}

export const playAudioStream = (bufferArray: Float32Array, sampleRate: number, glitch: boolean, bufferSize: number) => {
  console.log(sampleRate)
  console.log(bufferSize)
  console.log(bufferArray)
  let audio_src = audioContext.createBufferSource();
  const flo32arr = new Float32Array(bufferArray)
  let audioData = new Float32Array(bufferSize);
  for(let i = 0; i < bufferSize; i++){
    if(flo32arr[i]) {
      audioData[i] = flo32arr[i];
      // audioData[i] = 1.0
    } else {
      audioData[i] = 0.0
    }
  }
  console.log(bufferSize) 
  console.log(sampleRate) 
  // console.log(audioData)
  if(!glitch){
    let audio_buf = audioContext.createBuffer(1, bufferSize, sampleRate)
    audio_buf.copyToChannel(audioData, 0);
    audio_src.buffer = audio_buf;
    audio_src.connect(chatGain);
  } else {
    console.log('glitched')
    let audio_buf = audioContext.createBuffer(1, bufferSize, convolver.context.sampleRate)
    audio_buf.copyToChannel(audioData, 0);

    audio_src.buffer = audio_buf;
    convolver.buffer = audio_buf;
    audio_src.connect(convolver);
  }
  audio_src.start(0);
}

export const sinewave = (flag: boolean, frequency: number, fade: number, portament: number, gain: number) => {
  const currentTime = audioContext.currentTime
  console.log('debug')
  osc.frequency.setTargetAtTime(frequency, currentTime, portament);
  if(flag){
    oscGain.gain.setTargetAtTime(gain,currentTime,fade);
  } else {
    oscGain.gain.setTargetAtTime(0,currentTime,fade);
  }
}

export const whitenoise = (flag: boolean, fade: number, gain: number) => {
  const currentTime = audioContext.currentTime
  if(flag) {
    noiseGain.gain.setTargetAtTime(gain,currentTime,fade);
  } else {
    noiseGain.gain.setTargetAtTime(0,currentTime,fade);
  }
}

export const feedback = (flag: boolean, fade: number, gain: number) => {
  const currentTime = audioContext.currentTime
  if(flag) {
    feedbackGain.gain.setTargetAtTime(gain,currentTime,fade);
  } else {
    feedbackGain.gain.setTargetAtTime(0,currentTime,fade);
  }
}

export const bass = (flag: boolean, gain: number) => {
  if(flag) {
    bassGain.gain.setValueAtTime(gain,0)
  } else {
    bassGain.gain.setValueAtTime(0,0)
  }
}

export const click = (gain: number, frequency?: number) => {
  const currentTime = audioContext.currentTime
  if(frequency){
    clickOsc.frequency.setValueAtTime(frequency,0)
  } else {
    clickOsc.frequency.setValueAtTime(440,0)
  }
  clickGain.gain.setValueAtTime(gain, 0);
  clickGain.gain.setTargetAtTime(0,currentTime,0.03);
}

export const chatReq = () => {
  streamFlag.chat= true
}

export const recordReq = (recordReq: {
  target: string,
  timeout: number}
) => {
  switch(recordReq.target) {
    case 'PLAYBACK':
      streamFlag.record = true
      setTimeout(() => {
        streamFlag.record = false
      }, recordReq.timeout)
      break;
  }
}

//video record/play ここまで

export const stopCmd = (fade: number) => {
  const currentTime = audioContext.currentTime
  bassGain.gain.setValueAtTime(0,0)
  feedbackGain.gain.setTargetAtTime(0,currentTime,fade) 
  noiseGain.gain.setTargetAtTime(0,currentTime,fade)
  oscGain.gain.setTargetAtTime(0,currentTime,fade)
}


export const simulate = (gain: number) => {
  streamFlag.simulate = !streamFlag.simulate
  if(streamFlag.simulate) {
    simsGain = gain
  } else {
    simsGain = 0
    simulateGain.gain.setValueAtTime(0,0);
  }

}