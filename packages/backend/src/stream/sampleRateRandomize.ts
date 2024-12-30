import { states } from "../states";

export const sampleRateRandomize = (stream: string) => {
  const max = states.stream.randomraterange[stream].max;
  const min = states.stream.randomraterange[stream].min;
  if (states.stream.randomratemode === "random") {
    const freq =
      states.stream.randomraterange[stream].min +
      Math.random() *
        (states.stream.randomraterange[stream].max -
          states.stream.randomraterange[stream].min);
    console.log("sampleRateRandomize: ", freq);
    return freq;
  } else if (states.stream.randomratemode === "diatonic") {
    const baseFreq = 5512.5;
    const minMultiple = Math.ceil(
      states.stream.randomraterange[stream].min / baseFreq
    );
    const maxMultiple = Math.floor(
      states.stream.randomraterange[stream].max / baseFreq
    );
    if (minMultiple > maxMultiple) {
      throw new Error("minFreq > maxFreq");
    }

    const randomMultiple =
      Math.floor(Math.random() * (maxMultiple - minMultiple + 1)) + minMultiple;
    return baseFreq * randomMultiple;
    // return 5512.5 + Math.floor(Math.random() * 20) * 5512.5;
  } else if (states.stream.randomratemode === "serial") {
    const baseFrequency = 5512.5; // 基準となる倍数
    let noteNumber = 1; // 音階の数

    // 下限に最も近い基音（Ⅰ）を計算
    const baseNote = Math.ceil(min / baseFrequency) * baseFrequency;

    // 平均律の12音間隔（1オクターブは12等分される）
    const semitoneRatio = Math.pow(2, 1 / 12);

    const frequencies: number[] = [];
    let currentFrequency = baseNote;

    // 上限に達するまで周波数を計算して配列に追加
    while (currentFrequency <= max) {
      frequencies.push(currentFrequency);
      if (noteNumber !== 3 && noteNumber !== 7) {
        // イオニアンスケールの3度と7度は半音上げる
        currentFrequency = currentFrequency * semitoneRatio * semitoneRatio;
      } else {
        currentFrequency = currentFrequency * semitoneRatio;
      }
      noteNumber++;
      if (noteNumber > 7) {
        noteNumber = 1;
      }
    }
    console.log("sampleRateRandomize: ", frequencies);
    return frequencies[Math.floor(Math.random() * frequencies.length)];
  }
};
