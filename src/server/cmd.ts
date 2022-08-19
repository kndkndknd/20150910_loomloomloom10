import SocketIO from 'socket.io'
import { cmdStateType } from '../types/global'
import { cmdList, streamList, parameterList, states } from './states'
import { uploadStream } from './upload'
import { streamEmit } from './stream'

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
    stopEmit(io, state);
    strings =  '';
  } else if(character === 'BASS' || character === 'BASS'){
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

  if(strings === 'CHAT') {
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
          io.to(element).emit('voiceFromServer', 'RECORD')
        })
      }
    } else {
      state.current.RECORD = false
    }
  } else if(strings.includes(' ') && strings.split(' ').length < 4) {
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
    stopEmit(io, state);
  } else if(Object.keys(parameterList).includes(strings)) {
    parameterChange(parameterList[strings], io, state, {source: id})
  } else if(strings === 'NO' || strings === 'NUMBER') {
    state.client.forEach((id, index) => {
      console.log(id)
      // io.to(id).emit('stringsFromServer',{strings: String(index), timeout: true})
      putString(io, String(index), state)
    })
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

export const stopEmit = (io: SocketIO.Server, state: cmdStateType) => {
  io.emit('stopFromServer', state.cmd.FADE.OUT)
  // STOPは個別の関数があるのでVOICEはそこに相乗り
  if(state.cmd.VOICE.length > 0) {
    state.cmd.VOICE.forEach((element) => {
      io.to(element).emit('voiceFromServer', "STOP")
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


export const sinewaveEmit = (frequencyStr: string, io: SocketIO.Server, state: cmdStateType, target?: string) => {
  // サイン波の処理
  let cmd: {
    cmd: string,
    value: number,
    flag: boolean,
    fade: number,
    portament: number,
    gain: number
  } = {
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
      cmd.flag = false,
      cmd.fade = state.cmd.FADE.OUT
      delete state.current.sinewave[targetId]
    } else {
      cmd.fade = state.cmd.FADE.IN
      state.current.sinewave[targetId] = cmd.value
    }
  } else {
    if(Object.keys(state.current.sinewave).length === 0) {
      cmd.fade = state.cmd.FADE.IN
      targetId = state.client[Math.floor(Math.random() * state.client.length)]
      console.log("debug: " + targetId)
      state.current.sinewave[targetId] = cmd.value
      // state.previous.sinewave = {}
    } else {
      for(let id in state.current.sinewave) {
        if(cmd.value === state.current.sinewave[id]) {
          targetId = id
          cmd.flag = false
          cmd.fade = state.cmd.FADE.OUT
          delete state.current.sinewave[targetId]
        }
      }
      if(targetId === 'initial') {
        targetId = Object.keys(state.current.sinewave)[0]
        state.current.sinewave[targetId] = cmd.value
      }
    }
  }
  console.log(state.current.sinewave)
  console.log(targetId)
  // io.to(targetId).emit('cmdFromServer', cmd)
  putCmd(io, targetId, cmd, state)
  //io.emit('cmdFromServer', cmd)
  notTargetEmit(targetId, state.client, io)
}

const sinewaveChange = (cmdStrings: string, io: SocketIO.Server, state: cmdStateType, value?: number) => {
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
}

export const parameterChange = (param: string, io: SocketIO.Server, state: cmdStateType, arg?: {source?: string, value?: number, property?:string}) => {
  switch(param) {
    case 'PORTAMENT':
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
      if(arg && arg.source) {
        state.stream.sampleRate[arg.source] = sampleRate
        // io.emit('stringsFromServer',{strings: 'SampleRate: ' + String(state.stream.sampleRate[arg.source]) + 'Hz', timeout: true})
        putString(io, 'SampleRate: ' + String(state.stream.sampleRate[arg.source]) + 'Hz', state)
      } else {
        for(let source in state.stream.sampleRate) {
          state.stream.sampleRate[source] = sampleRate
        }
        // io.emit('stringsFromServer',{strings: 'SampleRate: ' + String(state.stream.sampleRate.CHAT) + 'Hz', timeout: true})
        putString(io, 'SampleRate: ' + String(state.stream.sampleRate.CHAT) + 'Hz', state)
      }
      break
    case 'GLITCH':
      if(arg && arg.source) {
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
          state.stream.latency[arg.property] = latency
          // io.emit('stringsFromServer',{strings: 'BPM: ' + String(arg.value)  + '(' + arg.property + ')', timeout: true})
          putString(io, 'BPM: ' + String(arg.value)  + '(' + arg.property + ')', state)
        } else {
          for(let target in state.stream.latency) {
            state.stream.latency[target] = latency
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
          state.cmd.VOICE.filter((id) => {
            return id !== arg.source
          })
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
      }
    } else {
      let argVal: number
      let argProp: string
      if(stringArr.length === 2 && arrTypeArr[1] === 'number') {
        argVal = Number(stringArr[1])
      } else if (stringArr.length === 2 && arrTypeArr[1] === 'string'){
        argProp = stringArr[1]
      } else if (stringArr.length === 3 && arrTypeArr[1] === 'string' && arrTypeArr[2] === 'number') {
        argProp = stringArr[1]
        argVal = Number(stringArr[2])
      }
      parameterChange(parameterList[stringArr[0]], io, state, {value: argVal, property: argProp})
    }
  } else if(stringArr[0] === 'FADE') {
    if(stringArr[1] === 'IN' || stringArr[1] === 'OUT') {
      if(state.cmd.FADE[stringArr[1]] === 0) {
        state.cmd.FADE[stringArr[1]] = 5
      } else {
        state.cmd.FADE[stringArr[1]] = 0
      }
      // io.emit('stringsFromServer',{strings: 'FADE ' + stringArr[1] +  ': ' + String(state.cmd.FADE[stringArr[1]]), timeout: true})
      putString(io, 'FADE ' + stringArr[1] +  ': ' + String(state.cmd.FADE[stringArr[1]]), state)
    }
  } else if(stringArr[0] === 'UPLOAD' && stringArr.length == 2) {
    uploadStream(stringArr, io)
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
      io.to(element).emit('voiceFromServer', strings)
    })
  }
}