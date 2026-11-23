// 문제 생성기: 매판 새로 만듦(외워서 못 풀게) · 결과 { kind, tag, title, body(모니터 HTML), opts(보기 HTML 4개), ans(정답 번호) }
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
export const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const six = f => Array.from({ length: 6 }, (_, i) => f(i));
const recent = new Map();   // 틀마다 최근에 쓴 번호 · 같은 틀이 연달아 안 나오게
const fresh = (key, list) => {
  const used = recent.get(key) ?? [], idx = list.map((_, i) => i), free = idx.filter(i => !used.includes(i)), i = pick(free.length ? free : idx);
  recent.set(key, [...used, i].slice(-Math.ceil(list.length / 2))); return list[i];
};
const mixed = (right, wrongs, show = String) => { const l = shuffle([right, ...wrongs]); return { opts: l.map(show), ans: l.indexOf(right) }; };
const trap3 = w => [...w.slice(0, 2), pick(w.slice(2))];   // 앞 둘(흔한 착각)은 꼭, 나머지에서 하나
let lang = 'ko';   // 방 언어 · 서버가 문제를 만들기 직전에 정함(만들기는 한 번에 끝나서 방끼리 안 섞임)
export const setLang = l => { lang = l === 'en' ? 'en' : 'ko'; };
const tr = (ko, en) => lang === 'en' ? en : ko;
const many = (k, e) => tr(`${e} ${k}개`, `${k} ${e}`);

// ───────── 1. 수열 · 단계(0 쉬움 ~ 2 어려움)마다 규칙 묶음
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43];
const SEQ = [
  [() => { const a = R(1, 30), d = R(2, 12); return six(i => a + d * i); },                                     // +d
   () => { const a = R(60, 99), d = R(3, 9); return six(i => a - d * i); },                                     // −d
   () => { const a = R(2, 9); return six(i => a * (i + 1)); },                                                  // a의 배수
   () => { const u = R(4, 9), v = R(1, u - 1); let x = R(1, 9); return six(i => { const t = x; x += i % 2 ? -v : u; return t; }); }],   // +u, −v 번갈아
  [() => { let x = R(1, 10), d = R(1, 4); const e = R(1, 3); return six(() => { const v = x; x += d; d += e; return v; }); },   // 차이가 늘어남
   () => { const a = R(1, 5), r = R(2, 3); return six(i => a * r ** i); },                                      // ×r
   () => { const s = R(1, 5), c = R(-1, 4); return six(i => (s + i) ** 2 + c); },                               // 제곱수 + c
   () => { const s = R(1, 4), c = R(0, 5); return six(i => (s + i) * (s + i + 1) / 2 + c); },                    // 삼각수 + c
   () => { let x = R(2, 6); const k = R(1, 2); return six(() => { const v = x; x = x * 3 - k; return v; }); }],   // ×3 − k
  [() => { const t = [R(1, 5), R(2, 8)]; while (t.length < 6) t.push(t.at(-1) + t.at(-2)); return t; },          // 앞 두 수의 합
   () => { const a = R(1, 9), b = R(30, 45), d = R(2, 5), e = R(2, 6); return six(i => i % 2 ? b - e * (i >> 1) : a + d * (i >> 1)); },   // 두 수열이 번갈아
   () => { const k = R(1, 5); let x = R(1, 6); return six(i => { const v = x; x = i % 2 ? x * 2 : x + k; return v; }); },   // +k, ×2 번갈아
   () => { let x = R(1, 4); const c = R(1, 3); return six(() => { const v = x; x = x * 2 + c; return v; }); },    // ×2 + c
   () => { const o = R(0, 7), c = R(0, 3); return six(i => PRIMES[o + i] + c); },                              // 소수 + c
   () => { let x = R(1, 20); return six(i => { const v = x; x += 2 ** i; return v; }); },                       // 차이가 1, 2, 4, 8…
   () => { const a = R(1, 3); return six(i => (i + a) ** 3 - (i + a)); }],                                      // n³ − n
];
export function seq(lv) {
  const t = fresh(`seq${lv}`, SEQ[lv])(), ans = t[5], d1 = t[4] - t[3], dd = d1 - (t[3] - t[2]) || 2;
  const w = [...new Set([t[4] + d1, ans + dd, ans - dd, ans + 1, ans - 1, ans + 2, ans - 2, ans + 3])].filter(v => v !== ans && v >= 0);   // 앞 둘은 흔한 착각(같은 차이로 이어 가기)
  return {
    kind: 'seq', tag: tr('수열', 'Sequence'), title: pick(tr(['다음에 올 수는?', '물음표에 들어갈 수는?', '규칙을 찾아 보세요. 다음 수는?'], ['What comes next?', 'Which number replaces the ?', 'Find the rule. What comes next?'])),
    body: `<div class="seq">${t.slice(0, 5).map(n => `<span>${n}</span>`).join('')}<span class="q">?</span></div>`,
    ...mixed(ans, trap3(w)),
  };
}

// ───────── 2. 도형 행렬 · 칸마다 모양·개수·채우기 · 셋에 행/열/라틴 규칙을 나눠 줌
const SH = ['circle', 'square', 'tri', 'diamond', 'star', 'hex'], FI = ['none', 'solid', 'stripe'];
const PAT = { row: r => r, col: (r, c) => c, lat: (r, c) => (r + c) % 3, lat2: (r, c) => (r + 2 * c) % 3, one: () => 0 };
const MAT = [
  [['row', 'col', 'one']],
  [['lat', 'col', 'one'], ['row', 'lat', 'one'], ['lat', 'row', 'col']],
  [['lat', 'lat2', 'one'], ['lat', 'lat2', 'row'], ['lat2', 'col', 'lat']],
];
let sid = 0;
function shape(s, x, y, r, fill) {
  const P = pts => `<polygon points="${pts.map(([a, b]) => `${(x + a * r).toFixed(1)},${(y + b * r).toFixed(1)}`).join(' ')}" ${fill}/>`;
  const ring = (n, k = () => 1, rot = -Math.PI / 2) => Array.from({ length: n }, (_, i) => { const a = rot + i * 2 * Math.PI / n; return [Math.cos(a) * k(i), Math.sin(a) * k(i)]; });
  switch (s) {
    case 'circle': return `<circle cx="${x}" cy="${y}" r="${r * .9}" ${fill}/>`;
    case 'square': return `<rect x="${x - r * .8}" y="${y - r * .8}" width="${r * 1.6}" height="${r * 1.6}" ${fill}/>`;
    case 'tri': return P([[0, -1], [.95, .75], [-.95, .75]]);
    case 'diamond': return P(ring(4));
    case 'star': return P(ring(10, i => i % 2 ? .45 : 1));
    case 'hex': return P(ring(6, () => .95, 0));
  }
}
function cellSvg(d) {
  const id = `st${++sid}`, fill = { none: 'fill="none"', solid: 'fill="currentColor"', stripe: `fill="url(#${id})"` }[d.f];
  const pos = [[[50, 50]], [[29, 50], [71, 50]], [[50, 29], [29, 71], [71, 71]]][d.n - 1];
  return `<svg viewBox="0 0 100 100" class="cell"><defs><pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="7" fill="currentColor"/></pattern></defs>`
    + `<g stroke="currentColor" stroke-width="3.5" stroke-linejoin="round">${pos.map(([x, y]) => shape(d.s, x, y, 18, fill)).join('')}</g></svg>`;
}
export function matrix(lv) {
  const keys = ['s', 'n', 'f'], pats = shuffle([...pick(MAT[lv])]);
  const vals = { s: shuffle([...SH]).slice(0, 3), n: shuffle([1, 2, 3]), f: shuffle([...FI]) };
  const at = (r, c) => Object.fromEntries(keys.map((k, i) => [k, vals[k][PAT[pats[i]](r, c)]]));
  const ans = at(2, 2);
  const wrongs = shuffle(keys.flatMap(k => vals[k].filter(v => v !== ans[k]).map(v => ({ ...ans, [k]: v })))).slice(0, 3);   // 한 가지만 다른 그림
  const cells = Array.from({ length: 9 }, (_, i) => i === 8 ? '<div class="q">?</div>' : cellSvg(at(i / 3 | 0, i % 3)));
  return { kind: 'mat', tag: tr('도형 행렬', 'Shape Matrix'), title: tr('빈칸에 들어갈 그림은?', 'Which picture fills the blank?'), body: `<div class="mat">${cells.join('')}</div>`, ...mixed(ans, wrongs, cellSvg) };
}

