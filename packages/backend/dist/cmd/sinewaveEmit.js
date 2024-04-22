"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sinewaveEmit = void 0;
const putCmd_1 = require("./putCmd");
// import { notTargetEmit } from "./notTargetEmit";
const pickupCmdTarget_1 = require("./pickupCmdTarget");
const sinewaveEmit = (frequencyStr, io, state, target) => {
    // サイン波の処理
    let cmd = {
        cmd: "SINEWAVE",
        value: Number(frequencyStr),
        flag: true,
        fade: state.cmd.FADE.IN,
        portament: state.cmd.PORTAMENT,
        gain: state.cmd.GAIN.SINEWAVE,
    };
    if (target !== undefined) {
        state.previous.sinewave[target] = state.current.sinewave[target];
    }
    else {
        state.previous.sinewave = state.current.sinewave;
    }
    let targetIdArr = target !== undefined
        ? (0, pickupCmdTarget_1.pickupCmdTarget)(state, "SINEWAVE", { value: frequencyStr, target })
        : (0, pickupCmdTarget_1.pickupCmdTarget)(state, "SINEWAVE", { value: frequencyStr });
    console.log("targetArr", targetIdArr);
    targetIdArr.forEach((id) => {
        console.log("id", id);
        if (!Object.keys(state.current.sinewave).includes(id)) {
            cmd.flag = true;
            cmd.fade = state.cmd.FADE.IN;
            state.current.sinewave[id] = cmd.value;
        }
        else if (state.current.sinewave[id] !== cmd.value) {
            cmd.flag = true;
            cmd.fade = 0;
            state.current.sinewave[id] = cmd.value;
        }
        else {
            cmd.flag = false;
            cmd.fade = state.cmd.FADE.OUT;
            delete state.current.sinewave[id];
        }
    });
    console.log(targetIdArr);
    /*
    if (target) {
      targetId = target;
      if (Object.keys(state.current.sinewave).includes(targetId)) {
        // 送信先が同じ周波数で音を出している場合
        if (state.current.sinewave[targetId] === cmd.value) {
          cmd.flag = false;
          cmd.fade = state.cmd.FADE.OUT;
          delete state.current.sinewave[targetId];
          // 送信先が違う周波数で音を出している場合
        } else {
          cmd.flag = true;
          cmd.fade = 0;
          state.current.sinewave[targetId] = cmd.value;
        }
      } else {
        // 送信先が音を出していない場合
        cmd.fade = state.cmd.FADE.IN;
        state.current.sinewave[targetId] = cmd.value;
      }
    } else {
      // どの端末も音を出していない場合
      if (Object.keys(state.current.sinewave).length === 0) {
        cmd.fade = state.cmd.FADE.IN;
        targetId = state.client[Math.floor(Math.random() * state.client.length)];
        console.log("debug: " + targetId);
        state.current.sinewave[targetId] = cmd.value;
        // state.previous.sinewave = {}
      } else {
        //同じ周波数の音を出している端末がある場合
        for (let id in state.current.sinewave) {
          if (cmd.value === state.current.sinewave[id]) {
            targetId = id;
            cmd.flag = false;
            cmd.fade = state.cmd.FADE.OUT;
            delete state.current.sinewave[targetId];
          }
        }
        // 同じ周波数の音を出している端末がない場合
        if (targetId === "initial") {
          for (let i = 0; i < state.client.length; i++) {
            if (Object.keys(state.current.sinewave).includes(state.client[i])) {
              continue;
            } else {
              targetId = state.client[i];
            }
          }
          if (targetId === "initial") {
            targetId = Object.keys(state.current.sinewave)[
              Math.floor(
                Math.random() * Object.keys(state.current.sinewave).length
              )
            ];
          }
          state.current.sinewave[targetId] = cmd.value;
        }
      }
    }
    */
    console.log("current sinewave", state.current.sinewave);
    // console.log(targetIdArr);
    (0, putCmd_1.putCmd)(io, targetIdArr, cmd, state);
    // putCmd(io, targetId, cmd, state);
    // if (target === undefined) {
    //   notTargetEmit(targetId, state.client, io);
    // }
};
exports.sinewaveEmit = sinewaveEmit;
//# sourceMappingURL=sinewaveEmit.js.map