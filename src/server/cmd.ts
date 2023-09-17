import SocketIO from 'socket.io'
import { cmdStateType, clientType } from '../types/global'
import { cmdList, streamList, parameterList, states } from './states'
import { uploadStream } from './upload'
import { streamEmit } from './stream'
import e from 'express'

import { newWindowReqType } from '../types/global'
import { stat } from 'fs'
import { InputType } from 'zlib'

export function charProcess(character:string, strings: string, id: string, io: SocketIO.Server, state: cmdStateType) {
  //console.log(character)
  if(character === 'Enter') {
    receiveEnter(strings, id, io, state)
    strings = '';
  } else if(character === 'Tab' || character === 'ArrowRight' || character === 'ArrowDown') {
    io.emit('erasePrintFromServer', '')
    strings =  '';
  } else if(character === 'ArrowLeft' || character === 'Backspace') {
    strings = strings.slice(0,-1)
    io.emit('stringsFromServer',{strings: strings, timeout: false})
  } else if(character === 'Escape'){
    stopEmit(io, state, 'client');
    strings =  '';
  } else if(character === 'BASS') {
    console.log('io.to(' + id + ').emit("cmdFromSever",{"cmd":"BASS","property":"LOW"})')
    io.to(id).emit('cmdFromServer',{'cmd':'BASS','property':'LOW'})
  } else if(character === 'BASSS'){
    console.log('io.to(' + id + ').emit("cmdFromSever",{"cmd":"BASS","property":"HIGH"})')
    io.to(id).emit('cmdFromServer',{'cmd':'BASS','property':'HIGH'})
  } else if(character === 'ArrowUp'){
    io.emit('stringsFromServer',{strings: strings, timeout: false})
  } else if(character != undefined) {
    strings =  strings + character;
    io.emit('stringsFromServer',{strings: strings, timeout: false})
  }
  console.log(strings)
  return strings
}

const notTargetEmit = (targetId: string, idArr: string[], io: SocketIO.Server) => {
  idArr.forEach((id) => {
//    console.log(id)
    if(id !== targetId) io.to(id).emit('erasePrintFromServer')
  })
}


export const receiveEnter = (strings: string, id: string, io: SocketIO.Server, state: cmdStateType) => {
  //VOICE
  emitVoice(io, strings, state)

  if (strings === 'ENV') {
    if(state.inputMode === 'client') {
      state.inputMode = 'env'
      io.emit('stringsFromServer',{strings: 'ENV MODE', timeout: true})
    } else {
      io.emit('stringsFromServer',{strings: 'ALREADY ENV MODE', timeout: true})
    }
  } else if (strings === 'CLIENT') {
    if(state.inputMode === 'env') {
      state.inputMode = 'client'
      io.emit('stringsFromServer',{strings: 'CLIENT', timeout: true})
    } else {
      io.emit('stringsFromServer',{strings: 'ALREADY CLIENT MODE', timeout: true})
    }
  } else if(strings === 'CHAT') {
    console.log('chat start');
    if(!state.current.stream.CHAT) {
      console.log(state.client)
      state.current.stream.CHAT = true
      const targetId = state.client[Math.floor(Math.random() * state.client.length)]
      io.to(targetId).emit('chatReqFromServer')
      if(state.cmd.VOICE.length > 0) {
        state.cmd.VOICE.forEach((element) => {
          io.to(element).emit('voiceFromServer', 'CHAT')
        })
      }
    } else {
      state.current.stream.CHAT = false
    }
  } else if(strings === "RECORD" || strings === "REC") {
    if(!state.current.RECORD) {
      state.current.RECORD = true
      io.emit('recordReqFromServer', {target: 'PLAYBACK', timeout: 10000})
      if(state.cmd.VOICE.length > 0) {
        state.cmd.VOICE.forEach((element) => {
//          io.to(element).emit('voiceFromServer', 'RECORD')
          io.to(element).emit('voiceFromServer', {text: 'RECORD', lang: state.cmd.voiceLang})
        })
      }
    } else {
      state.current.RECORD = false
    }
  } else if(strings.includes(' ') && strings.split(' ').length < 5) {
    splitSpace(strings.split(' '), io, state)
  } else if(streamList.includes(strings)) {
    console.log('in stream')
    state.current.stream[strings] = true
    streamEmit(strings, io, state)
  } else if(Object.keys(cmdList).includes(strings)) {
    console.log('in cmd')
    cmdEmit(cmdList[strings], io, state)
  } else if (Number.isFinite(Number(strings))) {
    console.log('sinewave')
    sinewaveEmit(strings, io, state)
  } else if (strings === 'TWICE' || strings === 'HALF') {
    sinewaveChange(strings, io, state)
  } else if (strings === 'PREVIOUS' || strings === 'PREV') {
    previousCmd(io, state)
  } else if (strings === 'STOP') {
    stopEmit(io, state, 'client');
  } else if(Object.keys(parameterList).includes(strings)) {
    parameterChange(parameterList[strings], io, state, {source: id})
  } else if(strings === 'NO' || strings === 'NUMBER') {
    state.client.forEach((id, index) => {
      console.log(id)
      io.to(id).emit('stringsFromServer',{strings: String(index), timeout: true})
      //putString(io, String(index), state)
    })
  } else if(strings.includes('MIN') || strings.includes('SEC')) {
    console.log('in MIN SEC')
    setModulation(strings, io, state)
  }
}

