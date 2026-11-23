// Lucky Lucky 서버: 방 번호(4자리)마다 Durable Object 하나가 게임을 진행 · 모니터 없이 참가자 모두 같은 화면(각자 기기)
import { DurableObject } from 'cloudflare:workers';
import { GAMES, pickGames, rectSum, setLang, gameText } from '../public/js/puzzles.js';

const MAX = 50, START = 10, PER = 3, GRACE = 20000, BET_TIME = 10, T = { intro: 5, reveal: 5, stand: 6 };
const IDLE = 10 * 60000, KEEP = 24 * 3600000;   // 대기실·결과에서 10분 조용하면 연결 끊기 · 빈 방 기록은 하루 뒤 지움
const COLORS = ['#ff6b81', '#4dabf7', '#51cf66', '#ffa94d', '#b197fc', '#22d3ee', '#f783ac', '#ffd43b', '#748ffc', '#ff8787', '#20c997', '#e599f7'];
const PENALTY = { ko: '☕ 오늘 커피 당번', en: '🍩 Bring donuts next time!' };
const QUIET = new Set(['lobby', 'final']);   // 타이머 없이 기다리는 단계(잠들 수 있음)
const isRoomCode = r => /^\d{4}$/.test(r);
const upgrade = client => new Response(null, { status: 101, webSocket: client });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      const r = url.searchParams.get('r') ?? '';
      if (!isRoomCode(r) || req.headers.get('Upgrade') !== 'websocket') return new Response('bad room', { status: 400 });
      return env.ROOM.get(env.ROOM.idFromName(r)).fetch(req);
    }
    if (url.pathname === '/') return invitePreview(await env.ASSETS.fetch(req), url);
    return env.ASSETS.fetch(req);
  },
};

// 방 초대 링크(/?r=1234)를 카톡·슬랙에 붙이면 미리보기 제목에 방 번호가 보이게
function invitePreview(res, url) {
  const r = url.searchParams.get('r') ?? '';
  if (!isRoomCode(r) || !res.headers.get('content-type')?.includes('text/html')) return res;
  const [title, desc] = url.searchParams.get('lang') === 'en'
    ? [`🍀 Lucky Lucky · You're invited to room ${r}`, 'Tap the link and enter your name to join · 5-minute lunchtime brain survival']
    : [`🍀 Lucky Lucky · 방 ${r}에 초대받았어요`, '링크를 누르고 이름만 적으면 바로 입장해요 · 점심 5분 두뇌 서바이벌'];
  const set = v => ({ element: e => e.setAttribute('content', v) });
  return new HTMLRewriter()
    .on('meta[property="og:title"]', set(title)).on('meta[name="twitter:title"]', set(title))
    .on('meta[property="og:description"]', set(desc)).on('meta[name="twitter:description"]', set(desc))
    .transform(res);
}

export class Room extends DurableObject {
  players = new Map();   // pid → { pid, nick, color, coins, delta, leftAt, ws }
  owner = null; code = ''; lang = 'ko';   // 방 언어: 방 만든 사람 화면 언어 · 문제·결과 글이 이 언어로
  recent = [];           // 지난 판 게임(다음 판엔 덜 뽑힘)
  last = Date.now();     // 마지막 활동 시각
  early = null;          // 모두 답하면 기다림을 일찍 끝내는 함수
  G = { ph: 'lobby', pick: 3, rounds: 3, games: [], ri: 0, qi: 0, q: null, end: 0, dur: 1, t0: 0, ans: new Map(), bets: new Map(), found: new Map(), crisis: new Set(), run: 0 };

