export const PROFILE_KEYS = ['credits','nozzle','foam','cannon','revision','nickname','lastSaveId','updatedAt'];
export function validNickname(value) {
  return typeof value === 'string' && /^[A-Za-z0-9 _.-]{3,16}$/.test(value);
}
export function betterRun(next, previous) {
  return !previous || next.room > previous.room || (next.room === previous.room &&
    (next.score > previous.score || (next.score === previous.score && next.elapsedMs < previous.elapsedMs)));
}
export function validateSave(p) {
  if (!p || !validNickname(p.nickname)) throw new Error('Nickname must be 3–16 letters, numbers, spaces, dots, underscores or dashes.');
  const limits = {credits:[0,1000000],nozzle:[0,5],foam:[0,3],cannon:[0,3],revision:[0,2147483646],room:[0,30],score:[0,1000000],elapsedMs:[1,86400000]};
  for (const [key,[lo,hi]] of Object.entries(limits))
    if (!Number.isInteger(p[key]) || p[key]<lo || p[key]>hi) throw new Error(`Invalid ${key}.`);
  if (typeof p.saveId !== 'string' || !/^[a-f0-9]{32}$/.test(p.saveId)) throw new Error('Invalid save identifier.');
  return p;
}
export function blankProfile(nickname) {
  if (!validNickname(nickname)) throw new Error('Choose a valid nickname.');
  return {credits:0,nozzle:0,foam:0,cannon:0,revision:0,nickname,lastSaveId:''};
}