export const cmdEmit = (cmdStrings: string, io: SocketIO.Server, state: cmdStateType, target?: string) => {
  let targetId = ''
  let cmd: {
    cmd: string,
    property?: string,
    value?: number,
    flag?: boolean,
    fade?: number,
    gain?: number
  }
  switch(cmdStrings){
    case 'STOP':
      stopEmit(io, state)
      break;
    case 'WHITENOISE':
    case 'FEEDBACK':
    case 'BASS':
      const cmdKey = cmdStrings as keyof typeof cmdList
      cmd =  {
        cmd: cmdList[cmdKey]
      }
      state.previous.cmd[cmd.cmd] = state.current.cmd[cmd.cmd]
      if(target) {
        targetId = target
        console.log(targetId)
        if(state.current.cmd[cmd.cmd].includes(targetId)) {
          cmd.flag = false
          cmd.fade = state.cmd.FADE.OUT
          for(let id in state.current.cmd[cmd.cmd]) {
            if(targetId === state.current.cmd[cmd.cmd][id]) {
              delete state.current.cmd[cmd.cmd][id]
            }
          }
          console.log(state.current.cmd[cmd.cmd])
        } else {
          cmd.flag = true
          cmd.fade = state.cmd.FADE.IN
          state.current.cmd[cmd.cmd].push(targetId)
        }
        cmd.gain = state.cmd.GAIN[cmd.cmd]
      } else {
        if(state.current.cmd[cmd.cmd].length === 0 ) {
          cmd.flag = true
          cmd.fade = state.cmd.FADE.IN
          cmd.gain = state.cmd.GAIN[cmd.cmd]
          targetId = state.client[Math.floor(Math.random() * state.client.length)]
          state.current.cmd[cmd.cmd].push(targetId)
        } else {
          cmd.flag = false
          cmd.fade = state.cmd.FADE.OUT
          cmd.gain = state.cmd.GAIN[cmd.cmd]
          targetId = state.current.cmd[cmd.cmd].shift()
        }
      }
      // io.to(targetId).emit('cmdFromServer', cmd)
      putCmd(io, targetId, cmd, state)
      notTargetEmit(targetId, state.client, io)        
      break
    case 'CLICK':
      console.log(state.cmd.GAIN.CLICK)
      cmd = {
        cmd: 'CLICK',
        gain: state.cmd.GAIN.CLICK
      }
      // cmd.gain = state.cmd.GAIN.CLICK
      if(target) {
        targetId = target
      } else {
        targetId = state.client[Math.floor(Math.random() * state.client.length)]
      }
      // io.to(targetId).emit('cmdFromServer', cmd)
      putCmd(io, targetId, cmd, state)
      notTargetEmit(targetId, state.client, io)
      break
    case 'SIMULATE':
      console.log(state.cmd.GAIN.SIMULATE)
      cmd = {
        cmd: 'SIMULATE',
        gain: state.cmd.GAIN.SIMULATE
      }
      if(target) {
        targetId = target
      } else {
        targetId = state.client[Math.floor(Math.random() * state.client.length)]
      }
      putCmd(io, targetId, cmd, state)
      notTargetEmit(targetId, state.client, io)
      break
    case 'METRONOME':
      cmd =  {
        cmd: 'METRONOME'
      }
      
      if(target) {
        if(state.current.cmd[cmd.cmd].includes(target)) {
          cmd.flag = false
          cmd.gain = state.cmd.GAIN.METRONOME
          for(let id in state.current.cmd.METRONOME) {
            if(target === state.current.cmd.METRONOME[id]) {
              cmd.value = state.cmd.METRONOME[target]
              delete state.current.cmd[cmd.cmd][id]
            }
          }
          console.log(state.current.cmd.METRONOME)
        } else {
          cmd.flag = true
          cmd.gain = state.cmd.GAIN.METRONOME
          state.current.cmd.METRONOME.push(target)
          cmd.value = state.cmd.METRONOME[target]
        }
      } else {
        if(state.current.cmd.METRONOME.length === 0 ) {
          cmd.flag = true
          cmd.gain = state.cmd.GAIN.METRONOME
          target = state.client[Math.floor(Math.random() * state.client.length)]
          state.current.cmd[cmd.cmd].push(target)
          cmd.value = state.cmd.METRONOME[target]
        } else {
          cmd.flag = false
          cmd.gain = state.cmd.GAIN.METRONOME
          target = state.current.cmd.METRONOME.shift()
          cmd.value = state.cmd.METRONOME[target]
        }
      }
      putCmd(io, target, cmd, state)
      notTargetEmit(target, state.client, io)
      console.log('metronome')
    break
      /*
    case 'RECORD':
      // console.log("debug")
      if(!state.current.RECORD) {
        console.log("debug cmd ts")
        state.current.RECORD = true
        io.emit('recordReqFromServer', {target: 'PLAYBACK', timeout: 10000})
      } else {
        state.current.RECORD = false
      }
      break
      */
  }
  cmdStrings = '';
}

export const stopEmit = (io: SocketIO.Server, state: cmdStateType, mode?: InputType) => {
  if(mode !== undefined) {
    if(mode === 'client') {
      stopClient(io, state)
    } else {
      console.log(state.env)
      if(state.env.length === 0) {
        putString(io, 'NO ENV', state)
      }
      state.env.forEach((id) => {
        io.to(id).emit('stopFromServer', state.cmd.FADE.ENV_OUT)
      })
      state.previous.env = state.current.env
      state.current.env = {}
    }
  } else if(state.inputMode === 'client') {
    stopClient(io, state)
  } else if(state.inputMode  === 'env') {
    state.env.forEach((id) => {
      io.to(id).emit('stopFromServer', state.cmd.FADE.ENV_OUT)
    })
    state.previous.env = state.current.env
    state.current.env = {}
  }
}

const stopClient = (io: SocketIO.Server, state: cmdStateType) => {
  state.client.forEach((id) => {
    io.to(id).emit('stopFromServer', state.cmd.FADE.OUT)
  })
    // io.emit('stopFromServer', state.cmd.FADE.OUT)
  // STOPは個別の関数があるのでVOICEはそこに相乗り
  if(state.cmd.VOICE.length > 0) {
    state.cmd.VOICE.forEach((element) => {
      //      io.to(element).emit('voiceFromServer', "STOP")
      io.to(element).emit('voiceFromServer', {text: 'STOP', lang: state.cmd.voiceLang})
    })
  }

  // current -> previous && current -> stop
  for(let cmd in state.current.cmd) {
    state.previous.cmd[cmd] = state.current.cmd[cmd]
    state.current.cmd[cmd] = []
  }
  for(let stream in state.current.stream) {
    state.previous.stream[stream] = state.current.stream[stream]
    state.current.stream[stream] = false
  }
  state.previous.sinewave = state.current.sinewave
  state.current.sinewave = {}
}