  // ───────── 저장·복원: 잠들면 메모리가 비므로 대기실·결과 상태를 저장해 두고 깨면 되살림
  constructor(ctx, env) {
    super(ctx, env);
    const s = ctx.storage.kv.get('s');
    if (s) {
      for (const p of s.players) this.players.set(p.pid, { ...p, ws: null });
      Object.assign(this, { owner: s.owner, code: s.code, recent: s.recent, last: s.last, lang: s.lang ?? 'ko' });
      Object.assign(this.G, { ph: s.ph, pick: s.pick, rounds: s.rounds });
    }
    for (const ws of ctx.getWebSockets()) {
      const p = this.players.get(ws.deserializeAttachment()?.pid);
      if (p) p.ws = ws; else ws.close(1011, 'lost');
    }
  }
  save() {   // 게임 중엔 타이머 때문에 잠들지 않으므로 저장하지 않음
    const G = this.G;
    if (!QUIET.has(G.ph)) return;
    const players = this.all().map(({ ws, ...p }) => p);
    this.ctx.storage.kv.put('s', { players, owner: this.owner, code: this.code, recent: this.recent, last: this.last, lang: this.lang, ph: G.ph, pick: G.pick, rounds: G.rounds });
  }

  // ───────── 연결
  async fetch(req) {
    const q = new URL(req.url).searchParams;
    const pid = (q.get('pid') ?? '').slice(0, 16), nick = (q.get('nick') ?? '').trim().slice(0, 10) || (q.get('lang') === 'en' ? 'Guest' : '손님'), isNew = q.get('new') === '1';
    if (!/^[\w-]{4,16}$/.test(pid)) return new Response('bad pid', { status: 400 });
    if (isNew && this.players.size) return new Response('room taken', { status: 409 });   // 이미 쓰이는 번호면 화면이 다른 번호로 다시 시도

    const [client, ws] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(ws);
    const refuse = (code, why) => { ws.close(code, why); return upgrade(client); };   // 화면은 닫힘 코드로 안내
    if (!isNew && !this.players.size) return refuse(4004, 'noroom');
    if (!this.players.get(pid)?.ws && this.online().length >= MAX) return refuse(4029, 'full');

    if (isNew) { const v = +q.get('rounds'); this.G.pick = [1, 2, 3].includes(v) ? v : 3; this.lang = q.get('lang') === 'en' ? 'en' : 'ko'; }
    this.code = q.get('r'); this.last = Date.now();
    if (!await this.ctx.storage.getAlarm()) this.ctx.storage.setAlarm(this.last + IDLE);

    const id = this.freeId(pid), p = this.players.get(id) ?? this.adopt(id, nick) ?? this.newPlayer(id);
    Object.assign(p, { nick, ws, leftAt: 0 });
    ws.serializeAttachment({ pid: id });
    if (!this.players.has(this.owner)) this.owner = id;
    this.sweep(); this.syncAll();   // 쉬다 끊긴(4008) 사람들은 대기실이면 정리
    return upgrade(client);
  }
  freeId(pid) {   // 같은 기기의 다른 탭(아직 접속 중)은 다른 사람
    let id = pid;
    for (let k = 2; this.players.get(id)?.ws; k++) id = `${pid}~${k}`;
    return id;
  }
  newPlayer(pid) {
    const used = new Set(this.all().map(x => x.color));
    const p = { pid, coins: START, delta: null, color: COLORS.find(c => !used.has(c)) ?? `hsl(${(this.players.size * 137) % 360} 75% 65%)` };
    this.players.set(pid, p);
    return p;
  }
  adopt(pid, nick) {   // 탭이 닫혀 기기 ID 가 바뀌어도, 끊긴 사람과 같은 이름이면 그 자리로 복귀
    const p = this.all().find(x => !x.ws && x.nick === nick);
    if (!p) return null;
    const G = this.G, old = p.pid;
    this.players.delete(old); p.pid = pid; this.players.set(pid, p);
    for (const m of [G.ans, G.bets, G.found]) if (m.has(old)) { m.set(pid, m.get(old)); m.delete(old); }
    if (G.crisis.delete(old)) G.crisis.add(pid);
    if (this.owner === old) this.owner = pid;
    return p;
  }

