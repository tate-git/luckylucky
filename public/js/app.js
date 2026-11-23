// 참가자 화면(폰·PC 같음): 방 만들기 / QR·코드로 참가 → 서버가 보내는 상태(st)대로 그림 · 보기 고르기, 베팅, 네모 긋기
import { GAMES, fmt12, rectSum, gameText } from './puzzles.js';
import { sfx, unlock } from './sfx.js';
import { scanQR, closeScan } from './scan.js';

const $ = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const keep = area => ({   // 사생활 모드 등에서 저장소가 막혀도 동작
  get: k => { try { return area().getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? area().removeItem(k) : area().setItem(k, v); } catch {} },
});
const store = keep(() => localStorage);
const pid = store.get('susaum-pid') ?? (() => { const v = crypto.randomUUID().replace(/-/g, '').slice(0, 12); store.set('susaum-pid', v); return v; })();   // 기기 ID · 끊겼다 와도 같은 사람
const L = 'ABCD', fmt = d => d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0', rand = () => String(1000 + Math.floor(Math.random() * 9000));
const params = new URLSearchParams(location.search), force = params.get('games')?.split(',');   // 시험용: ?games=mat,count,fruit
// 화면 언어: ?lang= > 지난번 고른 것 > 기기 언어 · 방에 들어가면 방 언어를 따름
let lang = [params.get('lang'), store.get('susaum-lang')].find(l => ['ko', 'en'].includes(l)) ?? (navigator.language?.startsWith('ko') ? 'ko' : 'en');
const tx = (ko, en) => lang === 'en' ? en : ko;
const roundTime = n => tx({ 1: '약 1~2분', 2: '약 3분', 3: '약 5분' }, { 1: 'about 1–2 min', 2: 'about 3 min', 3: 'about 5 min' })[n];
const refuse = c => ({ 4004: tx('해당 번호의 방이 없습니다.', 'No room with that code.'), 4029: tx('방이 꽉 찼어요 (최대 50명)', 'The room is full (max 50)') })[c];
let ws = null, S = null, here = null, deadline = 0, betVal = 0, numVal = 50, retryT = 0, tries = 0, drag = null;
let pick = ['1', '2', '3'].includes(store.get('susaum-rounds')) ? store.get('susaum-rounds') : '3';
const view = v => { document.body.dataset.view = v; };
const send = m => ws?.readyState === 1 && ws.send(JSON.stringify(m));
const buzz = ms => navigator.vibrate?.(ms);
const err = t => { $('err').textContent = t; };
const playerOf = id => S.players.find(p => p.pid === id);
const isMe = id => id === S.me;   // 서버가 정한 내 ID(같은 기기 두 번째 탭이면 ~2)
const onCount = () => S.players.filter(p => p.on).length;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const roundTag = s => `<b>${s.ri + 1}/${s.rounds}R</b> ${s.icon} ${s.gname}${s.bet ? tx(' · 💰 베팅', ' · 💰 Bet') : ''}`;
const inviteUrl = () => `${location.origin}/?r=${S.code}${S.lang === 'en' ? '&lang=en' : ''}`;

// ───────── 첫 화면 글자(한국어는 HTML 그대로, 영어는 여기)
const EN = {
  sub: 'Lunchtime<br>5-minute brain survival',
  desc: `${GAMES.length} games, one picked at random each round<br>The last round is a coin bet!<br>Everyone joins the same room<br>from their own phone or PC<br><b class="cap">👥 Up to 50 players</b>`,
  invite: '🔢 You\'re invited to room <b id="invCode"></b><br><small>Enter your name to join</small>',
  name: 'Name', enter: '▶ Join', other: 'Another room · Create a room', rounds: 'Rounds', create: '🏠 Create Room', or: 'or join a room',
  scan: '📷 Join by QR', scanHint: 'Point the camera at the QR on the host\'s screen', close: 'Close', leave: 'Leave',
};
const KO = Object.fromEntries([...document.querySelectorAll('[data-t]')].map(e => [e.dataset.t, e.innerHTML]));
function applyLang() {
  document.documentElement.lang = lang;
  for (const e of document.querySelectorAll('[data-t]')) e.innerHTML = (lang === 'en' ? EN : KO)[e.dataset.t];
  $('invCode').textContent = $('code').value;
  $('nick').placeholder = tx('예) 두뇌왕', 'e.g. BrainKing');
  $('code').placeholder = tx('코드 4자리', 'Code');
  $('code').setAttribute('aria-label', tx('코드 참가 · 방 코드 4자리', 'Join by code · 4-digit room code'));
  $('langBtn').textContent = tx('🌐 English', '🌐 한국어');
  drawPick();
}
$('langBtn').onclick = () => { lang = tx('en', 'ko'); store.set('susaum-lang', lang); applyLang(); };