const stopAll = (io: SocketIO.Server, state: cmdStateType) => {
  console.log('stop all')
  io.emit('stopFromServer', state.cmd.FADE.OUT)
  // STOPは個別の関数があるのでVOICEはそこに相乗り
  if(state.cmd.VOICE.length > 0) {
    state.cmd.VOICE.forEach((element) => {
      //      io.to(element).emit('voiceFromServer', "STOP")
      io.to(element).emit('voiceFromServer', {text: 'STOP', lang: state.cmd.voiceLang})
    })
  }

  // current -> previous && current -> stop
  for(let cmd in state.current.cmd) {
    state.previous.cmd[cmd] = state.current.cmd[cmd]
    state.current.cmd[cmd] = []
  }
  for(let stream in state.current.stream) {
    state.previous.stream[stream] = state.current.stream[stream]
    state.current.stream[stream] = false
  }
  state.previous.sinewave = state.current.sinewave
  state.current.sinewave = {}
}

type sinewaveEmitType = {
  cmd: string,
  value: number,
  flag: boolean,
  fade: number,
  portament: number,
  gain: number
}

export const sinewaveEmit = (frequencyStr: string, io: SocketIO.Server, state: cmdStateType, target?: string) => {
  // サイン波の処理
  let cmd: sinewaveEmitType = {
    cmd: 'SINEWAVE',
    value: Number(frequencyStr),
    flag: true,
    fade: 0,
    portament: state.cmd.PORTAMENT,
    gain: state.cmd.GAIN.SINEWAVE
  }
  state.previous.sinewave = state.current.sinewave
  let targetId = 'initial'
  if(target) {
    targetId = target
    if(Object.keys(state.current.sinewave).includes(targetId)) {
      // 送信先が同じ周波数で音を出している場合
      if(state.current.sinewave[targetId] === cmd.value) {
        cmd.flag = false
        cmd.fade = state.cmd.FADE.OUT
        delete state.current.sinewave[targetId]  
      // 送信先が違う周波数で音を出している場合
      } else {
        cmd.flag = true
        cmd.fade = 0
        state.current.sinewave[targetId] = cmd.value
      }
    } else {
      // 送信先が音を出していない場合
      cmd.fade = state.cmd.FADE.IN
      state.current.sinewave[targetId] = cmd.value
    }
  } else {
    if(state.inputMode === 'client') {
      // どの端末も音を出していない場合
      if(Object.keys(state.current.sinewave).length === 0) {
        cmd.fade = state.cmd.FADE.IN
        targetId = state.client[Math.floor(Math.random() * state.client.length)]
        console.log("debug: " + targetId)
        state.current.sinewave[targetId] = cmd.value
        // state.previous.sinewave = {}
      } else {

        //同じ周波数の音を出している端末がある場合
        for(let id in state.current.sinewave) {
          if(cmd.value === state.current.sinewave[id]) {
            targetId = id
            cmd.flag = false
            cmd.fade = state.cmd.FADE.OUT
            delete state.current.sinewave[targetId]
          }
        }
        // 同じ周波数の音を出している端末がない場合
        if(targetId === 'initial') {
          for(let i = 0; i < state.client.length; i++) {
            if(Object.keys(state.current.sinewave).includes(state.client[i])) {
              continue
            } else {
              targetId = state.client[i]
            }
          }
          if(targetId === 'initial') {
            targetId = Object.keys(state.current.sinewave)[Math.floor(Math.random() * Object.keys(state.current.sinewave).length)]
          }
          state.current.sinewave[targetId] = cmd.value
        }
      }
    } else if(state.inputMode === 'env') {
      envSinewaveEmit(frequencyStr, io, state)
    }
  }
  console.log(state.current.sinewave)
  console.log(targetId)
  // io.to(targetId).emit('cmdFromServer', cmd)
  putCmd(io, targetId, cmd, state)
  //io.emit('cmdFromServer', cmd)
  notTargetEmit(targetId, state.client, io)
}

const envSinewaveEmit = (frequencyStr: string, io: SocketIO.Server, state: cmdStateType) => {
  let cmd: sinewaveEmitType = {
    cmd: 'SINEWAVE',
    value: Number(frequencyStr),
    flag: true,
    fade: state.cmd.FADE.ENV_IN,
    portament: state.cmd.PORTAMENT,
    gain: state.cmd.GAIN.SINEWAVE
  }
  let targetId = 'initial'
  // どの端末も音を出していない場合
      if(Object.keys(state.current.env).length === 0) {
        cmd.fade = state.cmd.FADE.ENV_IN
        targetId = state.env[Math.floor(Math.random() * state.env.length)]
        console.log("debug: " + targetId)
        state.current.env[targetId] = cmd.value
        // state.previous.sinewave = {}
      } else {
        //同じ周波数の音を出している端末がある場合
        for(let id in state.current.env) {
          if(cmd.value === state.current.env[id]) {
            targetId = id
            cmd.flag = false
            cmd.fade = state.cmd.FADE.ENV_OUT
            delete state.current.env[targetId]
          }
        }
        // 同じ周波数の音を出している端末がない場合
        if(targetId === 'initial') {
          for(let i = 0; i < state.client.length; i++) {
            if(Object.keys(state.current.env).includes(state.env[i])) {
              continue
            } else {
              targetId = state.env[i]
            }
          }
          if(targetId === 'initial') {
            targetId = Object.keys(state.current.env)[Math.floor(Math.random() * Object.keys(state.current.env).length)]
          }
          state.current.env[targetId] = cmd.value
        }        
      }
      cmd.portament = state.cmd.ENV_PORTAMENT
      putCmd(io, targetId, cmd, state)
      //io.emit('cmdFromServer', cmd)
      notTargetEmit(targetId, state.client, io)
}