  byWs(ws) { const p = this.players.get(ws.deserializeAttachment()?.pid); return p?.ws === ws ? p : null; }
  webSocketMessage(ws, raw) { const p = this.byWs(ws); if (p) this.onMsg(p, raw); }
  webSocketClose(ws) { const p = this.byWs(ws); if (p) this.gone(p, ws); }
  webSocketError(ws) { const p = this.byWs(ws); if (p) this.gone(p, ws); }

  // 끊김: GRACE 동안 자리 유지(코인·방장 그대로) · 그 뒤 대기실이면 빼고 방장은 넘김 · 모두 없으면 방 초기화
  gone(p, ws) {
    if (p.ws !== ws) return;
    p.ws = null; p.leftAt = Date.now();
    setTimeout(() => this.sweep(), GRACE + 100);
    this.syncAll(); this.early?.();
  }
  sweep() {
    const G = this.G, old = p => !p.ws && Date.now() - p.leftAt >= GRACE;
    if (!this.all().some(old)) return;
    if (!this.online().length) { G.run++; this.players.clear(); this.owner = null; G.ph = 'lobby'; this.save(); return; }
    if (G.ph === 'lobby') for (const p of this.all()) if (old(p)) this.players.delete(p.pid);
    if (!this.players.get(this.owner)?.ws) this.owner = this.online()[0].pid;
    this.syncAll();
  }
  async alarm() {   // 대기실·결과에서 10분 조용하면 끊고(4008), 아무도 없으면 하루 뒤 기록 삭제
    const now = Date.now();
    if (QUIET.has(this.G.ph) && this.online().length && now - this.last >= IDLE) {
      for (const p of this.online()) { p.ws.close(4008, 'idle'); p.ws = null; p.leftAt = now; }
      this.save();
    }
    if (!this.online().length && (!this.players.size || now - this.last >= KEEP)) return this.ctx.storage.deleteAll();
    this.ctx.storage.setAlarm(this.online().length ? Math.max(this.last + IDLE, now + 60000) : this.last + KEEP);
  }

  all = () => [...this.players.values()];
  online = () => this.all().filter(p => p.ws);
  isBet = () => this.G.rounds >= 2 && this.G.ri === this.G.rounds - 1 && !this.G.games[this.G.ri]?.nobet;   // 2라운드 이상이면 마지막이 베팅(네모 찾기·심리전 제외)
  minBet = p => this.G.crisis.has(p.pid) ? Math.ceil(p.coins / 2) : 0;

  // ───────── 메시지
  onMsg(p, raw) {
    if (typeof raw !== 'string' || raw.length > 500) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    this.last = Date.now();
    if (Object.hasOwn(this.on, m.t)) this.on[m.t](p, m);
  }
  on = {
    leave: p => { const ws = p.ws; p.ws = null; p.leftAt = Date.now() - GRACE; ws?.close(1000); this.sweep(); },   // 기다리지 않고 바로 뺌
    rename: (p, m) => { const n = String(m.nick ?? '').trim().slice(0, 10); if (n) { p.nick = n; this.syncAll(); } },
    start: (p, m) => { if (p.pid === this.owner && QUIET.has(this.G.ph)) this.startGame(m.games); },
    lobby: p => { if (p.pid === this.owner && this.G.ph === 'final') { this.G.ph = 'lobby'; this.syncAll(); } },
    ans: (p, m) => {
      const G = this.G;
      const valid = G.q?.input === 'num' ? Number.isInteger(m.a) && m.a >= 0 && m.a <= 100 : [0, 1, 2, 3].includes(m.a);
      if (G.ph !== 'q' || G.ans.has(p.pid) || !valid) return;
      G.ans.set(p.pid, { a: m.a, t: Date.now() }); this.answered();
    },
    rect: (p, m) => {   // 네모 찾기: 합이 맞으면 내 목록에
      const G = this.G;
      if (G.ph !== 'q' || G.q.kind !== 'rect' || !Array.isArray(m.a)) return;
      const [r0, c0, r1, c1] = m.a.map(Number), R = G.q.grid.length, C = G.q.grid[0].length;
      if (![r0, r1].every(v => v >= 0 && v < R) || ![c0, c1].every(v => v >= 0 && v < C) || r0 > r1 || c0 > c1) return;
      const mine = G.found.get(p.pid) ?? new Set(), key = `${r0},${c0},${r1},${c1}`;
      if (rectSum(G.q.grid, r0, c0, r1, c1) !== G.q.target || mine.has(key)) return;
      mine.add(key); G.found.set(p.pid, mine); this.answered();
    },
    bet: (p, m) => {
      const G = this.G, n = Math.round(+m.n);
      if (G.ph !== 'bet' || G.bets.get(p.pid)?.lock || !Number.isFinite(n)) return;
      G.bets.set(p.pid, { n: Math.min(p.coins, Math.max(this.minBet(p), n)), lock: !!m.lock });
      if (m.lock) this.answered();
    },
  };
  answered() { this.syncSoon(); this.early?.(); }