// ───────── 3. 논리 · 이름 묶음과 상황을 바꿔 가며 · 조사(은/는, 이/가, 과/와)는 받침 보고 자동
const DAY = ['일', '월', '화', '수', '목', '금', '토'];
const NAME_SETS = [['갑', '을', '병', '정'], ['민수', '지은', '현우', '서연'], ['곰', '여우', '토끼', '다람쥐'], ['빨강', '파랑', '노랑', '초록'], ['도윤', '하린', '준서', '유나'], ['사자', '펭귄', '고래', '부엉이']];
const NAME_SETS_EN = [['Alex', 'Ben', 'Cara', 'Dana'], ['Mia', 'Leo', 'Zoe', 'Sam'], ['Bear', 'Fox', 'Rabbit', 'Squirrel'], ['Red', 'Blue', 'Yellow', 'Green'], ['Noah', 'Emma', 'Liam', 'Ava'], ['Lion', 'Penguin', 'Whale', 'Owl']];
const names = () => fresh('names', tr(NAME_SETS, NAME_SETS_EN));
const batchim = w => { const c = w.charCodeAt(w.length - 1) - 0xAC00; return c >= 0 && c < 11172 && c % 28 > 0; };
const josa = (w, [a, b]) => w + (batchim(w) ? a : b);
const EUN = ['은', '는'], GWA = ['과', '와'], I = ['이', '가'];
const perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));