const envAllSinewaveEmit = (frequencyStr: string, io: SocketIO.Server, state: cmdStateType) => {  
  let cmd: sinewaveEmitType = {
    cmd: 'SINEWAVE',
    value: Number(frequencyStr),
    flag: true,
    fade: state.cmd.FADE.ENV_IN,
    portament: state.cmd.PORTAMENT,
    gain: state.cmd.GAIN.SINEWAVE
  }
  state.env.forEach((id, index) => {
    putCmd(io, id, cmd, state)
    // putString(io, 'ENV SINWAVE: ' + String(cmd.value) + 'Hz', state)
    state.current.env[id] = cmd.value
  })
}

const sinewaveChange = (cmdStrings: string, io: SocketIO.Server, state: cmdStateType, value?: number) => {
  if(state.inputMode === 'client') {
    if(cmdStrings === 'TWICE') {
      for(let id in state.current.sinewave) {
        state.previous.sinewave[id] = state.current.sinewave[id]
        state.current.sinewave[id] = state.current.sinewave[id] * 2
        const cmd: {
          cmd: string,
          value: number,
          flag: boolean,
          fade: number,
          portament: number,
          gain: number
        } = {
          cmd: 'SINEWAVE',
          value: state.current.sinewave[id],
          flag: true,
          fade: 0,
          portament: state.cmd.PORTAMENT,
          gain: state.cmd.GAIN.SINEWAVE
        }
        putCmd(io, id, cmd, state)
        // io.to(id).emit('cmdFromServer', cmd)
      }

    } else if (cmdStrings === 'HALF') {
      for(let id in state.current.sinewave) {
        state.previous.sinewave[id] = state.current.sinewave[id]
        state.current.sinewave[id] = state.current.sinewave[id] / 2
        const cmd: {
          cmd: string,
          value: number,
          flag: boolean,
          fade: number,
          portament: number,
          gain: number
        } = {
          cmd: 'SINEWAVE',
          value: state.current.sinewave[id],
          flag: true,
          fade: 0,
          portament: state.cmd.PORTAMENT,
          gain: state.cmd.GAIN.SINEWAVE
        }
        //io.to(id).emit('cmdFromServer', cmd)
        putCmd(io, id, cmd, state)
      }

    }
  } else if(state.inputMode === 'env') {
      if(cmdStrings === 'TWICE') {
        for(let id in state.current.env) {
          state.previous.env[id] = state.current.env[id]
          state.current.env[id] = state.current.env[id] * 2
          const cmd: {
            cmd: string,
            value: number,
            flag: boolean,
            fade: number,
            portament: number,
            gain: number
          } = {
            cmd: 'SINEWAVE',
            value: state.current.env[id],
            flag: true,
            fade: 0,
            portament: state.cmd.ENV_PORTAMENT,
            gain: state.cmd.GAIN.SINEWAVE
          }
          putCmd(io, id, cmd, state)
          // io.to(id).emit('cmdFromServer', cmd)
        }
  
      } else if (cmdStrings === 'HALF') {
        for(let id in state.current.env) {
          state.previous.sinewave[id] = state.current.env[id]
          state.current.sinewave[id] = state.current.env[id] / 2
          const cmd: {
            cmd: string,
            value: number,
            flag: boolean,
            fade: number,
            portament: number,
            gain: number
          } = {
            cmd: 'SINEWAVE',
            value: state.current.env[id],
            flag: true,
            fade: 0,
            portament: state.cmd.ENV_PORTAMENT,
            gain: state.cmd.GAIN.SINEWAVE
          }
          //io.to(id).emit('cmdFromServer', cmd)
          putCmd(io, id, cmd, state)
        }
  
      }
  }
}