  // ───────── 진행: 단계마다 기다림 · 모두 답하면 일찍 넘어감
  wait(sec, allDone) {
    const G = this.G, run = G.run;
    G.dur = sec * 1000; G.end = Date.now() + G.dur; this.syncAll();
    return new Promise((ok, no) => {
      const done = () => { clearTimeout(to); this.early = null; run === G.run ? ok() : no(new Error('stop')); };
      const to = setTimeout(done, sec * 1000);
      this.early = allDone && (() => {
        if (!this.online().length || !allDone()) return;
        this.early = null; clearTimeout(to);
        G.end = Date.now() + 700; this.syncAll(); setTimeout(done, 700);
      });
    });
  }
  setPhase(ph) { this.G.ph = ph; this.syncAll(); }
  async startGame(force) {
    const G = this.G;
    for (const [pid, p] of this.players) if (!p.ws) this.players.delete(pid); else Object.assign(p, { coins: START, delta: null });
    const fixed = Array.isArray(force) ? force.map(id => GAMES.find(g => g.id === id)).filter(Boolean) : [];   // 시험용 ?games=
    G.rounds = fixed.length || G.pick;
    G.games = fixed.length ? fixed : pickGames(G.rounds, this.recent);
    this.recent = G.games.map(g => g.id);
    G.crisis.clear(); G.run++;
    try {
      for (G.ri = 0; G.ri < G.rounds; G.ri++) await this.playRound(G.games[G.ri]);
      this.setPhase('final');
    } catch (e) { if (e.message !== 'stop') throw e; }
  }
  async playRound(g) {
    const G = this.G, per = g.per ?? PER;
    setLang(this.lang);
    const qs = Array.from({ length: per }, (_, lv) => g.make(lv));
    G.qi = 0; G.q = null;
    this.setPhase('rintro'); await this.wait(T.intro);
    for (G.qi = 0; G.qi < per; G.qi++) {
      G.q = qs[G.qi]; G.ans.clear(); G.bets.clear(); G.found.clear();
      for (const p of this.players.values()) p.delta = null;
      if (this.isBet()) {
        for (const p of this.online()) G.bets.set(p.pid, { n: this.minBet(p), lock: false });
        this.setPhase('bet'); await this.wait(BET_TIME, () => this.online().every(p => G.bets.get(p.pid)?.lock));
      }
      G.t0 = Date.now();
      this.setPhase('q'); await this.wait(g.time, () => this.online().every(p => G.ans.has(p.pid) || G.found.get(p.pid)?.size === G.q.total));
      this.score(g);
      this.setPhase('reveal'); await this.wait(T.reveal);
    }
    if (G.ri === G.rounds - 2) this.markCrisis();
    this.setPhase('stand'); await this.wait(T.stand);
  }