export function liar() {
  const N = names();
  const truth = (t, L) => ({ L: L === t.x, H: L !== t.x, E: L === t.x || L === t.y, B: L !== t.x && L !== t.y })[t.k];
  const say = t => tr({
    L: `${josa(N[t.x], EUN)} 거짓말쟁이야.`, H: `${josa(N[t.x], EUN)} 진실만 말해.`,
    E: `${josa(N[t.x], GWA)} ${N[t.y]} 중 한 명이 거짓말쟁이야.`, B: `${josa(N[t.x], GWA)} ${josa(N[t.y], EUN)} 둘 다 정직해.`,
  }, {
    L: `${N[t.x]} is a liar.`, H: `${N[t.x]} only tells the truth.`,
    E: `One of ${N[t.x]} and ${N[t.y]} is a liar.`, B: `${N[t.x]} and ${N[t.y]} are both honest.`,
  })[t.k];
  for (;;) {
    const st = N.map((_, s) => { const o = [0, 1, 2, 3].filter(i => i !== s), x = pick(o), y = pick(o.filter(i => i !== x)); return { k: pick(['L', 'H', 'E', 'B']), x, y }; });
    const fit = [0, 1, 2, 3].filter(L => st.every((t, s) => truth(t, L) === (s !== L)));   // 거짓말쟁이 L 을 가정했을 때 말이 다 맞아떨어지는가
    if (fit.length === 1) return { kind: 'name', tag: tr('거짓말쟁이 찾기', 'Find the Liar'), title: tr('넷 중 딱 한 명만 거짓말을 해요. 거짓말쟁이는?', 'Exactly one of the four is lying. Who is it?'), body: `<ul class="talk">${st.map((t, s) => `<li><b>${N[s]}</b><span>“${say(t)}”</span></li>`).join('')}</ul>`, opts: [...N], ans: fit[0] };
  }
}
const ORDER = [   // 상황마다: 제목(몇 번째), 단서 문장
  { q: ['맨 앞', '앞에서 두 번째', '앞에서 세 번째', '맨 뒤'].map(w => `점심 줄 · ${w}에 선 사람은?`), rel: (a, b) => `${josa(a, EUN)} ${b}보다 앞에 섰어요.` },
  { q: ['1등', '2등', '3등', '꼴찌'].map(w => `달리기 · ${w}로 들어온 사람은?`), rel: (a, b) => `${josa(a, EUN)} ${b}보다 먼저 들어왔어요.` },
  { q: ['가장 먼저', '두 번째로', '세 번째로', '가장 늦게'].map(w => `아침 출근 · ${w} 온 사람은?`), rel: (a, b) => `${josa(a, EUN)} ${b}보다 일찍 왔어요.` },
  { q: ['가장 큰', '두 번째로 큰', '세 번째로 큰', '가장 작은'].map(w => `키 순서 · ${w} 사람은?`), rel: (a, b) => `${josa(a, EUN)} ${b}보다 키가 커요.` },
];
const ORDER_EN = [
  { q: ['first', 'second', 'third', 'last'].map(w => `Lunch line · Who is ${w} in line?`), rel: (a, b) => `${a} is ahead of ${b}.` },
  { q: ['1st', '2nd', '3rd', 'last'].map(w => `Race · Who finished ${w}?`), rel: (a, b) => `${a} finished before ${b}.` },
  { q: ['first', 'second', 'third', 'last'].map(w => `Morning · Who arrived ${w}?`), rel: (a, b) => `${a} arrived earlier than ${b}.` },
  { q: ['tallest', 'second tallest', 'third tallest', 'shortest'].map(w => `Height · Who is the ${w}?`), rel: (a, b) => `${a} is taller than ${b}.` },
];
export function order() {
  const N = names(), th = fresh('order', tr(ORDER, ORDER_EN));
  const line = shuffle([0, 1, 2, 3]), qp = pick([0, 1, 2, 3]), all = perms([0, 1, 2, 3]), cons = [];
  for (const [x, y] of shuffle([[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]])) {
    cons.push(line.indexOf(x) < line.indexOf(y) ? [x, y] : [y, x]);
    if (new Set(all.filter(p => cons.every(([a, b]) => p.indexOf(a) < p.indexOf(b))).map(p => p[qp])).size === 1) break;   // 물은 자리가 하나로 정해질 때까지만 단서 추가
  }
  return { kind: 'name', tag: tr('순서 맞히기', 'Line Up'), title: th.q[qp], body: `<ul class="talk clue">${cons.map(([a, b]) => `<li><span>${th.rel(N[a], N[b])}</span></li>`).join('')}</ul>`, opts: [...N], ans: line[qp] };
}
const DAYS = [   // 문장 틀마다 (기준 요일 d, 숫자 a·b) → [본문, 정답 요일, 흔한 착각]
  (d, a, b) => [`${a}일 전은 <b>${DAY[d]}요일</b>이었어요.<br>오늘부터 <b>${b}일 뒤</b>는 무슨 요일?`, d + a + b, d + b],
  (d, a, b) => [`오늘은 <b>${DAY[d]}요일</b>이에요.<br><b>${b}일 뒤</b>는 무슨 요일?`, d + b, d + b + 1],
  (d, a, b) => [`<b>${b}일 뒤</b>가 <b>${DAY[d]}요일</b>이래요.<br>오늘은 무슨 요일?`, d - b, d + b],
  (d, a, b) => [`어제의 <b>${a}일 뒤</b>가 <b>${DAY[d]}요일</b>이에요.<br>오늘부터 <b>${b}일 뒤</b>는?`, d - a + 1 + b, d - a + b],
  (d, a, b) => [`그저께가 <b>${DAY[d]}요일</b>이었어요.<br>모레의 <b>${b}일 뒤</b>는 무슨 요일?`, d + 4 + b, d + 2 + b],
];
const DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAYS_EN = [
  (d, a, b) => [`<b>${a} days ago</b> was <b>${DAY_EN[d]}</b>.<br>What day is <b>${b} days</b> from today?`, d + a + b, d + b],
  (d, a, b) => [`Today is <b>${DAY_EN[d]}</b>.<br>What day is <b>${b} days</b> from now?`, d + b, d + b + 1],
  (d, a, b) => [`<b>${b} days</b> from now is <b>${DAY_EN[d]}</b>.<br>What day is today?`, d - b, d + b],
  (d, a, b) => [`<b>${a} days</b> after yesterday is <b>${DAY_EN[d]}</b>.<br>What day is <b>${b} days</b> from today?`, d - a + 1 + b, d - a + b],
  (d, a, b) => [`The day before yesterday was <b>${DAY_EN[d]}</b>.<br>What day is <b>${b} days</b> after the day after tomorrow?`, d + 4 + b, d + 2 + b],
];
export function days(lv = 1) {
  const mod = v => ((v % 7) + 7) % 7, d = R(0, 6), a = R(3, 20), b = [R(8, 20), R(15, 45), R(40, 100)][lv];
  const [body, raw, trap] = fresh('days', tr(DAYS, DAYS_EN))(d, a, b), ans = mod(raw);
  const w = [...new Set([mod(trap), mod(ans + 1), mod(ans + 6), mod(ans + 2)])].filter(v => v !== ans).slice(0, 3);   // 첫 보기: 흔한 착각
  return { kind: 'day', tag: tr('요일 계산', 'Day Count'), title: tr('무슨 요일일까요?', 'What day is it?'), body: `<p class="story">${body}</p>`, ...mixed(ans, w, i => tr(`${DAY[i]}요일`, DAY_EN[i])) };
}