export const parameterChange = (param: string, io: SocketIO.Server, state: cmdStateType, arg?: {source?: string, value?: number, property?:string, mode?:clientType}) => {
  switch(param) {
    case 'PORTAMENT':
      if(arg.mode === undefined) {
        if(state.inputMode === 'client') {
          if(arg && arg.value && isFinite(Number(arg.value))) {
            state.cmd.PORTAMENT = arg.value
          } else {
            if(state.cmd.PORTAMENT > 0) {
              state.cmd.PORTAMENT = 0
            } else {
              state.cmd.PORTAMENT = 5
            }
          }
          // io.emit('stringsFromServer',{strings: 'PORTAMENT: ' + String(state.cmd.PORTAMENT) + 'sec', timeout: true})
          putString(io, 'PORTAMENT: ' + String(state.cmd.PORTAMENT) + 'sec', state)
        } else if(state.inputMode === 'env') {
          if(arg && arg.value && isFinite(Number(arg.value))) {
            state.cmd.ENV_PORTAMENT = arg.value

          } else {
            if(state.cmd.ENV_PORTAMENT > 0) {
              state.cmd.ENV_PORTAMENT = 0
            } else {
              state.cmd.ENV_PORTAMENT = 5
            }
          }
          // io.emit('stringsFromServer',{strings: 'PORTAMENT: ' + String(state.cmd.PORTAMENT) + 'sec', timeout: true})
          putString(io, 'ENV PORTAMENT: ' + String(state.cmd.PORTAMENT) + 'sec', state)  
  
        }

      } else if(arg.mode === 'client') {
        if(arg && arg.value && isFinite(Number(arg.value))) {
          state.cmd.PORTAMENT = arg.value
        } else {
          if(state.cmd.PORTAMENT > 0) {
            state.cmd.PORTAMENT = 0
          } else {
            state.cmd.PORTAMENT = 5
          }
        }
        // io.emit('stringsFromServer',{strings: 'PORTAMENT: ' + String(state.cmd.PORTAMENT) + 'sec', timeout: true})
        putString(io, 'PORTAMENT: ' + String(state.cmd.PORTAMENT) + 'sec', state)  
      } else if(arg.mode === 'env') {
        if(arg && arg.value && isFinite(Number(arg.value))) {
          state.cmd.ENV_PORTAMENT = arg.value
        } else {
          if(state.cmd.ENV_PORTAMENT > 0) {
            state.cmd.ENV_PORTAMENT = 0
          } else {
            state.cmd.ENV_PORTAMENT = 5
          }
        }
        // io.emit('stringsFromServer',{strings: 'PORTAMENT: ' + String(state.cmd.PORTAMENT) + 'sec', timeout: true})
        putString(io, 'ENV PORTAMENT: ' + String(state.cmd.ENV_PORTAMENT) + 'sec', state)  
      }
      break
    case 'SAMPLERATE':
      let sampleRate = 44100
      if(arg && isFinite(Number(arg.value))) { 
        sampleRate = arg.value
      } else {
        const sampleArr = Object.values(state.stream.sampleRate)
        const sum = sampleArr.reduce((accumulator, currentValue) => {
          return accumulator + currentValue
        })
        const average = sum / sampleArr.length
        if(average < 11025 || average >= 88200) {
          sampleRate = 11025
        } else if(average < 22050) {
          sampleRate = 22050
        } else if(average < 44100) {
          sampleRate = 44100
        } else {
          sampleRate = 88200
        }
      }
      if(arg && arg.property) {
        console.log('hit source')
        state.stream.sampleRate[arg.property] = sampleRate
        // io.emit('stringsFromServer',{strings: 'SampleRate: ' + String(state.stream.sampleRate[arg.source]) + 'Hz', timeout: true})
        putString(io, 'SampleRate: ' + String(state.stream.sampleRate[arg.property]) + 'Hz', state)
      } else {
        console.log(arg)
        for(let source in state.stream.sampleRate) {
          state.stream.sampleRate[source] = sampleRate
        }
        // io.emit('stringsFromServer',{strings: 'SampleRate: ' + String(state.stream.sampleRate.CHAT) + 'Hz', timeout: true})
        putString(io, 'SampleRate: ' + String(state.stream.sampleRate.CHAT) + 'Hz', state)
      }
      break
    case 'GLITCH':
      if(arg && arg.property) {
        state.stream.glitch[arg.source] = !state.stream.glitch[arg.source]
        // io.emit('stringsFromServer',{strings: 'GLITCH: ' + String(state.stream.glitch[arg.source]), timeout: true})
        putString(io, 'GLITCH: ' + String(state.stream.glitch[arg.source]), state)
      } else {
        let flag = false
        if(Object.values(states.stream.glitch).includes(false)) {
          flag = true
        }
        for(let source in state.stream.glitch) {
          state.stream.glitch[source] = flag
        }  
        // io.emit('stringsFromServer',{strings: 'GLITCH: ' + String(state.stream.glitch.CHAT), timeout: true})
        putString(io, 'GLITCH: ' + String(state.stream.glitch.CHAT), state)
      }
      break
    case 'GRID':
      if(arg && arg.property) {
        state.stream.grid[arg.property] = !state.stream.grid[arg.property]
        // io.emit('stringsFromServer',{strings: 'GRID: ' + String(state.stream.grid[arg.property]) + '(' + arg.property + ')', timeout: true})
        putString(io, 'GRID: ' + String(state.stream.grid[arg.property]) + '(' + arg.property + ')', state)
      } else {
        let flag = false
        if(Object.values(states.stream.grid).includes(false)) {
          flag = true
        }
        for(let source in state.stream.grid) {
          state.stream.grid[source] = flag
        }
        // io.emit('stringsFromServer',{strings: 'GRID: ' + String(state.stream.grid.CHAT), timeout: true})
        putString(io, 'GRID: ' + String(state.stream.grid.CHAT), state)
      }
      break
    case 'BPM':
      if(arg && arg.value) {
        const latency = 60 * 1000 / arg.value
        if(arg.property) {
          // propertyがSTREAMを指定している場合
          if(Object.keys(state.stream.latency).includes(arg.property)) {
            state.stream.latency[arg.property] = latency
            putString(io, 'BPM: ' + String(arg.value)  + '(' + arg.property + ')', state)
          // propertyが端末番号を指定している場合
          } else if(/^([1-9]\d*|0)(\.\d+)?$/.test(arg.property)){
            const target = state.client[Number(arg.property)]
            if(Object.keys(state.cmd.METRONOME).includes(target)){
              state.cmd.METRONOME[target] = latency
              putString(io, 'BPM: ' + String(arg.value)  + '(client ' + arg.property + ')', state)
            }
            if(state.current.cmd.METRONOME.includes(target)) {
              const cmd: {
                cmd: string,
                property?: string,
                value?: number,
                flag?: boolean,
                fade?: number,
                gain?: number
              } = {
                cmd: 'METRONOME',
                flag: true,
                gain: state.cmd.GAIN.METRONOME,
                value: latency
              }
              putCmd(io, target, cmd, state)
          }
  

          }
          // io.emit('stringsFromServer',{strings: 'BPM: ' + String(arg.value)  + '(' + arg.property + ')', timeout: true})
        } else {
          for(let target in state.stream.latency) {
            state.stream.latency[target] = latency
          }
          for(let target in state.cmd.METRONOME) {
            state.cmd.METRONOME[target] = latency
          }
          if(state.current.cmd.METRONOME.length > 0) {
            state.current.cmd.METRONOME.forEach((target) => {
              const cmd: {
                cmd: string,
                property?: string,
                value?: number,
                flag?: boolean,
                fade?: number,
                gain?: number
              } = {
                cmd: 'METRONOME',
                flag: true,
                gain: state.cmd.GAIN.METRONOME,
                value: latency
              }
              putCmd(io, target, cmd, state)
    
            })
          }
          putString(io, 'BPM: ' + String(arg.value), state)
          // io.emit('stringsFromServer',{strings: 'BPM: ' + String(arg.value), timeout: true})
        }
      }
      break
    case 'RANDOM':
      if(arg && arg.source) {
        state.stream.random[arg.source] = !state.stream.random[arg.source]
        // io.emit('stringsFromServer',{strings: 'RANDOM: ' + String(state.stream.random[arg.source]), timeout: true})
        putString(io, 'RANDOM: ' + String(state.stream.random[arg.source]), state)
      } else {
        let flag = false
        if(Object.values(states.stream.random).includes(false)) {
          flag = true
        }
        for(let target in state.stream.random) {
          state.stream.random[target] = flag
        }
        //io.emit('stringsFromServer',{strings: 'RANDOM: ' + String(state.stream.random.CHAT), timeout: true})
        putString(io, 'RANDOM: ' + String(state.stream.random.CHAT), state)
      }
      break
    case 'VOICE':
      if(arg && arg.source) {
        let flag = false
        if(state.cmd.VOICE.includes(arg.source)) {
          const arr = []
          for(let i = 0; i < state.cmd.VOICE.length; i++) {
            if(state.cmd.VOICE[i] === arg.source) {
              continue
            } else {
              arr.push(state.cmd.VOICE[i])
            }
          }
          state.cmd.VOICE = arr
          // state.cmd.VOICE.filter((id) => {
          // })
          console.log(state.cmd.VOICE)
        } else {
          state.cmd.VOICE.push(arg.source)
          flag = true
        }
        // io.emit('stringsFromServer',{strings: 'VOICE: ' + String(flag), timeout: true})
        putString(io, 'VOICE: ' + String(flag), state)
      }
      break
  }  
}