  // ───────── 점수
  score(g) {
    if (this.G.q.kind === 'social') this.settle(this.G.q);
    for (const p of this.players.values()) {
      const d = Math.max(this.gain(p, g), -p.coins);
      p.coins += d; p.delta = d;
    }
  }
  gain(p, g) {
    const G = this.G, a = G.ans.get(p.pid), ok = a?.a === G.q.ans;
    if (G.q.kind === 'social') return G.q.gains.get(p.pid) ?? 0;
    if (G.q.kind === 'rect') { const n = G.found.get(p.pid)?.size ?? 0; return n + (n === G.q.total ? 3 : 0); }   // 하나에 +1, 다 찾으면 +3
    if (this.isBet()) { const b = G.bets.get(p.pid)?.n ?? 0; return ok ? b : -b; }
    if (!a) return 0;
    return ok ? (a.t - G.t0 < g.time * 500 ? 3 : 2) : -1;   // 앞 절반 안에 맞히면 +3, 늦으면 +2, 틀리면 −1
  }
  settle(q) {   // 심리전: 고른 분포로 점수 · 공개 때 보일 결과(ans·why)도 여기서 정함
    const tr = (ko, en) => this.lang === 'en' ? en : ko;
    const picks = [...this.G.ans].map(([pid, a]) => [pid, a.a]), cnt = [0, 1, 2, 3].map(i => picks.filter(([, v]) => v === i).length);
    q.gains = new Map();
    if (q.mode === 'minor') for (const p of this.online()) if (!this.G.ans.has(p.pid)) q.gains.set(p.pid, -3);   // 소수파: 안 고르면 −3
    if (!picks.length) return;
    if (q.mode === 'third') {
      const avg = picks.reduce((t, [, v]) => t + v, 0) / picks.length, goal = Math.round(avg * 2 / 3), best = Math.min(...picks.map(([, v]) => Math.abs(v - goal)));
      for (const [pid, v] of picks) if (Math.abs(v - goal) === best) q.gains.set(pid, 3);
      const near = picks.find(([, v]) => Math.abs(v - goal) === best)[1], mean = Math.round(avg * 10) / 10;
      q.goal = goal; q.why = tr(`평균 ${mean} × ⅔ = ${goal} · 가장 가까운 수는 ${near}`, `Average ${mean} × ⅔ = ${goal} · closest pick: ${near}`);
    } else if (q.mode === 'share') {
      for (const [pid, v] of picks) q.gains.set(pid, Math.floor(q.vals[v] / cnt[v]));
      const each = q.vals.map((v, i) => cnt[i] ? Math.floor(v / cnt[i]) : -1);
      q.ans = each.indexOf(Math.max(...each)); q.why = q.vals.map((v, i) => tr(`${v}코인 ${cnt[i]}명`, `🎁${v}: ${cnt[i]} picked`)).join(' · ');
    } else {
      const used = cnt.filter(Boolean), lo = Math.min(...used), hi = Math.max(...used);
      if (lo === hi) {   // 고른 쪽 인원이 모두 같으면 다 소수파(+3) · 단, 여럿이 한쪽에만 몰리면 모두 −1
        if (used.length === 1 && lo > 1) { for (const [pid] of picks) q.gains.set(pid, -1); q.why = tr('모두 한쪽에 몰려 소수파 없음 · 가장 많은 쪽 −1', 'Everyone picked the same one · no minority, most picks −1'); return; }
        for (const [pid] of picks) q.gains.set(pid, 3);
        q.ans = cnt.indexOf(lo); q.why = picks.length === 1 ? tr('혼자 골라서 소수파 +3', 'Only one picker · minority +3') : tr(`고른 쪽이 모두 ${lo}명씩이라 모두 소수파 +3`, `Every pick had ${lo} each · all minority +3`); return;
      }
      for (const [pid, v] of picks) q.gains.set(pid, cnt[v] === lo ? 3 : cnt[v] === hi ? -1 : 0);
      q.ans = cnt.indexOf(lo); q.why = tr(`가장 적은 쪽 ${lo}명 +3 · 가장 많은 쪽 ${hi}명 −1`, `Fewest (${lo}) +3 · most (${hi}) −1`);
    }
  }
  markCrisis() {   // 베팅 직전 꼴찌 ⚠ 위기(모두 같으면 없음)
    const l = this.online(); this.G.crisis.clear();
    if (l.length < 2) return;
    const lo = Math.min(...l.map(p => p.coins));
    if (l.some(p => p.coins > lo)) for (const p of l) if (p.coins === lo) this.G.crisis.add(p.pid);
  }
  ranks() {
    const l = this.all().sort((a, b) => b.coins - a.coins);
    return l.map(p => ({ pid: p.pid, rank: l.findIndex(x => x.coins === p.coins) + 1, last: l.length > 1 && p.coins === l.at(-1).coins && p.coins < l[0].coins }));
  }