// ───────── 4. 숫자·계산
const ARITH = [
  [() => { const a = R(12, 59), b = R(12, 39), c = R(2, 19); return [`${a} + ${b} − ${c}`, a + b - c]; },
   () => { const a = R(50, 99), b = R(12, 39), c = R(2, 29); return [`${a} − ${b} + ${c}`, a - b + c]; },
   () => { const a = R(12, 25), b = R(3, 6); return [`${a} × ${b}`, a * b]; },
   () => { const b = R(3, 9), a = b * R(6, 15); return [`${a} ÷ ${b}`, a / b]; }],
  [() => { const a = R(12, 29), b = R(3, 9), c = R(5, 40); return [`${a} × ${b} + ${c}`, a * b + c]; },
   () => { const a = R(5, 19), b = R(5, 19), c = R(3, 7); return [`(${a} + ${b}) × ${c}`, (a + b) * c]; },
   () => { const b = R(3, 9), a = b * R(8, 20), c = R(10, 50); return [`${a} ÷ ${b} + ${c}`, a / b + c]; },
   () => { const p = pick([10, 20, 25, 50]), n = pick([40, 60, 80, 120, 160, 200, 240]); return [tr(`${n}의 ${p}%`, `${p}% of ${n}`), n * p / 100]; }],
  [() => { const a = R(11, 19), b = R(11, 19), c = R(10, 99); return [`${a} × ${b} − ${c}`, a * b - c]; },
   () => { const a = R(6, 12), b = R(6, 12), c = R(3, 9), d = R(3, 9); return [`${a} × ${b} + ${c} × ${d}`, a * b + c * d]; },
   () => { const a = R(11, 25), c = R(10, 99); return [`${a}² − ${c}`, a * a - c]; },
   () => { const p = pick([15, 30, 75, 120]), n = pick([40, 60, 80, 120, 200]); return [tr(`${n}의 ${p}%`, `${p}% of ${n}`), n * p / 100]; }],
];
export function arith(lv) {
  const [e, ans] = fresh(`arith${lv}`, ARITH[lv])();
  const w = shuffle([ans + 10, ans - 10, ans + 1, ans - 1, ans + 9, ans - 9].filter(v => v >= 0)).slice(0, 3);   // 받아올림 실수 · 한 끗 차이
  return { kind: 'num', tag: tr('암산', 'Mental Math'), title: tr('계산 결과는?', 'What is the answer?'), body: `<p class="expr">${e} = <span class="q">?</span></p>`, ...mixed(ans, w) };
}
const isPrime = n => n > 1 && Array.from({ length: Math.floor(Math.sqrt(n)) - 1 }, (_, i) => i + 2).every(d => n % d);
const PROPS = [
  ['짝수', n => n % 2 === 0, 'even'], ['5의 배수', n => n % 5 === 0, 'multiples of 5'], ['두 자리 숫자가 같은 수', n => n % 11 === 0, 'numbers with two equal digits'],
  ['3의 배수', n => n % 3 === 0, 'multiples of 3'], ['4의 배수', n => n % 4 === 0, 'multiples of 4'], ['제곱수', n => Number.isInteger(Math.sqrt(n)), 'perfect squares'],
  ['소수', isPrime, 'primes'], ['7의 배수', n => n % 7 === 0, 'multiples of 7'], ['9의 배수', n => n % 9 === 0, 'multiples of 9'], ['각 자리 숫자의 합이 10인 수', n => (n % 10) + (n / 10 | 0) === 10, 'numbers whose digits add up to 10'],
];
const ODD_LV = [[0, 1, 2], [3, 4, 5, 1], [6, 7, 8, 9, 5]];   // 단계별로 쓸 성질
export function odd(lv) {
  const pool = Array.from({ length: 90 }, (_, i) => i + 10);
  for (;;) {
    const [name, f, en] = PROPS[fresh(`odd${lv}`, ODD_LV[lv])];
    const yes = shuffle(pool.filter(f)).slice(0, 3), no = pick(pool.filter(n => !f(n))), set = [...yes, no];
    const other = PROPS.some(([, g]) => [set.filter(g), set.filter(x => !g(x))].some(o => o.length === 1 && o[0] !== no));   // 다른 성질로도 하나가 튀면 답이 둘 → 다시
    if (!other) return { kind: 'num', tag: tr('다른 하나', 'Odd One Out'), title: tr('셋은 같은 성질, 하나만 달라요. 어느 것?', 'Three share a property, one does not. Which one?'), body: tr('<p class="story">네 수 중 <b>하나만</b> 성질이 달라요</p>', '<p class="story">Only <b>one</b> of the four is different</p>'), ...mixed(no, yes), why: tr(`나머지는 모두 ${name}`, `The others are all ${en}`) };
  }
}
const clockFace = (h, m) => { const hh = m >= 45 ? h % 12 + 1 : h; return String.fromCodePoint((m >= 15 && m < 45 ? 0x1F55C : 0x1F550) + (hh + 11) % 12); };   // 🕐~🕛 정각, 🕜~🕧 30분 · 가까운 쪽
export function clock(lv) {
  const h = R(1, 11), m = lv === 0 ? 30 : 5 * R(1, 11), ang = x => { x = Math.abs(x) % 360; return Math.min(x, 360 - x); };
  const ans = ang(30 * h - 5.5 * m);
  const w = [...new Set([ang(30 * h - 6 * m), 360 - ans, ans + 15, ans - 15, ans + 30, ans - 30])].filter(v => v !== ans && v >= 0 && v <= 360).slice(0, 3);   // 첫 보기: 시침이 안 움직인다고 본 답
  return { kind: 'num', tag: tr('시계 각도', 'Clock Angle'), title: tr('시침과 분침 사이의 작은 각은?', 'Smaller angle between the hour and minute hands?'), body: `<p class="story big">${clockFace(h, m)} <b>${tr(`${h}시 ${m}분`, `${h}:${String(m).padStart(2, '0')}`)}</b></p>`, ...mixed(ans, w, v => `${v}°`), why: tr('분침이 움직이면 시침도 1분에 0.5°씩 움직여요', 'The hour hand also moves 0.5° every minute') };
}
const FRUIT_SETUP = [   // 값 a·b·c 를 정확히 알 수 있는 식 묶음
  (A, B, C, a, b, c) => [`${A} + ${A} + ${A} = ${3 * a}`, `${A} + ${B} = ${a + b}`, `${B} − ${C} = ${b - c}`],
  (A, B, C, a, b, c) => [`${A} + ${A} = ${2 * a}`, `${A} × ${B} = ${a * b}`, `${B} + ${C} = ${b + c}`],
  (A, B, C, a, b, c) => [`${A} + ${B} + ${C} = ${a + b + c}`, `${A} + ${B} = ${a + b}`, `${B} + ${C} = ${b + c}`],
  (A, B, C, a, b, c) => [`${B} × ${B} = ${b * b}`, `${B} + ${C} + ${C} = ${b + 2 * c}`, `${C} × ${A} = ${c * a}`],
];
const FRUIT_ASK = [   // 단계별 물음 [식, 답, 흔한 착각]
  [(A, B, C, a, b, c) => [`${B} + ${C}`, b + c, b - c], (A, B, C, a, b, c) => [`${A} + ${C}`, a + c, a + b], (A, B, C, a, b, c) => [`${A} − ${C}`, a - c, a + c]],
  [(A, B, C, a, b, c) => [`${A} + ${B} × ${C}`, a + b * c, (a + b) * c], (A, B, C, a, b, c) => [`${A} × ${C} + ${B}`, a * c + b, a * (c + b)], (A, B, C, a, b, c) => [`${C} × ${C} − ${A}`, c * c - a, c * 2 - a]],
  [(A, B, C, a, b, c) => [`${A} × ${C} − ${B} × ${B}`, a * c - b * b, (a * c - b) * b], (A, B, C, a, b, c) => [`${A} × ${B} × ${C}`, a * b * c, a * b + c], (A, B, C, a, b, c) => [`(${A} + ${B}) × ${C} − ${A}`, (a + b) * c - a, a + b * c - a]],
];
export function fruit(lv) {
  const F = shuffle(['🍎', '🍌', '🍇', '🍊', '🍓', '🍑', '🍉', '🍋', '🥝', '🍒']).slice(0, 3), a = R(2, 9), c = R(2, 5), b = c + R(1, 5), v = [...F, a, b, c];
  const lines = fresh('fruit', FRUIT_SETUP)(...v), [q, ans, trap] = fresh(`fruitq${lv}`, FRUIT_ASK[lv])(...v);
  const w = [...new Set([trap, ans + 1, ans - 1, ans + c, ans - c])].filter(x => x !== ans).slice(0, 3);   // 첫 보기: 흔한 착각
  return { kind: 'num', tag: tr('과일 방정식', 'Fruit Equations'), title: tr('물음표에 들어갈 수는?', 'Which number replaces the ?'), body: `<ul class="eqs">${[...lines, `${q} = <span class="q">?</span>`].map(l => `<li>${l}</li>`).join('')}</ul>`, ...mixed(ans, w) };
}
export function scale(lv) {
  const a = R(2, 4), r = R(2, 3), s = R(2, 3), t = R(2, 3), u = t + 1;
  const [lines, ask, ans] = [
    [[`${many(1, '🔺')} = ${many(a, '⚪')}`, `${many(1, '🟦')} = ${many(r, '🔺')}`], many(2, '🟦'), 2 * r * a],
    [[`${many(1, '🔺')} = ${many(a, '⚪')}`, `${many(1, '🟦')} = ${many(r, '🔺')}`, `${many(1, '⭐')} = ${many(s, '🟦')}`], many(1, '⭐'), s * r * a],
    [[`${many(1, '🔺')} = ${many(a, '⚪')}`, `${many(t, '🟦')} = ${many(u, '🔺')}`], many(2 * t, '🟦'), 2 * u * a],
  ][lv];
  const w = [...new Set([ans + a, ans - a, ans + 1, ans * 2, ans - 1])].filter(v => v > 0 && v !== ans).slice(0, 3);
  return { kind: 'num', tag: tr('저울', 'Balance'), title: tr(`${ask}의 무게는 ⚪ 몇 개와 같을까요?`, `${ask} weighs the same as how many ⚪?`), body: `<p class="story sm">${tr('저울 양쪽 무게가 똑같았어요', 'Each scale was perfectly balanced')}</p><ul class="eqs">${lines.map(l => `<li>⚖️ ${l}</li>`).join('')}</ul>`, ...mixed(ans, w, v => tr(`${v}개`, `${v}`)) };
}
export function count(lv) {
  const kinds = lv === 2 ? ['square', 'diamond', 'hex'] : shuffle(['circle', 'tri', 'star', 'square', 'hex']).slice(0, 3), COL = ['#ff6b81', '#4dabf7', '#ffd43b'];
  const target = kinds[0], ans = R(5, 11), total = 18 + lv * 6;
  const items = shuffle([...Array(ans).fill(target), ...Array.from({ length: total - ans }, () => pick(kinds.slice(1)))]);
  const cells = shuffle(Array.from({ length: 50 }, (_, i) => i)).slice(0, total);
  const col = i => lv === 0 ? COL[kinds.indexOf(items[i])] : pick(COL);   // 쉬움은 모양마다 색이 같고, 어려울수록 섞임
  const svg = items.map((k, i) => shape(k, (cells[i] % 10) * 90 + 45 + R(-14, 14), Math.floor(cells[i] / 10) * 90 + 45 + R(-12, 12), 24, `fill="${col(i)}"`)).join('');
  const w = shuffle([ans + 1, ans - 1, ans + 2, ans - 2]).slice(0, 3);
  const icon = `<svg viewBox="0 0 60 60" class="ico"><g stroke="currentColor" stroke-width="4">${shape(target, 30, 30, 24, 'fill="none"')}</g></svg>`;
  return { kind: 'num', tag: tr('개수 세기', 'Count It'), title: `${icon} ${tr('이 모양은 몇 개?', 'How many of this shape?')}`, body: `<svg viewBox="0 0 900 450" class="scatter"><g stroke="none">${svg}</g></svg>`, ...mixed(ans, w, v => tr(`${v}개`, `${v}`)) };
}

