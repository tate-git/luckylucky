// QR 참가: 폰 카메라로 모니터 QR 을 읽어 방 번호(r)를 꺼냄 · 기본 BarcodeDetector, 없으면(아이폰 사파리) jsQR
let stream = null, stop = null;
const loadJsQR = () => window.jsQR ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/jsQR.js'; s.onload = ok; s.onerror = no; document.head.append(s); });
const roomOf = text => { const t = text.trim(); if (/^\d{4}$/.test(t)) return t; try { const r = new URL(t).searchParams.get('r'); return /^\d{4}$/.test(r ?? '') ? r : null; } catch { return null; } };

export async function scanQR(video, onRoom, onFail) {
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }); }
  catch { onFail('카메라를 쓸 수 없어요 · 폰 기본 카메라로 QR 을 찍거나 코드를 입력해 주세요'); return; }
  video.srcObject = stream; await video.play().catch(() => {});
  const det = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
  if (!det) await loadJsQR().catch(() => {});
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  let alive = true; stop = () => { alive = false; };
  const tick = async () => {
    if (!alive) return;
    if (video.readyState >= 2) {
      let text = null;
      if (det) text = (await det.detect(video).catch(() => []))[0]?.rawValue ?? null;
      else if (window.jsQR) {
        const w = cv.width = Math.min(640, video.videoWidth), h = cv.height = Math.round(video.videoHeight * w / video.videoWidth);
        cx.drawImage(video, 0, 0, w, h); text = jsQR(cx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null;
      }
      const r = text && roomOf(text);
      if (r) { closeScan(); onRoom(r); return; }
    }
    setTimeout(tick, 150);
  };
  tick();
}
export function closeScan() { stop?.(); stop = null; stream?.getTracks().forEach(t => t.stop()); stream = null; }