const splitSpace = (stringArr: Array<string>, io: SocketIO.Server, state: cmdStateType) => {
  const arrTypeArr = stringArr.map((string) => {
    if(/^([1-9]\d*|0)(\.\d+)?$/.test(string)) {
      return 'number'
    } else if(/^[A-Za-z]*$/.test(string)) {
      return 'string'
    } else {
      return 'other'
    }
  })
  // console.log(arrTypeArr)
  // console.log(stringArr)

  if(arrTypeArr[0] === 'number' && stringArr.length === 2) {
    // 送信先を指定したコマンド/SINEWAVE
    const target = state.client[Number(stringArr[0])]
    console.log(target)
    if(arrTypeArr[1] === 'string') {
      cmdEmit(stringArr[1], io, state, target)
    } else if(arrTypeArr[1] === 'number') {
      sinewaveEmit(stringArr[1], io, state, target)
    }
  } else if(Object.keys(parameterList).includes(stringArr[0])) {
    // RANDOMのみRATEとSTREAMがあるので個別処理
    if(stringArr[0] === 'RANDOM') {
      if(stringArr[1] === 'RATE') {
        // SAMPLERATEのランダマイズ
        console.log('random rate')
        if(stringArr.length === 2) {
          for(let key in state.stream.randomrate) {
            state.stream.randomrate[key] = !state.stream.randomrate[key]
          }
          // io.emit('stringsFromServer',{strings: 'SAMPLERATE RANDOM: ' + String(state.stream.randomrate.CHAT), timeout: true})
          putString(io, 'SAMPLERATE RANDOM: ' + String(state.stream.randomrate.CHAT), state)
        } else if(stringArr.length === 3 && Object.keys(state.stream.randomrate).includes(stringArr[2])) {
          state.stream.randomrate[stringArr[2]] = !state.stream.randomrate[stringArr[2]]
          //io.emit('stringsFromServer',{strings: 'SAMPLERATE RANDOM(' + stringArr[2] + '): ' + String(state.stream.randomrate[stringArr[2]]), timeout: true})
          putString(io, 'SAMPLERATE RANDOM(' + stringArr[2] + '): ' + String(state.stream.randomrate[stringArr[2]]), state)
        }
        console.log(state.stream.randomrate)
      }
    } else if (stringArr[0] === 'VOICE') {
      //  } else if (stringArr[0] === 'VOICE' && stringArr.length === 2 && arrTypeArr[1] === 'string') {
      console.log('debt')
      if(stringArr[1] === "JA" || stringArr[1] === "JP") {
        state.cmd.voiceLang = 'ja-JP'
        putString(io, 'VOICE: ja-JP', state)
      } else if(stringArr[1] === "EN" || stringArr[1] === "US") {
        state.cmd.voiceLang = 'en-US'
        putString(io, 'VOICE: en-US', state)
      }
    } else {
      let argVal: number
      let argProp: string
      console.log(stringArr)
      console.log(arrTypeArr)
      if(stringArr.length === 2 && arrTypeArr[1] === 'number') {
        argVal = Number(stringArr[1])
      } else if (stringArr.length === 2 && arrTypeArr[1] === 'string'){
        argProp = stringArr[1]
      } else if (stringArr.length === 3) {
        if(arrTypeArr[1] === 'string' && arrTypeArr[2] === 'number') {
          argProp = stringArr[1]
          argVal = Number(stringArr[2])  
        } else if(stringArr[0] === 'BPM' && arrTypeArr[1] === 'number' && arrTypeArr[2] === 'number') {
          argProp = stringArr[1]
          argVal = Number(stringArr[2])  
        }
      }
      parameterChange(parameterList[stringArr[0]], io, state, {value: argVal, property: argProp})
      putString(io, stringArr[0] + ' ' + stringArr[1], state)
    }
  } else if(stringArr[0] === 'STOP') {
    if(stringArr.length === 2 && Object.keys(state.current.stream).includes(stringArr[1])) {
      state.current.stream[stringArr[1]] = false
      putString(io, stringArr[0] + ' ' + stringArr[1], state)
    } else if(stringArr[1] === 'ALL') {
      stopAll(io, state)
    } else if(stringArr[1] === 'CMD') {
      state.client.forEach((id) => {
        io.to(id).emit('stopFromServer', state.cmd.FADE.OUT)
      })
        // io.emit('stopFromServer', state.cmd.FADE.OUT)
      // STOPは個別の関数があるのでVOICEはそこに相乗り
      if(state.cmd.VOICE.length > 0) {
        state.cmd.VOICE.forEach((element) => {
          //      io.to(element).emit('voiceFromServer', "STOP")
          io.to(element).emit('voiceFromServer', {text: 'STOP', lang: state.cmd.voiceLang})
        })
      }
    
      // current -> previous && current -> stop
      for(let cmd in state.current.cmd) {
        state.previous.cmd[cmd] = state.current.cmd[cmd]
        state.current.cmd[cmd] = []
      }
      state.previous.sinewave = state.current.sinewave
      state.current.sinewave = {}    
    } else if(stringArr[1] === 'STREAM') {
      for(let stream in state.current.stream) {
        state.previous.stream[stream] = state.current.stream[stream]
        state.current.stream[stream] = false
      }
    } else if(stringArr[1] === 'ENV') {
      state.env.forEach((id) => {
        io.to(id).emit('stopFromServer', state.cmd.FADE.ENV_OUT)
      })
      state.previous.env = state.current.env
      state.current.env = {}
    }
  } else if(stringArr[0] === 'FADE') {
    if((stringArr[1] === 'IN' || stringArr[1] === 'OUT') && stringArr.length === 2) {
      if(state.cmd.FADE[stringArr[1]] === 0) {
        state.cmd.FADE[stringArr[1]] = 5
      } else {
        state.cmd.FADE[stringArr[1]] = 0
      }
      // io.emit('stringsFromServer',{strings: 'FADE ' + stringArr[1] +  ': ' + String(state.cmd.FADE[stringArr[1]]), timeout: true})
      putString(io, 'FADE ' + stringArr[1] +  ': ' + String(state.cmd.FADE[stringArr[1]]), state)
    } else if(stringArr.length === 3 && (stringArr[1] === 'IN' || stringArr[1] === 'OUT') && arrTypeArr[2] === 'number') {
      if(state.cmd.FADE[stringArr[1]] !== Number(stringArr[2])) {
        state.cmd.FADE[stringArr[1]] = Number(stringArr[2])
      } else {
        state.cmd.FADE[stringArr[1]] = 0
      }
      putString(io, 'FADE ' + stringArr[1] +  ': ' + String(state.cmd.FADE[stringArr[1]]), state)
      
    }
  } else if(stringArr[0] === 'UPLOAD' && stringArr.length == 2) {
    uploadStream(stringArr, io)
  } else if (stringArr[0] === 'GAIN' && stringArr.length === 3 && Object.keys(state.cmd.GAIN).includes(stringArr[1]) && arrTypeArr[2] === 'number') {
    state.cmd.GAIN[stringArr[1]] = Number(stringArr[2])
    console.log(state.cmd.GAIN)
    putString(io, stringArr[1] +  ' GAIN: ' + stringArr[2], state)
  } else if (stringArr[0] === 'ENV') {
    console.log('test')
    if(stringArr[1] === 'PORTAMENT' || stringArr[1] === 'PORT') {
      if(stringArr.length === 2) {
        console.log('debug ' + stringArr[1])
        parameterChange("PORTAMENT", io, state, {mode: 'env'})
        // putString(io, stringArr[0] + ' ' + stringArr[1], state)  
      } else {
        console.log(arrTypeArr[2])
        if(arrTypeArr[2] === 'number') {
          parameterChange("PORTAMENT", io, state, {value: Number(stringArr[2]), mode: 'env'})
          // putString(io, stringArr[0] + ' ' + stringArr[1] + ' ' + stringArr[2] + ' sec', state) 
        }
      }
    } else if(stringArr[1] === 'FADE') {
      console.log('env fade')
      if((stringArr[2] === 'IN' || stringArr[2] === 'OUT') && stringArr.length === 3) {
        if(state.cmd.FADE['ENV_' + stringArr[2]] === 0) {
          state.cmd.FADE['ENV_' + stringArr[2]] = 5
        } else {
          state.cmd.FADE['ENV_' + stringArr[2]] = 0
        }
        // io.emit('stringsFromServer',{strings: 'FADE ' + stringArr[1] +  ': ' + String(state.cmd.FADE[stringArr[1]]), timeout: true})
        putString(io, 'ENV FADE ' + stringArr[2] +  ': ' + String(state.cmd.FADE['ENV_' + stringArr[2]]), state)
      } else if(stringArr.length === 4 && (stringArr[2] === 'IN' || stringArr[2] === 'OUT') && arrTypeArr[3] === 'number') {
        console.log('debug')
        if(state.cmd.FADE['ENV_' + stringArr[2]] !== Number(stringArr[3])) {
          console.log(stringArr[3] + 'sec')
          state.cmd.FADE['ENV_' + stringArr[2]] = Number(stringArr[3])
        } else {
          console.log(stringArr[3] + '-> 0')
          state.cmd.FADE['ENV_' + stringArr[2]] = 0
        }
        putString(io, 'ENV FADE ' + stringArr[2] +  ': ' + String(state.cmd.FADE['ENV_' + stringArr[2]]), state)
      }      
    } else if(stringArr[1] === 'STOP') {
      console.log('env stop')
      stopEmit(io, state, 'env');
    } else if(arrTypeArr[1] === 'number') {
      if(stringArr.length === 2) {
        console.log('debug ' + stringArr[1])

        envSinewaveEmit(stringArr[1], io, state)
      // } else if(stringArr.length === 3 && arrTypeArr[2] === 'number') {
        // sinewaveEmit(stringArr[2], io, state, stringArr[1])
      }
    } else if(stringArr[1] === 'ALL' && arrTypeArr[2] === 'number') {
      envAllSinewaveEmit(stringArr[2], io, state)
    }
  } else if(stringArr[0].includes(':')) {
    setTimer(stringArr, io, state)
  }

}