// ───────── 5. 네모 찾기 · 꽉 찬 숫자판에서 안의 합이 목표(0~10 랜덤)인 직사각형을 드래그로 찾기
export const rectSum = (g, r0, c0, r1, c1) => { let s = 0; for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) s += g[r][c]; return s; };
export function rectAll(g, target) {
  const R = g.length, C = g[0].length, P = Array.from({ length: R + 1 }, () => Array(C + 1).fill(0));   // 누적합
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) P[r + 1][c + 1] = g[r][c] + P[r][c + 1] + P[r + 1][c] - P[r][c];
  const out = [];
  for (let r0 = 0; r0 < R; r0++) for (let r1 = r0; r1 < R; r1++) for (let c0 = 0; c0 < C; c0++) for (let c1 = c0; c1 < C; c1++)
    if (P[r1 + 1][c1 + 1] - P[r0][c1 + 1] - P[r1 + 1][c0] + P[r0][c0] === target) out.push([r0, c0, r1, c1]);
  return out;
}
// 칸 값은 1/12 단위 정수(분수 합을 정확히) · 빈칸 없이 양수·마이너스 반반에 0·분수·큰 수 섞기
const U = 12, FR = { 6: '½', 3: '¼', 9: '¾', 4: '⅓', 8: '⅔' };
const gcd = (a, b) => b ? gcd(b, a % b) : a;
export const fmt12 = v => {
  if (v % U === 0) return String(v / U).replace('-', '−');
  const a = Math.abs(v), w = Math.floor(a / U), r = a % U, g = gcd(r, U);
  return (v < 0 ? '−' : '') + (w || '') + (FR[r] ?? `${r / g}/${U / g}`);
};
const CELL = () => {
  const x = Math.random();
  if (x < .40) return pick([1, 1, 2, 2, 3, 4, 5, 7, 8, 9]) * U;                     // 양수
  if (x < .78) return -pick([1, 1, 2, 2, 3, 4, 5, 7, 8, 9]) * U;                    // 마이너스
  if (x < .82) return 0;
  if (x < .94) return pick([1, -1]) * pick([6, 6, 3, 9, 4, 8]);                     // 분수
  return pick([100, 200, -100, -200]) * U;                                          // 큰 수
};
export function rects(lv, target = R(0, 10)) {
  for (;;) {
    const grid = Array.from({ length: 8 }, () => Array.from({ length: 9 }, CELL)), labels = grid.map(r => r.map(fmt12));
    const total = rectAll(grid, target * U).length;
    if (total >= 4 && total <= 15) return { kind: 'rect', tag: tr('네모 찾기', 'Find Rectangles'), title: tr(`안의 숫자 합이 <b>${target}</b>인 네모를 그어 보세요`, `Drag rectangles whose numbers add up to <b>${target}</b>`), body: '', opts: [], ans: -1, grid, labels, target: target * U, total };
  }
}