// ───────── 첫 화면
$('nick').value = store.get('susaum-nick') ?? '';
function nickOk() {
  const n = $('nick').value.trim();
  if (!n) { err(tx('이름을 먼저 적어 주세요', 'Please enter your name first')); $('nick').focus(); return null; }
  store.set('susaum-nick', n); return n;
}
function join(r, isNew = false) { unlock(); const n = nickOk(); if (n) { err(''); tries = 0; connect(r, n, isNew); } }
function drawPick() { for (const b of $('seg').children) b.classList.toggle('on', b.dataset.v === pick); $('segNote').textContent = roundTime(pick); }
$('seg').onclick = e => { const b = e.target.closest('[data-v]'); if (b) { pick = b.dataset.v; store.set('susaum-rounds', pick); drawPick(); } };
applyLang();
$('create').onclick = () => join(rand(), true);
$('code').oninput = e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); e.target.value = v; err(''); if (v.length === 4) join(v); };   // 4자리면 바로 입장
$('nick').addEventListener('keydown', e => { if (e.key === 'Enter' && $('code').value.length === 4) join($('code').value); });   // 초대 화면에서 Enter 로도 입장
$('scan').onclick = () => {   // 누른 그 순간 카메라 요청(아이폰은 늦으면 막힘) · 이름은 읽은 뒤에
  err(''); $('scanner').hidden = false;
  scanQR($('scanVideo'), r => { $('scanner').hidden = true; openInvite(r); }, msg => { $('scanner').hidden = true; err(tx(msg, 'Camera unavailable · scan the QR with your phone camera or enter the code')); });
};
$('scanClose').onclick = () => { closeScan(); $('scanner').hidden = true; };
// QR·링크로 들어옴: 이름이 있으면 바로 입장, 없으면 초대 화면(이름 + 입장하기만)
const invited = on => { document.body.classList.toggle('invited', on); if (!on) { history.replaceState(null, '', '/'); $('code').value = ''; err(''); } };
const tab = keep(() => sessionStorage), inRoom = { get: () => tab.get('susaum-in'), set: v => tab.set('susaum-in', v || null) };
function openInvite(r) {   // QR·링크: 이름을 확인·고칠 수 있게 초대 화면(이름은 지난번 것으로 채움)
  $('code').value = r; $('invCode').textContent = r; invited(true); history.replaceState(null, '', `/?r=${r}`);
  $('nick').value.trim() ? $('enterBtn').focus() : $('nick').focus();
}
const linked = (params.get('r') ?? '').replace(/\D/g, '').slice(0, 4);
if (linked.length === 4) inRoom.get() === linked && $('nick').value.trim() ? join(linked) : openInvite(linked);   // 방에 있던 탭의 새로고침이면 바로 다시 입장
$('enterBtn').onclick = () => join($('code').value);
$('notInvite').onclick = () => invited(false);