const previousCmd = (io: SocketIO.Server, state: cmdStateType) => {
  for(let cmd in state.previous.cmd){
    state.previous.cmd[cmd].forEach(target => {
      cmdEmit(cmd, io, state, target)  
    });
  }
  for(let stream in state.previous.stream){
    if(state.previous.stream[stream]){
      streamEmit(stream, io, state)
    }
  }
  for(let target in state.previous.sinewave){
    sinewaveEmit(String(state.previous.sinewave[target]), io, state, target)
  }
}

const putCmd = (io: SocketIO.Server, id: string, cmd: {
  cmd: string,
  value?: number,
  flag?: boolean,
  fade?: number,
  portament?: number,
  gain?: number
},
state: cmdStateType) => {
  io.to(id).emit('cmdFromServer', cmd)
  /*
  if(state.cmd.VOICE.length > 0) {
    state.cmd.VOICE.forEach((element) => {
      io.to(element).emit('voiceFromServer', cmd.cmd)
    })
  }
  */
}

const putString = (io: SocketIO.Server, strings: string, state: cmdStateType) => {
  io.emit('stringsFromServer',{strings: strings, timeout: true})
  /*
  if(state.cmd.VOICE.length > 0) {
    state.cmd.VOICE.forEach((element) => {
      io.to(element).emit('voiceFromServer', strings)
    })
  }
  */
}

