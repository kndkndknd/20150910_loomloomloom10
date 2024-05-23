import * as fs from "fs";
// import { execa } from "execa";
import { spawn } from "child_process";

import { streams, states } from "../../states";

import { promiseGetPcmData } from "./getPcmData";
import { promiseGetImageData } from "./getImageData";
import { pushStateStream } from "../pushStateStream";
import { get } from "http";

// import SocketIO from "socket.io";
// import { cmdStateType } from "../..//types/global.js";

// const fs = require("fs");
// const pcm = require("pcm");
// const util = require("util");
// const exec = require("child_process").exec;
// var readDir = util.promisify(fs.readdir);
// var readFile = util.promisify(fs.readFile);
// var execPromise = util.promisify(exec);

export const uploadVideo = async (f: string, durationArr, mediaDirPath) => {
  let tmpBuff = new Float32Array(states.stream.basisBufferSize);
  let rtnBuff = [];
  let i = 0;
  const fSplit = f.split(".");
  const fName = fSplit[0];

  try {
    await pushStateStream(fName, states);

    await durationArr.forEach(async (duration) => {
      const getPcmOption = {
        stereo: true,
        sampleRate: 22050,
        ss: duration.ss,
        t: duration.t,
      };
      const getPcmResult = <Float32Array[]>await promiseGetPcmData(
        `${mediaDirPath}/${f}`,
        8192,
        // fName,
        getPcmOption
      );
      console.log("getPcmResult", getPcmResult.length);
      const getImageResult = <string[]>(
        await promiseGetImageData(f, mediaDirPath, getPcmOption)
      );
      console.log("getImageResult", getImageResult.length);

      streams[fName].audio = getPcmResult;
      streams[fName].video = getImageResult;
    });
    return await true;

    // console.log("video file uploaded");
    //コマンド、パラメータにUPLOAD対象を追加
    // streamList.push(streamName);
    // pushStateStream(fName, states);
    // return true;
  } catch (err) {
    console.log("1st catch");
    console.error(err);
    return await false;
  }
};
