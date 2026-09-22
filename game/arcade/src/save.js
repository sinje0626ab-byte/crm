// 진행 저장(브라우저 localStorage).
const KEY = 'yj-arcade-tycoon-v1';

export function hasSave() {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}
export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && data.v === 1 ? data : null;
  } catch { return null; }
}
export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), ...data }));
    return true;
  } catch { return false; }
}
export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}
export function savedAtText() {
  const d = loadSave();
  if (!d?.savedAt) return '';
  const t = new Date(d.savedAt);
  const p = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}.${p(t.getMonth() + 1)}.${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
}
