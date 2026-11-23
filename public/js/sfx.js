// 소리: 웹 오디오로 바로 만듦(파일 없음) · 첫 클릭 때 켜짐
let ac = null;
export const unlock = () => { ac ??= new AudioContext(); if (ac.state === 'suspended') ac.resume(); };
function tone(f0, f1, dur, type = 'sine', vol = .2) {
  if (!ac) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur);
}
export const sfx = {
  join: () => tone(520, 880, .15, 'sine', .15),
  beep: (hi = false) => tone(hi ? 1046 : 523, hi ? 1046 : 523, hi ? .4 : .15, 'square', .08),
  tick: () => tone(1400, 1400, .04, 'square', .05),
  wrong: () => tone(300, 140, .35, 'sawtooth', .12),
  fanfare: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, .3, 'triangle', .16), i * 140)),
};
