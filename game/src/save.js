// 진행 상황 저장(브라우저 localStorage). 서버가 없으므로 기기별로 따로 저장된다.
const KEY = 'whiteout-hunter-save-v1';

export function hasSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.v === 1 ? data : null;
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), ...data }));
    return true;
  } catch {
    return false; // 사생활 보호 모드 등에서 저장이 막힐 수 있다
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* 무시 */ }
}

export function savedAtText() {
  const d = loadSave();
  if (!d || !d.savedAt) return '';
  const t = new Date(d.savedAt);
  const pad = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}.${pad(t.getMonth() + 1)}.${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}