// ───────── 6. 숨은 규칙 · 기본 동작 1~2개를 엮어 매번 새 규칙 · 예시 셋으로 답이 하나로 정해질 때만 냄
const digits = x => [...String(x)].map(Number);
const STEP = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => ({ f: x => x + k, s: `+${k}` })),
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => ({ f: x => x - k, s: `−${k}` })),
  ...[2, 3, 4, 5].map(k => ({ f: x => x * k, s: `×${k}` })),
  { f: x => x * x, s: '제곱', e: 'square', hard: 1 },
  { f: x => x >= 10 ? +digits(x).reverse().join('') : NaN, s: '자리 뒤집기', e: 'reverse digits', hard: 1 },
  { f: x => x >= 0 ? digits(x).reduce((a, d) => a + d, 0) : NaN, s: '각 자리 합', e: 'sum of digits', hard: 1 },
];
const RULES = [...STEP.map((_, i) => [i]), ...STEP.flatMap((_, i) => STEP.map((_, j) => [i, j]))];
const run = (r, x) => r.reduce((v, i) => v < 0 || !Number.isInteger(v) ? NaN : STEP[i].f(v), x);
export function rule(lv) {
  const easy = STEP.flatMap((t, i) => t.hard ? [] : [i]), hard = STEP.flatMap((t, i) => t.hard ? [i] : []);
  for (;;) {
    const r = [[pick(easy)], shuffle([pick(easy), pick(easy.filter(i => STEP[i].s[0] === '×'))]), shuffle([pick(hard), pick(easy)])][lv];
    const xs = shuffle(Array.from({ length: 30 }, (_, i) => i + 2)).slice(0, 4), ys = xs.map(x => run(r, x));
    if (ys.some(y => !Number.isInteger(y) || y < 0 || y > 999)) continue;
    const fits = new Set(RULES.filter(o => xs.slice(0, 3).every((x, i) => run(o, x) === ys[i])).map(o => run(o, xs[3])));
    if (fits.size !== 1) continue;   // 다른 규칙으로도 맞으면 답이 갈림 → 다시
    const ans = ys[3], w = [...new Set([run([...r].reverse(), xs[3]), run(r.slice(0, 1), xs[3]), ans + 1, ans - 1, ans + 2, ans - 2, ans + 10])].filter(v => Number.isInteger(v) && v >= 0 && v !== ans);
    const rows = xs.map((x, i) => `<li>${x} → ${i < 3 ? ys[i] : '<span class="q">?</span>'}</li>`).join('');
    return { kind: 'num', tag: tr('숨은 규칙', 'Hidden Rule'), title: tr('같은 규칙이에요. 물음표는?', 'Same rule for every row. What replaces the ?'), body: `<ul class="eqs">${rows}</ul>`, ...mixed(ans, trap3(w)), why: `${tr('규칙', 'Rule')}: ${r.map(i => tr(STEP[i].s, STEP[i].e ?? STEP[i].s)).join(' → ')}` };
  }
}

// ───────── 7. 연산자 채우기 · 식이 맞는 기호 조합이 딱 하나일 때만 냄(곱셈·나눗셈 먼저)
const OP = ['+', '−', '×', '÷'];
function calc(ns, os) {
  const t = [ns[0]], o = [];
  os.forEach((op, i) => {
    const n = ns[i + 1];
    if (op === '×') t.push(t.pop() * n);
    else if (op === '÷') { const a = t.pop(); t.push(a % n ? NaN : a / n); }
    else { t.push(n); o.push(op); }
  });
  return o.reduce((v, op, i) => op === '+' ? v + t[i + 1] : v - t[i + 1], t[0]);
}
const combos = k => k ? combos(k - 1).flatMap(c => OP.map(op => [...c, op])) : [[]];
export function ops(lv) {
  const k = lv === 2 ? 3 : 2, all = combos(k).filter(c => lv || !c.includes('÷'));
  for (;;) {
    const ns = Array.from({ length: k + 1 }, () => R(2, 9)), ans = pick(all), v = calc(ns, ans);
    if (!Number.isInteger(v) || v < 0) continue;
    const same = all.filter(c => calc(ns, c) === v);
    if (same.length !== 1) continue;
    const expr = ns.map((n, i) => i ? `<span class="q">○</span> ${n}` : n).join(' ');
    return { kind: 'num', tag: tr('연산자 채우기', 'Fill the Operators'), title: tr('○ 에 들어갈 기호는? (곱셈·나눗셈 먼저)', 'Which signs go in the ○? (× and ÷ first)'), body: `<p class="expr">${expr} = ${v}</p>`, ...mixed(ans, shuffle(all.filter(c => c !== ans)).slice(0, 3), c => c.join(' ')) };
  }
}

// ───────── 8. 블록 세기 · 뒤로 갈수록 높게 쌓아(꼭대기는 다 보임) 가려진 아래 블록까지 세기
export function cube(lv) {
  const [rows, cols, top] = [[3, 3, 3], [3, 4, 3], [4, 4, 4]][lv];
  for (;;) {
    const h2 = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const mx = Math.min(r ? h2[r - 1][c] : top, c ? h2[r][c - 1] : top); h2[r][c] = R(Math.max(0, mx - 2), mx); }
    const ans = h2.flat().reduce((a, b) => a + b, 0);
    if (ans < 6 + lv * 4 || ans > 14 + lv * 8) continue;
    const W = 26, H = 15, V = 30, g = (r, c, z) => [(c - r) * W, (c + r) * H - z * V], pt = l => l.map(p => p.join(',')).join(' ');
    const cubes = h2.flatMap((row, r) => row.flatMap((n, c) => Array.from({ length: n }, (_, z) => [r, c, z]))).sort((a, b) => a[0] + a[1] + a[2] - b[0] - b[1] - b[2]);
    const svg = cubes.map(([r, c, z]) => `<polygon class="ct" points="${pt([g(r, c, z + 1), g(r, c + 1, z + 1), g(r + 1, c + 1, z + 1), g(r + 1, c, z + 1)])}"/>`
      + `<polygon class="cl" points="${pt([g(r + 1, c, z + 1), g(r + 1, c + 1, z + 1), g(r + 1, c + 1, z), g(r + 1, c, z)])}"/>`
      + `<polygon class="cr" points="${pt([g(r, c + 1, z + 1), g(r + 1, c + 1, z + 1), g(r + 1, c + 1, z), g(r, c + 1, z)])}"/>`).join('');
    const x0 = -rows * W - 4, y0 = -top * V - 4, vw = (rows + cols) * W + 8, vh = (rows + cols) * H + top * V + 8;
    const w = shuffle([ans + 1, ans - 1, ans + 2, ans - 2, ans + 3].filter(v => v > 0)).slice(0, 3);
    return { kind: 'num', tag: tr('블록 세기', 'Count Blocks'), title: tr('블록은 모두 몇 개? (가려진 것도)', 'How many blocks in total? (hidden ones too)'), body: `<svg viewBox="${x0} ${y0} ${vw} ${vh}" class="cubes">${svg}</svg>`, ...mixed(ans, w, v => tr(`${v}개`, `${v}`)), why: tr('위에 쌓인 블록 아래엔 받치는 블록이 다 있어요', 'Every stacked block sits on blocks below it') };
  }
}

// ───────── 9. 돌려 보기 · 대칭 없는 조각을 돌리거나 뒤집은 모양 고르기 · 오답은 거울상·반대로 돌린 것
const norm = cs => { const r0 = Math.min(...cs.map(c => c[0])), c0 = Math.min(...cs.map(c => c[1])); return cs.map(([r, c]) => [r - r0, c - c0]).sort((a, b) => a[0] - b[0] || a[1] - b[1]); };
const key = cs => norm(cs).join(';');
const cw = cs => norm(cs.map(([r, c]) => [c, -r])), flip = cs => norm(cs.map(([r, c]) => [r, -c]));
const piece = (cs, cell = 22) => { const n = norm(cs), rs = Math.max(...n.map(c => c[0])) + 1, cl = Math.max(...n.map(c => c[1])) + 1;
  return `<svg viewBox="-2 -2 ${cl * cell + 4} ${rs * cell + 4}" class="piece">${n.map(([r, c]) => `<rect x="${c * cell}" y="${r * cell}" width="${cell}" height="${cell}" rx="3"/>`).join('')}</svg>`; };
