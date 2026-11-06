const corruptionScore = (text: string) => {
  const replacement = (text.match(/�/g) || []).length * 20;
  const mojibake = (text.match(/[ÃÄÅÂÐÞ]/g) || []).length * 6;
  const controls = Array.from(text).filter(char => {
    const code = char.charCodeAt(0);
    return code < 32 && ![9, 10, 13].includes(code);
  }).length * 10;
  return replacement + mojibake + controls;
};

const repairUtf8Mojibake = (text: string) => {
  if (!/[ÃÄÅÂ]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from(Array.from(text, char => char.charCodeAt(0) & 0xff));
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return corruptionScore(repaired) < corruptionScore(text) ? repaired : text;
  } catch {
    return text;
  }
};

export const decodeTurkishTextFile = async (file: File) => {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const candidates: string[] = [];

  const addCandidate = (encoding: string, fatal = false) => {
    try {
      candidates.push(new TextDecoder(encoding, { fatal }).decode(bytes));
    } catch {}
  };

  if (bytes[0] === 0xff && bytes[1] === 0xfe) addCandidate("utf-16le");
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) addCandidate("utf-16be");
  else {
    addCandidate("utf-8", true);
    addCandidate("utf-8");
    addCandidate("windows-1254");
    addCandidate("iso-8859-9");
    if (bytes.slice(0, 100).filter(value => value === 0).length > 10) addCandidate("utf-16le");
  }

  const decoded = candidates
    .map(value => repairUtf8Mojibake(value.replace(/^\uFEFF/, "")))
    .sort((a, b) => corruptionScore(a) - corruptionScore(b))[0];

  return decoded || "";
};