const emitVoice = (io: SocketIO.Server, strings: string, state: cmdStateType) => {
  if(state.cmd.VOICE.length > 0) {
    state.cmd.VOICE.forEach((element) => {
      io.to(element).emit('voiceFromServer', {text: strings, lang: state.cmd.voiceLang})
    })
  }
}

//HH:MMまたはHH:MM:SSの文字列とコマンドを入力されたときに、現在時刻と比較してsetTimeoutでコマンドを実行する関数
const setTimer = (stringArr: Array<string>, io: SocketIO.Server, state: cmdStateType) => {
  const timeArr = stringArr[0].split(':')
  // cmdはstringArrの2番目以降の要素を結合した文字列
  const cmd = stringArr.slice(1).join(' ')
  const now = new Date()
  const nowTime = now.getTime()
  let hour: number
  let min: number
  let sec: number
  let time: number
  let timeDiff: number
  if(timeArr.length === 2) {
    hour = Number(timeArr[0])
    min = Number(timeArr[1])
    sec = 0
  } else if(timeArr.length === 3) {
    hour = Number(timeArr[0])
    min = Number(timeArr[1])
    sec = Number(timeArr[2])
  }
  time = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, sec).getTime()
  timeDiff = time - nowTime
  putString(io, stringArr[0] + ", " + cmd, state)
  setTimeout(() => {
    receiveEnter(cmd, "", io, state)
  }, timeDiff)
}
  
  

type TimeUnit = 'SEC' | 'MIN';
type ParsedTime = {
    value: number;
    unit: TimeUnit;
};

function parseTimeString(timeStr: string): ParsedTime | null {
  // const regex = /^(\d+)(SEC|MIN)$/;
  const regex = /^(\d+(?:\.\d+)?)(SEC|MIN)$/;
  const match = timeStr.match(regex);

  if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2] as TimeUnit;
      return { value, unit };
  }

  return null;
}


const setModulation = (intervalStr: string, io, state) => {
  const intervalObj = parseTimeString(intervalStr)
  // intervalObj.unitが'SEC'の場合は、1 / intervalObj.valueを計算し、intervalObj.unitが'MIN'の場合は、1 / (intervalObj.value * 60)を計算する  
  console.log(intervalObj)
  const frequencyDiff: number = intervalObj.unit === 'MIN' ? 1 / (intervalObj.value * 60) : 1 / intervalObj.value

  if(Object.keys(state.current.env).length > 0) {
    // state.current.env の中からランダムな要素を取り出す
    const Reference = Object.keys(state.current.env)[Math.floor(Math.random() * Object.keys(state.current.env).length)]
    console.log(Reference)
    console.log(state.current.env)
    console.log(state.current.env[Reference])
    console.log(frequencyDiff)

    state.env.forEach((target, index) => {
      let machineNo = 0
      if(target !== Reference) {
        const cmd: {
          cmd: string,
          value: number,
          flag: boolean,
          fade: number,
          portament: number,
          gain: number
        } = {
          cmd: 'SINEWAVE',
          value: state.current.env[Reference] + (frequencyDiff * (machineNo + 1)),
          flag: true,
          fade: state.cmd.FADE.ENV_IN,
          portament: state.cmd.ENV_PORTAMENT,
          gain: state.cmd.GAIN.SINEWAVE
        }
        console.log(target)
        console.log(cmd.value)
        putCmd(io, target, cmd, state)
        putString(io, String(intervalObj.value) + ' ' + intervalObj.unit, state)
        machineNo++
      }
    })
    /*
    for(let target in state.current.env) {
      if(target === Reference) {
        console.log('test')
        continue
      } else {
        console.log('test2')
        const cmd: {
          cmd: string,
          value: number,
          flag: boolean,
          fade: number,
          portament: number,
          gain: number
        } = {
          cmd: 'SINEWAVE',
          value: state.current.env[target] + frequencyDiff,
          flag: true,
          fade: 0,
          portament: state.cmd.ENV_PORTAMENT,
          gain: state.cmd.GAIN.SINEWAVE
        }
        putCmd(io, target, cmd, state)
        putString(io, String(frequencyDiff) + ' SEC', state)
      }
    }
    */
  } else {
    putString(io, 'NO ENV', state)
  }

}