export function rot(lv) {
  for (;;) {
    const cs = [[0, 0]];
    while (cs.length < 5 + (lv > 0)) {
      const [r, c] = pick(cs), [dr, dc] = pick([[0, 1], [1, 0], [0, -1], [-1, 0]]), n = [r + dr, c + dc];
      if (!cs.some(x => x[0] === n[0] && x[1] === n[1])) cs.push(n);
    }
    const s = norm(cs), turns = [s, cw(s), cw(cw(s)), cw(cw(cw(s)))], all = [...turns, ...turns.map(flip)];
    if (new Set(all.map(key)).size !== 8) continue;   // 대칭이 있으면 보기가 겹침
    const [ask, ans, wrongs] = [
      [tr('시계 방향으로 90° 돌리면?', 'Rotated 90° clockwise?'), turns[1], [flip(turns[1]), turns[3], flip(turns[3])]],
      [tr('180° 돌리면?', 'Rotated 180°?'), turns[2], [flip(turns[2]), flip(s), pick([turns[1], turns[3]])]],
      [tr('좌우로 뒤집은 뒤 시계 방향으로 90° 돌리면?', 'Flipped left-right, then rotated 90° clockwise?'), cw(flip(s)), [turns[1], flip(cw(flip(s))), cw(cw(cw(flip(s))))]],
    ][lv];
    return { kind: 'shape', tag: tr('돌려 보기', 'Rotate It'), title: ask, body: piece(s, 30), ...mixed(ans, wrongs, c => piece(c)) };
  }
}

// ───────── 10. 잠깐 기억 · 3초 보여 주고 감춤(화면 CSS) · 심화는 감춘 뒤 「돌리면·뒤집으면?」 · 오답은 칸 하나 옮긴 판과 다르게 돌린 판
const board = (n, on) => `<svg viewBox="0 0 ${n * 20} ${n * 20}" class="board">${Array.from({ length: n * n }, (_, i) => `<rect class="${on.has(i) ? 'on' : ''}" x="${(i % n) * 20 + 1}" y="${(i / n | 0) * 20 + 1}" width="18" height="18" rx="3"/>`).join('')}</svg>`;
const MOVE = {   // 칸 (r, c) → 바뀐 자리
  same: ['', (r, c) => [r, c]],
  flip: ['<b>좌우로 뒤집으면?</b>', (r, c, n) => [r, n - 1 - c], '<b>flipped left-right</b>?'],
  cw: ['<b>시계 방향 90°</b> 돌리면?', (r, c, n) => [c, n - 1 - r], 'rotated <b>90° clockwise</b>?'],
  ccw: ['<b>반시계 방향 90°</b> 돌리면?', (r, c, n) => [n - 1 - c, r], 'rotated <b>90° counterclockwise</b>?'],
  half: ['<b>180°</b> 돌리면?', (r, c, n) => [n - 1 - r, n - 1 - c], 'rotated <b>180°</b>?'],
};
export function memo(lv, deep = false) {
  const n = !deep && lv === 2 ? 5 : 4, k = [3, 4, 5][lv], mv = deep ? pick([['flip', 'cw'], ['cw', 'ccw', 'half'], ['flip', 'cw', 'ccw', 'half']][lv]) : 'same';
  const turn = (set, m) => new Set([...set].map(i => { const [r, c] = MOVE[m][1](i / n | 0, i % n, n); return r * n + c; }));
  const id = set => [...set].sort((a, b) => a - b).join();
  for (;;) {
    const on = new Set(shuffle(Array.from({ length: n * n }, (_, i) => i)).slice(0, k)), ans = turn(on, mv);
    const moved = () => {
      for (;;) {
        const from = pick([...on]), [dr, dc] = pick([[0, 1], [1, 0], [0, -1], [-1, 0]]), r = (from / n | 0) + dr, c = from % n + dc, to = r * n + c;
        if (r >= 0 && r < n && c >= 0 && c < n && !on.has(to)) return turn(new Set([...on].filter(i => i !== from).concat(to)), mv);
      }
    };
    const traps = mv === 'same' ? [] : Object.keys(MOVE).filter(m => m !== mv).map(m => turn(on, m));   // 안 돌린 판·다르게 돌린 판
    const ws = new Map();
    for (const t of shuffle(traps).slice(0, 2)) if (id(t) !== id(ans)) ws.set(id(t), t);
    for (let tries = 0; ws.size < 3 && tries < 50; tries++) { const m = moved(); if (id(m) !== id(ans)) ws.set(id(m), m); }
    if (ws.size < 3) continue;
    const o = shuffle([ans, ...[...ws.values()].slice(0, 3)]);
    const title = mv === 'same' ? tr('3초 동안 외우세요! 색칠된 칸은?', 'Memorize it in 3 seconds! Which cells were colored?')
      : `<span class="m1">${tr('3초 동안 외우세요!', 'Memorize it in 3 seconds!')}</span><span class="m2">${tr(`본 판을 ${MOVE[mv][0]}`, `The board you saw, ${MOVE[mv][2]}`)}</span>`;
    return { kind: 'memo', tag: tr('잠깐 기억', 'Quick Memory'), title, body: `<div class="memo">${board(n, on)}</div>`, opts: o.map(s => board(n, s)), ans: o.findIndex(s => id(s) === id(ans)) };
  }
}

// ───────── 11. 심리전 · 정답 없음, 모두 고른 뒤 서버가 분포로 점수(settle)를 매김
export const minor = () => ({ kind: 'social', mode: 'minor', tag: tr('소수파 생존', 'Minority Wins'), title: tr('가장 적게 고를 것 같은 쪽은?', 'Which one will the fewest people pick?'), body: tr('<p class="story">가장 <b>적게</b> 고른 쪽 +3 · 가장 <b>많이</b> 고른 쪽 −1 · <b>안 고르면 −3</b></p>', '<p class="story"><b>Fewest</b> picks +3 · <b>most</b> picks −1<br><b>No pick −3</b></p>'), opts: shuffle(['🍀', '🌙', '🔥', '💧', '⭐', '🍄', '🐟', '🎈']).slice(0, 4), ans: -1 });
export const share = () => { const vals = shuffle([2, 4, 6, 8]); return { kind: 'social', mode: 'share', tag: tr('눈치 줍기', 'Split the Box'), title: tr('상자 하나를 고르세요', 'Pick a box'), body: tr('<p class="story">상자 코인을 <b>고른 사람끼리 나눠</b> 가져요</p>', '<p class="story">Everyone who picks a box <b>splits its coins</b></p>'), opts: vals.map(v => `🎁 ${v}`), vals, ans: -1 }; };
export const third = () => ({ kind: 'social', mode: 'third', input: 'num', tag: tr('평균의 ⅔', '⅔ of Average'), title: tr('0~100 중 숫자 하나를 내세요', 'Pick a number from 0 to 100'), body: tr('<p class="story">모두가 낸 수 <b>평균의 ⅔</b>에 가장 가까운 사람 +3</p>', '<p class="story">Closest to <b>⅔ of the average</b><br>of all picks gets +3</p>'), opts: [], ans: -1 });