// ───────── 연결 · 끊기면 같은 방으로 다시
function connect(r, nick, isNew) {
  clearTimeout(retryT); here = { r, nick };
  const q = new URLSearchParams({ r, pid, nick, ...isNew && { new: 1, rounds: pick, lang } });
  const s = ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?${q}`);
  let opened = false;
  s.onopen = () => {
    opened = true; tries = 0; inRoom.set(r);
    history.replaceState(null, '', `/?r=${r}${force ? `&games=${force}` : ''}`);
    $('room').innerHTML = `${tx('방', 'Room')} <b>${r}</b>`; view('game'); keepAwake();
  };
  s.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } if (m.t === 'st') onState(m); };
  s.onclose = e => {
    if (ws !== s) return;
    if (refuse(e.code)) { ws = S = here = null; inRoom.set(null); view('home'); invited(false); err(refuse(e.code)); return; }
    if (e.code === 4008) return sleeping();
    if (!opened) {
      if (isNew && ++tries < 6) return connect(rand(), nick, true);   // 번호가 이미 쓰이는 중
      view('home'); err(tx('들어갈 수 없어요 · 코드를 확인해 주세요', 'Could not join · please check the code')); return;
    }
    $('rlabel').textContent = tx('다시 잇는 중…', 'Reconnecting…'); retryT = setTimeout(() => connect(r, nick, false), 1500);
  };
}
function sleeping() {   // 대기실·결과 10분 무활동으로 서버가 끊음 · 누르면 다시 연결
  $('rlabel').textContent = '';
  stage(`<div class="center"><p class="huge">😴</p><p class="big">${tx('한동안 조용해서 연결을 쉬고 있어요', 'It was quiet for a while,<br>so the connection is resting')}</p><button id="rejoin" type="button" class="btn big">${tx('다시 연결', 'Reconnect')}</button></div>`);
}
async function keepAwake() { try { await navigator.wakeLock?.request('screen'); } catch {} }
document.addEventListener('visibilitychange', () => {   // 폰 화면이 다시 켜지면: 끊겨 있으면 바로 다시 연결
  if (document.visibilityState !== 'visible' || !here) return;
  keepAwake();
  if (ws?.readyState !== 1 && ws?.readyState !== 0) connect(here.r, here.nick, false);
});

// ───────── 상태 → 화면
function onState(m) {
  const prev = S; S = window.__S = m; deadline = Date.now() + m.left;   // __S: 자동 시험용
  if (m.lang && m.lang !== lang) { lang = m.lang; applyLang(); $('room').innerHTML = `${tx('방', 'Room')} <b>${m.code}</b>`; }   // 방 언어를 따름
  const fresh = prev?.ph !== m.ph || prev?.qi !== m.qi || prev?.ri !== m.ri;
  const me = playerOf(m.me); if (me) document.documentElement.style.setProperty('--c', me.color);
  if (fresh) feedback(prev);
  render(fresh);
}
function feedback(prev) {
  const s = S, ok = s.kind === 'social' ? s.delta > 0 : s.mine === s.right;
  if (s.ph === 'q') { sfx.beep(true); buzz(40); }
  else if (s.ph === 'reveal' && s.kind !== 'rect') { ok ? sfx.fanfare() : sfx.wrong(); buzz(ok ? [40, 40, 40] : 200); }
  else if (s.ph === 'reveal') { s.delta > 0 ? sfx.fanfare() : sfx.wrong(); }
  else if (s.ph === 'final') { sfx.fanfare(); buzz(80); }
  else if (s.ph === 'rintro') buzz(60);
  else if (s.ph === 'lobby' && prev && prev.players.length < s.players.length) sfx.join();
}
function render(fresh) {
  const s = S;
  document.body.dataset.ph = s.ph;
  $('coins').textContent = s.coins;
  if (s.ph === 'rintro' && fresh) $('rlabel').innerHTML = `<b>${s.ri + 1}/${s.rounds}R</b> ❔`;   // 슬롯이 멈추기 전엔 게임 이름을 숨김
  else if (s.ph !== 'rintro') $('rlabel').innerHTML = s.gname ? `${roundTag(s)}${['bet', 'q', 'reveal'].includes(s.ph) ? ` <small>${tx('문제', 'Q')} ${s.qi + 1}/${s.per}</small>` : ''}` : '';
  drawPlayers();
  if (s.ph === 'lobby') renderLobby(fresh);
  else if (s.ph === 'rintro') { if (fresh) renderIntro(); }
  else if (s.ph === 'bet') renderBet(fresh);
  else if (s.kind === 'rect' && (s.ph === 'q' || s.ph === 'reveal')) renderRect(fresh);
  else if (s.ph === 'q' || s.ph === 'reveal') renderQuestion();
  else if (s.ph === 'stand' || s.ph === 'final') renderRanks();
}
const stage = html => { $('stage').innerHTML = html; };

function renderLobby(fresh) {
  const s = S, startLabel = tx(`▶ 시작 (${onCount()}명)`, `▶ Start (${onCount()})`);
  const st = $('stage');
  const myName = playerOf(s.me)?.nick ?? '';
  if (!fresh && st.querySelector('.lobby') && st.dataset.owner === String(s.owner) && st.dataset.name === myName && st.dataset.lang === lang) { if ($('startBtn')) $('startBtn').textContent = startLabel; return; }   // 사람만 늘면 버튼 글자만(방장이 바뀌면 새로 그림)
  st.dataset.owner = s.owner; st.dataset.name = myName; st.dataset.lang = lang;
  const qr = qrcode(0, 'M'); qr.addData(inviteUrl()); qr.make();
  stage(`<div class="lobby">
    <div class="invite"><div class="qr">${qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div>
      <div><p class="k">${tx('📱 QR 참가 · 🔢 코드 참가', '📱 Scan QR<br>🔢 or enter code')}</p><p class="bigcode">${s.code}</p><button id="share" type="button" class="btn">${tx('🔗 초대 링크', '🔗 Invite link')}</button></div></div>
    <p class="note">${tx('옆 사람에게 이 화면의 QR 이나 코드를 보여 주세요', 'Show this QR or code to the people around you')}</p>
    <p class="myname">${tx('내 이름', 'My name')} <b>${esc(playerOf(s.me)?.nick ?? '')}</b> <button id="rename" type="button" class="btn mini">${tx('✏️ 바꾸기', '✏️ Edit')}</button></p>
    <p class="rpick">${tx(`${s.pick}라운드`, `${s.pick} round${s.pick > 1 ? 's' : ''}`)} · ${roundTime(s.pick)}</p>
    <ol class="rules">${tx(`<li>게임 ${GAMES.length}종 중 라운드 수만큼 랜덤 · 라운드마다 3문제</li><li>코인 <b>10개</b>로 시작 · 빨리 맞히면 +3, 늦으면 +2, 틀리면 −1, 안 고르면 ±0</li><li>2라운드 이상이면 마지막은 <b>베팅 라운드</b> · 문제마다 코인을 걸고 맞히면 건 만큼 얻고, 틀리면 잃어요 · 직전 꼴찌는 <b>⚠ 위기</b>(절반 이상 걸기)</li>`,
      `<li>${GAMES.length} games, one picked at random for each round<br>3 questions per round</li><li>Start with <b>10 coins</b><br>Right and fast +3, right but slow +2, wrong −1, no answer ±0</li><li>With 2+ rounds, the last one is a <b>betting round</b><br>Bet coins on each question: win your bet if right, lose it if wrong<br>Whoever is last going in is <b>⚠ in danger</b> (must bet at least half)</li>`)}</ol>
    ${s.owner ? `<button id="startBtn" type="button" class="btn big">${startLabel}</button>` : `<p class="wait">${tx('방장이 시작하면 바로 시작해요', 'The game starts when the host presses Start')}</p>`}</div>`);
}
// 라운드 시작: 게임 이름이 슬롯처럼 돌다가 멈춤
function renderIntro() {
  const s = S, ri = s.ri;
  stage(`<div class="rintro">${ri === 0 ? `<p class="total">${tx(`이번 판은 총 <b>${s.rounds}라운드</b>!`, `This game has <b>${s.rounds} round${s.rounds > 1 ? 's' : ''}</b>!`)}</p>` : ''}<p class="k">${tx(`${ri + 1}라운드 / ${s.rounds}`, `Round ${ri + 1} / ${s.rounds}`)}${s.bet ? tx(' · 💰 베팅 라운드', ' · 💰 Betting round') : ''}</p>
    <div class="slot"><span id="slot">❔</span></div><h1 id="gname"></h1><p id="grule"></p>${s.bet ? `<p class="warn">${tx('문제 종류를 먼저 보고 → 코인을 걸고 → 풀어요<br>맞히면 건 만큼 얻고, 틀리거나 못 풀면 건 만큼 잃어요', 'See the question type → bet coins → solve<br>Right: win your bet<br>Wrong or no answer: lose it')}</p>` : ''}</div>`);
  let i = 0;
  const step = () => {
    if (S.ph !== 'rintro' || S.ri !== ri || !$('slot')) return;
    const x = ++i < 16 ? gameText(GAMES[i % GAMES.length], lang) : { icon: s.icon, name: s.gname };
    $('slot').textContent = x.icon; $('gname').textContent = x.name;
    if (i < 16) { sfx.tick(); setTimeout(step, 50 + i * 9); return; }
    $('grule').textContent = s.rule; $('slot').parentElement.classList.add('done'); sfx.fanfare();
    $('rlabel').innerHTML = roundTag(s);
  };
  step();
}
function renderBet(fresh) {
  const s = S, st = $('stage');
  if (!fresh && st.dataset.lock === String(s.lock)) return;   // 남이 확정한 것만 바뀌면 슬라이더를 다시 그리지 않음
  st.dataset.lock = s.lock;
  if (fresh) betVal = s.myBet;
  betVal = clamp(betVal, s.min, s.max);
  stage(s.lock ? `<div class="center"><p class="huge">🔒</p><p class="big">${tx(`${s.myBet}코인 걸었어요`, `You bet ${s.myBet} coins`)}</p><p class="note">${tx(`맞히면 ${s.coins + s.myBet}코인 · 틀리면 ${s.coins - s.myBet}코인 · 다른 사람을 기다리는 중…`, `Right: ${s.coins + s.myBet} coins · wrong: ${s.coins - s.myBet} coins<br>Waiting for others…`)}</p></div>`
    : `<div class="center betv"><h2>${tx('💰 몇 코인 걸까요?', '💰 How many coins will you bet?')}</h2><p>${tx('다음 문제는', 'Next question:')} <b>${s.tag}</b></p>${s.crisis ? `<p class="warn">${tx(`⚠ 위기! 꼴찌라서 최소 ${s.min}코인(절반)은 걸어야 해요`, `⚠ Danger! You're last, so you must bet at least ${s.min} coins (half)`)}</p>` : ''}
      <p class="betn"><b id="bv">${betVal}</b> ${tx('코인', 'coins')}</p><p id="bout" class="note">${betOut(betVal)}</p>
      <input id="br" type="range" min="${s.min}" max="${s.max}" value="${betVal}" ${s.max === s.min ? 'disabled' : ''}>
      <div class="row"><button type="button" class="btn" data-b="min">${tx('최소', 'Min')}</button><button type="button" class="btn" data-b="half">${tx('절반', 'Half')}</button><button type="button" class="btn" data-b="all">${tx('올인', 'All in')}</button></div>
      <button id="lock" type="button" class="btn big">${tx('확정', 'Lock in')}</button><p class="note">${tx('시간 안에 확정 안 하면 지금 값으로 걸려요 · 답을 못 내면 틀린 걸로 쳐요', 'If time runs out, the current amount is bet<br>No answer counts as wrong')}</p></div>`);
}
const betOut = n => tx(`맞히면 <b>${S.coins + n}</b>코인 · 틀리면 <b>${S.coins - n}</b>코인`, `Right: <b>${S.coins + n}</b> coins · wrong: <b>${S.coins - n}</b> coins`);   // 걸고 난 뒤 내 코인
function renderQuestion() {
  const s = S, rv = s.ph === 'reveal';
  if (s.input === 'num' && !rv && s.mine == null && $('nr')) return;   // 숫자 고르는 중엔 다시 그리지 않음(슬라이더 끊김 방지)
  const ok = s.kind === 'social' ? s.delta > 0 : s.mine === s.right;
  stage(`<div class="qv k-${s.kind}" style="--el:${s.dur - s.left}ms">${rv ? `<p class="res ${ok ? 'good' : 'bad'}">${resultText(s, ok)} <b>${fmt(s.delta ?? 0)}</b></p>` : ''}
    <h2 class="qt">${s.title}</h2><div class="qbody">${s.body}</div>
    ${s.input === 'num' ? numberInput(s, rv) : options(s, rv)}
    <p class="note">${questionNote(s, rv)}</p></div>`);
}
const resultText = (s, ok) => s.mine == null ? tx('⏰ 시간 초과', '⏰ Time\'s up')
  : s.kind === 'social' ? (s.delta > 0 ? tx('🎉 성공!', '🎉 Nice!') : s.delta < 0 ? tx('😵 아쉬워요', '😵 Too bad') : tx('😐 본전', '😐 Even'))
  : ok ? tx('⭕ 정답!', '⭕ Correct!') : tx('❌ 오답', '❌ Wrong');
function questionNote(s, rv) {
  if (rv) return s.why ? `💡 ${s.why}` : '';
  const a = s.input === 'num' ? s.mine : L[s.mine], b = s.myBet;
  if (s.mine != null) return tx(`제출 완료 · ${a} · 다른 사람을 기다리는 중`, `Submitted · ${a}<br>Waiting for others…`);
  if (b != null) return tx(`💰 ${b}코인 걸었어요 · 맞히면 +${b}, 틀리면 −${b}`, `💰 You bet ${b} coins · right +${b}, wrong −${b}`);
  return s.kind === 'social' ? tx('정답은 없어요 · 남들 마음을 읽으세요', 'No right answer<br>Read everyone\'s mind') : tx('앞 절반 안에 맞히면 +3 · 틀리면 −1 · 안 고르면 ±0', 'Right in the first half +3 · wrong −1 · no answer ±0');
}
function numberInput(s, rv) {   // 평균의 ⅔: 0~100 고르기 · 낸 뒤엔 내 수(공개 땐 목표도)
  if (rv || s.mine != null) return `<p class="betn"><b>${s.mine ?? '—'}</b>${rv && s.goal != null ? ` <small>${tx('목표', 'goal')} ${s.goal}</small>` : ''}</p>`;
  return `<div class="center betv"><p class="betn"><b id="nv">${numVal}</b></p><input id="nr" type="range" min="0" max="100" value="${numVal}"><button id="numgo" type="button" class="btn big">${tx('내기', 'Submit')}</button></div>`;
}
function options(s, rv) {
  const picks = i => {   // 공개 때 보기마다 누가 골랐나 · 많으면 인원수
    const ids = s.picks[i];
    return `<span class="pk">${ids.length > 6 ? `<i>${tx(`${ids.length}명`, `${ids.length} people`)}${s.mine === i ? tx(' · 나 포함', ' · incl. me') : ''}</i>` : ids.map(playerOf).filter(Boolean).map(p => `<i style="--c:${p.color}">${esc(p.nick)}</i>`).join('')}</span>`;
  };
  return `<div class="opts">${s.opts.map((o, i) => `<button type="button" data-i="${i}" class="${rv ? (i === s.right ? 'ok' : 'no') : ''} ${s.mine === i ? 'on' : ''}" ${rv || s.mine != null ? 'disabled' : ''}><b>${L[i]}</b><span class="o">${o}</span>${rv ? picks(i) : ''}</button>`).join('')}</div>`;
}
function renderRanks() {
  const s = S, fin = s.ph === 'final', me = s.ranks.find(r => isMe(r.pid));
  const shown = s.ranks.filter((r, i) => i < 10 || isMe(r.pid) || fin && r.last);   // 상위 10명 + 나(+ 꼴찌)
  const row = r => { const p = playerOf(r.pid); return p ? `<li style="--c:${p.color}" class="${r.rank === 1 ? 'top' : ''} ${isMe(r.pid) ? 'me' : ''}"><b>${fin && r.rank === 1 ? '👑' : tx(`${r.rank}위`, `#${r.rank}`)}</b><span class="nk">${esc(p.nick)}</span>${p.crisis && !fin ? `<em class="warn">${tx('⚠ 위기', '⚠ Danger')}</em>` : ''}${fin && r.last ? `<em class="warn">${s.penalty}</em>` : ''}<span class="sc">${p.coins}<small>${tx('코인', ' coins')}</small></span></li>` : ''; };
  stage(`<div class="stand"><h2>${fin ? tx('🏆 최종 결과', '🏆 Final Results') : tx(`${s.ri + 1}라운드 끝 · 순위`, `Round ${s.ri + 1} standings`)}</h2>
    ${fin && me ? `<p class="mine">${me.rank === 1 ? tx('👑 우승!', '👑 You win!') : me.last ? s.penalty : tx(`${s.ranks.length}명 중 ${me.rank}위`, `#${me.rank} of ${s.ranks.length}`)}</p>` : ''}
    <ol>${shown.map(row).join('')}</ol>
    ${!fin && s.ri === s.rounds - 2 && s.players.some(p => p.crisis) ? `<p class="warn">${tx('⚠ 위기인 사람은 마지막 베팅 라운드에서 코인 절반 이상을 걸어야 해요', '⚠ Players in danger must bet at least half their coins in the last betting round')}</p>` : ''}
    ${!fin ? '' : s.owner ? `<div class="row"><button id="toLobby" type="button" class="btn">${tx('대기실로', 'Lobby')}</button><button id="again" type="button" class="btn big">${tx('🔁 한 판 더', '🔁 Play again')}</button></div>` : `<p class="wait">${tx('방장이 한 판 더를 누르면 다시 시작해요', 'A new game starts when the host presses Play again')}</p>`}</div>`);
}
function drawPlayers() {
  const s = S, l = s.players.filter(p => p.on || s.ph !== 'lobby');
  $('plist').classList.toggle('many', s.players.length > 12);   // 많으면 한 줄로 넘겨 보기
  $('plist').innerHTML = l.map(p => `<li style="--c:${p.color}" class="${p.done ? 'done' : ''} ${p.on ? '' : 'off'} ${p.crisis ? 'crisis' : ''} ${isMe(p.pid) ? 'me' : ''}"><span class="nk">${esc(p.nick)}</span>`
    + `${p.found != null && s.ph === 'q' ? `<em>🔲${p.found}</em>` : ''}${p.delta != null ? `<em class="${p.delta > 0 ? 'up' : p.delta < 0 ? 'down' : ''}">${fmt(p.delta)}</em>` : ''}</li>`).join('');
}

// ───────── 네모 찾기: 드래그로 직사각형 선택 · 합이 맞으면 서버에 보냄 · 찾은 네모는 테두리로 남김
const RC = ['#ff6b81', '#4dabf7', '#51cf66', '#ffa94d', '#b197fc', '#22d3ee', '#f783ac', '#ffd43b'];
const rectStyle = ([r0, c0, r1, c1]) => { const R = S.grid.length, C = S.grid[0].length; return `left:${c0 / C * 100}%;top:${r0 / R * 100}%;width:${(c1 - c0 + 1) / C * 100}%;height:${(r1 - r0 + 1) / R * 100}%`; };
function renderRect(fresh) {
  const s = S, rv = s.ph === 'reveal';
  if (fresh || !$('rgrid')) {   // 판은 처음 한 번만 그림(남이 찾을 때마다 다시 그리면 긋던 게 끊김)
    stage(`<div class="qv k-rect">${rv ? '<p class="res" id="rres"></p>' : ''}<h2 class="qt">${s.title}</h2>
      <div id="rgrid" class="rgrid" style="--R:${s.grid.length};--C:${s.grid[0].length}">${s.labels.flatMap((row, r) => row.map((v, c) => `<i data-r="${r}" data-c="${c}" class="${v.length > 2 ? 'long' : ''} ${v.startsWith('−') ? 'neg' : ''}">${v}</i>`)).join('')}<div id="rbox" class="rbox" hidden></div><div id="rfound"></div></div>
      <p class="note" id="rnote"></p></div>`);
    if (!rv) bindRect();
  }
  $('rfound').innerHTML = s.found.map((f, i) => `<b class="rf" style="${rectStyle(f)};--k:${RC[i % RC.length]}"></b>`).join('');
  $('rnote').textContent = rv ? '' : tx(`찾은 네모 ${s.found.length}개 · 손가락이나 마우스로 그어 보세요`, `Found ${s.found.length} · drag with your finger or mouse`);
  if (rv) { const n = s.found.length; $('rres').className = `res ${n ? 'good' : 'bad'}`; $('rres').innerHTML = `🔲 ${tx(`${n}개 찾음 · 전체 ${s.total}개`, `Found ${n} of ${s.total}`)}${n === s.total ? tx(' · 🎉 전부!', ' · 🎉 All of them!') : ''} <b>${fmt(s.delta ?? 0)}</b>`; }
}
function bindRect() {
  const g = $('rgrid'), box = $('rbox');
  const cell = e => { const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('#rgrid i'); return el ? [+el.dataset.r, +el.dataset.c] : null; };
  const sel = () => [Math.min(drag.a[0], drag.b[0]), Math.min(drag.a[1], drag.b[1]), Math.max(drag.a[0], drag.b[0]), Math.max(drag.a[1], drag.b[1])];
  const show = () => { const r = sel(); box.hidden = false; box.className = 'rbox'; box.style.cssText = rectStyle(r); box.textContent = fmt12(rectSum(S.grid, ...r)); };
  g.addEventListener('pointerdown', e => { const c = cell(e); if (!c || S.ph !== 'q') return; e.preventDefault(); g.setPointerCapture(e.pointerId); drag = { a: c, b: c, id: e.pointerId }; show(); });
  g.addEventListener('pointermove', e => { if (drag?.id !== e.pointerId) return; const c = cell(e); if (c && c.join() !== drag.b.join()) { drag.b = c; show(); } });
  g.addEventListener('pointerup', e => {
    if (drag?.id !== e.pointerId) return;
    const r = sel(), sum = rectSum(S.grid, ...r), dup = S.found.some(f => f.join() === r.join()); drag = null;
    if (sum === S.target && !dup) { send({ t: 'rect', a: r }); box.className = 'rbox ok'; sfx.tick(); buzz(30); }
    else { box.className = 'rbox bad'; box.textContent = dup ? tx('이미 찾음', 'Already found') : fmt12(sum); buzz(120); }
    setTimeout(() => { if (!drag) box.hidden = true; }, 500);
  });
  g.addEventListener('pointercancel', e => { if (drag?.id === e.pointerId) { drag = null; box.hidden = true; } });
}

// 남은 시간 막대
(function loop() {
  const timed = S && (S.ph === 'q' || S.ph === 'bet');
  document.body.classList.toggle('timed', !!timed);
  if (timed) { const left = Math.max(0, deadline - Date.now()); $('tbar').style.width = `${left / S.dur * 100}%`; $('tsec').textContent = Math.ceil(left / 1000); $('timer').classList.toggle('hot', left < 3000); }
  requestAnimationFrame(loop);
})();

// ───────── 조작
function showBet(v) { betVal = v; $('bv').textContent = v; $('bout').innerHTML = betOut(v); }
function setBet(v) { showBet(clamp(v, S.min, S.max)); $('br').value = betVal; send({ t: 'bet', n: betVal }); }
function submit(a) { S.mine = a; send({ t: 'ans', a }); sfx.tick(); buzz(15); $('nr')?.remove(); renderQuestion(); }
$('leave').onclick = () => {   // 방 나가기 → 첫 화면(게임 중엔 한 번 묻기)
  if (S && !['lobby', 'final'].includes(S.ph) && !confirm(tx('게임 중이에요. 정말 나갈까요?', 'A game is in progress. Leave anyway?'))) return;
  send({ t: 'leave' }); inRoom.set(null); const s = ws; ws = S = here = null; clearTimeout(retryT); s?.close();
  view('home'); invited(false);
};
const BUTTONS = {
  numgo: () => S.ph === 'q' && S.mine == null && submit(numVal),
  rejoin: () => connect(here.r, here.nick, false),
  lock: () => { send({ t: 'bet', n: betVal, lock: true }); buzz(20); },
  startBtn: () => send({ t: 'start', games: force }),
  again: () => send({ t: 'start', games: force }),
  toLobby: () => send({ t: 'lobby' }),
  share: () => share(),
  rename: () => rename(),
};
$('stage').addEventListener('click', e => {
  unlock();
  const o = e.target.closest('[data-i]'), k = e.target.closest('[data-b]'), id = e.target.closest('button')?.id;
  if (o && S.ph === 'q' && S.mine == null) submit(+o.dataset.i);
  else if (k) setBet({ min: S.min, half: Math.ceil(S.max / 2), all: S.max }[k.dataset.b]);
  else if (Object.hasOwn(BUTTONS, id)) BUTTONS[id]();
});
$('stage').addEventListener('input', e => {
  if (e.target.id === 'nr') { numVal = +e.target.value; $('nv').textContent = numVal; }
  else if (e.target.id === 'br') showBet(+e.target.value);
});
$('stage').addEventListener('change', e => { if (e.target.id === 'br') setBet(+e.target.value); });
function rename() {   // 방 안에서 이름 바꾸기 · 다음에 들어올 때도 이 이름
  const now = playerOf(S.me)?.nick ?? '', n = prompt(tx('바꿀 이름 (10자까지)', 'New name (up to 10 characters)'), now)?.trim().slice(0, 10);
  if (!n || n === now) return;
  store.set('susaum-nick', n); $('nick').value = n; if (here) here.nick = n;
  send({ t: 'rename', nick: n });
}
$('plist').addEventListener('click', e => { if (e.target.closest('li.me')) rename(); });   // 내 이름표를 눌러도
async function share() {
  const url = inviteUrl();
  try {
    if (navigator.share) await navigator.share({ title: 'Lucky Lucky', text: tx(`럭키럭키 방 코드 ${S.code}`, `Lucky Lucky room code ${S.code}`), url });
    else { await navigator.clipboard.writeText(url); $('share').textContent = tx('✅ 복사했어요', '✅ Copied'); }
  } catch {}
}