  // ───────── 화면 상태: 모두에게 같은 부분은 한 번만 만들고, 개인 부분만 덧붙임(50명 대비)
  shared() {
    const G = this.G, g = G.games[G.ri], ph = G.ph, q = G.q, rect = q?.kind === 'rect' && (ph === 'q' || ph === 'reveal');
    const s = { t: 'st', ph, code: this.code, lang: this.lang, pick: G.pick, left: Math.max(0, G.end - Date.now()), dur: G.dur };
    s.players = this.all().map(x => ({
      pid: x.pid, nick: x.nick, color: x.color, coins: x.coins, on: !!x.ws, crisis: G.crisis.has(x.pid),
      found: rect ? G.found.get(x.pid)?.size ?? 0 : null,
      done: ph === 'q' ? G.ans.has(x.pid) || rect && G.found.get(x.pid)?.size === q.total : ph === 'bet' && !!G.bets.get(x.pid)?.lock,
      delta: ph === 'reveal' ? x.delta : null,
    }));
    if (!QUIET.has(ph) && g) Object.assign(s, { ri: G.ri, rounds: G.rounds, qi: G.qi, per: g.per ?? PER, game: g.id, gname: gameText(g, this.lang).name, icon: g.icon, rule: gameText(g, this.lang).rule, bet: this.isBet() });
    if (ph === 'bet') s.tag = q.tag;
    if (ph === 'q' || ph === 'reveal') Object.assign(s, { kind: q.kind, input: q.input, title: q.title, body: q.body, opts: q.opts });
    if (rect) Object.assign(s, { grid: q.grid, labels: q.labels, target: q.target, total: ph === 'reveal' ? q.total : null });
    if (ph === 'reveal') Object.assign(s, { right: q.ans, why: q.why, goal: q.goal, picks: [0, 1, 2, 3].map(i => [...G.ans].filter(([, a]) => a.a === i).map(([pid]) => pid)) });
    if (ph === 'stand' || ph === 'final') Object.assign(s, { ranks: this.ranks(), penalty: PENALTY[this.lang] });
    return s;
  }
  mine(p) {
    const G = this.G, ph = G.ph, s = { me: p.pid, owner: this.owner === p.pid, coins: p.coins, crisis: G.crisis.has(p.pid) };
    if (ph === 'bet') { const b = G.bets.get(p.pid); Object.assign(s, { min: this.minBet(p), max: p.coins, myBet: b?.n ?? this.minBet(p), lock: !!b?.lock }); }
    if (ph === 'q' || ph === 'reveal') Object.assign(s, { mine: G.ans.get(p.pid)?.a ?? null, myBet: this.isBet() ? G.bets.get(p.pid)?.n ?? 0 : null });
    if ((ph === 'q' || ph === 'reveal') && G.q.kind === 'rect') s.found = [...(G.found.get(p.pid) ?? [])].map(k => k.split(',').map(Number));
    if (ph === 'reveal') s.delta = p.delta;
    return s;
  }
  syncAll() {
    clearTimeout(this.syncT); this.syncT = null;
    this.save();
    const base = JSON.stringify(this.shared()).slice(0, -1);   // 공통 JSON 끝 } 를 떼고 개인 부분을 이어 붙임
    for (const p of this.online()) try { p.ws.send(`${base},${JSON.stringify(this.mine(p)).slice(1)}`); } catch {}
  }
  syncSoon() { this.syncT ??= setTimeout(() => this.syncAll(), 150); }   // 답·네모 제출은 0.15초씩 묶어서(50명 대비)
}