// 게임 목록 · 한 판마다 이 중 셋을 뽑아 라운드로 씀 · 문제는 라운드 안에서 점점 어렵게(lv 0→2)
export const GAMES = [
  { id: 'seq', en: ['Sequence', 'Find the rule and pick the next number'], name: '수열', icon: '🔢', rule: '규칙을 찾아 다음 수를 고르세요', time: 15, make: seq },
  { id: 'mat', en: ['Shape Matrix', 'Use the row and column rules to fill the blank'], name: '도형 행렬', icon: '🔷', rule: '가로·세로 규칙을 보고 빈칸 그림을 고르세요', time: 25, make: matrix },
  { id: 'liar', en: ['Liar', 'Exactly one of the four is lying'], name: '거짓말쟁이', icon: '🤥', rule: '넷 중 딱 한 명만 거짓말을 해요', time: 30, make: liar },
  { id: 'order', en: ['Line Up', 'Put the clues together to find the order'], name: '순서 맞히기', icon: '🏃', rule: '단서를 모아 순서를 맞히세요', time: 25, make: order },
  { id: 'day', en: ['Day Count', 'Count the days to find the weekday'], name: '요일 계산', icon: '📅', rule: '날짜를 세어 요일을 맞히세요', time: 20, make: days },
  { id: 'arith', en: ['Mental Math', 'No calculator. Be quick!'], name: '암산', icon: '➗', rule: '계산기 없이, 빠르게!', time: 12, make: arith },
  { id: 'odd', en: ['Odd One Out', 'Three share a property, one is different'], name: '다른 하나', icon: '🧩', rule: '셋은 같은 성질, 하나만 달라요', time: 20, make: odd },
  { id: 'clock', en: ['Clock Angle', 'Find the smaller angle between the two hands'], name: '시계 각도', icon: '🕒', rule: '시침과 분침 사이의 작은 각을 구하세요', time: 25, make: clock },
  { id: 'fruit', en: ['Fruit Equations', 'Work out each fruit, then calculate'], name: '과일 방정식', icon: '🍎', rule: '과일 값을 구해서 계산하세요', time: 25, make: fruit },
  { id: 'scale', en: ['Balance', 'Chain the scale clues to count it in ⚪'], name: '저울', icon: '⚖️', rule: '저울 단서를 이어서 무게를 ⚪ 개수로 바꿔 보세요', time: 20, make: scale },
  { id: 'rect', en: ['Find Rectangles', 'Drag to find rectangles whose numbers add up to the target · +1 each, +3 more for finding them all'], name: '네모 찾기', icon: '🔲', rule: '안의 숫자 합이 목표 숫자인 네모를 드래그해서 찾으세요 · 하나에 +1, 다 찾으면 +3 더', time: 60, per: 1, nobet: true, make: rects },
  { id: 'count', en: ['Count It', 'Count fast with your eyes'], name: '개수 세기', icon: '👀', rule: '눈으로 빠르게 세어 보세요', time: 10, make: count },
  { id: 'rule', en: ['Hidden Rule', 'Find the rule behind the three examples'], name: '숨은 규칙', icon: '🕵️', rule: '예시 셋에 숨은 규칙을 찾아 물음표를 채우세요', time: 25, make: rule },
  { id: 'ops', en: ['Fill the Operators', 'Put signs in the ○ to make it true · × and ÷ first'], name: '연산자 채우기', icon: '➕', rule: '식이 맞도록 ○ 에 기호를 넣으세요 · 곱셈·나눗셈 먼저', time: 25, make: ops },
  { id: 'cube', en: ['Count Blocks', 'Count the hidden blocks underneath too'], name: '블록 세기', icon: '🧊', rule: '보이지 않는 아래 블록까지 세어 보세요', time: 20, make: cube },
  { id: 'rot', en: ['Rotate It', 'Rotate the piece in your head · watch out for mirror images'], name: '돌려 보기', icon: '🔄', rule: '조각을 머릿속으로 돌려 보세요 · 거울상 주의', time: 15, make: rot },
  { id: 'memo', en: ['Quick Memory', 'Shown for 3 seconds, then hidden · remember the cells'], name: '잠깐 기억', icon: '🧠', rule: '3초 보여 주고 사라져요 · 칸 위치를 외우세요', time: 13, make: memo },
  { id: 'memo2', en: ['Deep Memory', 'Rotate or flip the board you memorized, in your head'], name: '잠깐 기억 심화', icon: '🌀', rule: '3초 외운 판을 머릿속으로 돌리거나 뒤집으세요', time: 15, make: lv => memo(lv, true) },
  { id: 'minor', en: ['Minority Wins', 'Pick what others won\'t · fewest +3, most −1, no pick −3'], name: '소수파 생존', icon: '🐟', rule: '남들이 덜 고를 쪽을 고르세요 · 가장 적은 쪽 +3, 가장 많은 쪽 −1, 안 고르면 −3', time: 12, nobet: true, make: minor },
  { id: 'third', en: ['⅔ of Average', 'Closest to ⅔ of the average of all picks gets +3'], name: '평균의 ⅔', icon: '🎯', rule: '모두가 낸 수 평균의 ⅔에 가장 가까운 사람이 +3', time: 15, nobet: true, make: third },
  { id: 'share', en: ['Split the Box', 'Pickers split the box coins · big boxes draw crowds'], name: '눈치 줍기', icon: '🎁', rule: '상자 코인을 고른 사람끼리 나눠 가져요 · 큰 상자엔 사람이 몰려요', time: 12, nobet: true, make: share },
];
export const gameText = (g, l) => l === 'en' ? { ...g, name: g.en[0], rule: g.en[1] } : g;   // 게임 이름·규칙(방 언어)
export function pickGames(k, avoid = []) {   // nobet 게임(네모 찾기·심리전)은 베팅(마지막) 라운드에 안 옴
  const l = [...shuffle(GAMES.filter(g => !avoid.includes(g.id))), ...shuffle(GAMES.filter(g => avoid.includes(g.id)))].slice(0, k);
  if (k < 2 || !l[k - 1].nobet) return l;
  const i = l.findIndex(g => !g.nobet);
  if (i >= 0) [l[i], l[k - 1]] = [l[k - 1], l[i]]; else l[k - 1] = pick(GAMES.filter(g => !g.nobet && !l.includes(g)));
  return l;
}
