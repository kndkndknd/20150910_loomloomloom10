import SocketIO from 'socket.io'
import { cmdStateType } from '../types/global'

export const stopEmit = (io: SocketIO.Server, state: cmdStateType, target?: 'all' | 'STREAM' | 'CMD', client?: 'client' | 'sinewaveClient' | 'all') => {
  /*
  io.emit('stopFromServer', {
    target: target,
    fadeOut: state.cmd.FADE.OUT
  })
  */
  // STOPは個別の関数があるのでVOICEはそこに相乗り
  if(state.cmd.VOICE.length > 0) {
    state.cmd.VOICE.forEach((element) => {
//      io.to(element).emit('voiceFromServer', "STOP")
      io.to(element).emit('voiceFromServer', {text: 'STOP', lang: state.cmd.voiceLang})
    })
  }

  // current -> previous && current -> stop
  if(client === undefined ||client === 'client' || client === 'all') {
    state.client.forEach((element) => {
      io.to(element).emit('stopFromServer', {
        target: target === undefined ? 'all' : target,
        fadeOutVal: state.cmd.FADE.OUT
      })
    })
    for(let cmd in state.current.cmd) {
      state.previous.cmd[cmd] = state.current.cmd[cmd]
      state.current.cmd[cmd] = []
    }
    state.previous.sinewave = state.current.sinewave
    state.current.sinewave = {}
  }
  if(client === undefined || client === 'sinewaveClient' || client === 'all') {
    console.log('sinewaveClient stop')
    state.sinewaveClient.forEach((element) => {
      io.to(element).emit('stopFromServer', {
        target: target === undefined ? 'all' : target,
        fadeOutVal: state.cmd.FADE.OUT
      })
    })
    for(let stream in state.current.stream) {
      state.previous.stream[stream] = state.current.stream[stream]
      state.current.stream[stream] = false
    }
    state.sinewaveClientStatus.previous = state.sinewaveClientStatus.current
    state.sinewaveClientStatus.current = {}
  }
}
