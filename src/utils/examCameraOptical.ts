/** OMR.87/4, supplied KORAY UÇAR0001 scan, measured on 1209 × 1700 reference.
 * Anchors are the OUTER corners of the pink answers rectangle, clockwise.
 * Using printed anchors avoids scanner margins and physical paper size assumptions.
 */
export type Point = { x: number; y: number };
export type Mark = { value: string; status: 'marked' | 'blank' | 'multiple' | 'uncertain'; scores: number[] };
export type BubbleField = { id: string; label: string; options: string[]; points: Point[] };
export const ANSWER_ANCHORS: Point[] = [{ x: 566, y: 402 }, { x: 1149, y: 402 }, { x: 1149, y: 1655 }, { x: 566, y: 1655 }];
// The printed ŞUBE column omits Ğ (unlike the name grid).
const alphabet = Array.from('ABCÇDEFGHIİJKLMNOÖPRSŞTUÜVYZ');
const row = (id: string, label: string, options: string[], x: number, y: number, dx: number, dy = 0): BubbleField => ({
  id, label, options, points: options.map((_, i) => ({ x: x + i * dx, y: y + i * dy })),
});
export const cameraFields: BubbleField[] = [
  ...Array.from({ length: 4 }, (_, block) => Array.from({ length: 46 }, (_, q) =>
    row(`answer-${block}-${q}`, `${block + 1}. sütun / ${q + 1}. soru`, Array.from('ABCDE'), 601 + block * 146, 550 + q * (1092 / 45), 24.3))).flat(),
  ...Array.from({ length: 5 }, (_, i) => row(`student-${i}`, `Öğrenci no ${i + 1}. hane`, Array.from('0123456789'), 309 + i * 24.3, 184, 0, 24.3)),
  row('grade', 'Sınıf', ['9', '10', '11', '12', 'HZ', 'MZ'], 455, 184, 0, 24.3),
  row('section', 'Şube', alphabet, 504, 184, 0, 24.3),
  row('booklet', 'Kitapçık', Array.from('ABCD'), 747, 355, 24.3),
  row('exam', 'Sınav türü', ['TYT', 'AYT'], 601, 331, 0, 24.3),
];

/** Projective mapping, not bilinear interpolation: straight printed rows remain straight. */
export function createProjection(source: Point[], target: Point[]): (p: Point) => Point {
  if (source.length !== 4 || target.length !== 4) throw new Error('Dört referans noktası gerekli.');
  const cross = target.map((p, i) => {
    const b = target[(i + 1) % 4], c = target[(i + 2) % 4];
    return (b.x - p.x) * (c.y - b.y) - (b.y - p.y) * (c.x - b.x);
  });
  if (!cross.every(v => Number.isFinite(v) && v > 100)) throw new Error('Köşeleri sol üst, sağ üst, sağ alt, sol alt sırasıyla seçin.');
  const matrix = source.flatMap((p, i) => {
    const q = target[i];
    return [[p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y, q.x],
      [0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y, q.y]];
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(matrix[r][col]) > Math.abs(matrix[pivot][col])) pivot = r;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    const divisor = matrix[col][col];
    if (Math.abs(divisor) < 1e-9) throw new Error('Hizalama noktaları geçersiz.');
    for (let k = col; k <= 8; k++) matrix[col][k] /= divisor;
    for (let r = 0; r < 8; r++) if (r !== col) {
      const factor = matrix[r][col];
      for (let k = col; k <= 8; k++) matrix[r][k] -= factor * matrix[col][k];
    }
  }
  const h = matrix.map(r => r[8]);
  return p => {
    const d = h[6] * p.x + h[7] * p.y + 1;
    if (Math.abs(d) < 1e-8) throw new Error('Perspektif çok eğik; fotoğrafı yeniden çekin.');
    return { x: (h[0] * p.x + h[1] * p.y + h[2]) / d, y: (h[3] * p.x + h[4] * p.y + h[5]) / d };
  };
}

export function classifyMark(scores: number[]): Mark {
  const selected = scores.map((s, i) => s >= .24 ? i : -1).filter(i => i >= 0);
  const sorted = [...scores].sort((a, b) => b - a);
  const status = selected.length > 1 ? 'multiple' : selected.length === 1
    ? (sorted[0] - sorted[1] < .12 ? 'uncertain' : 'marked')
    : sorted[0] >= .12 ? 'uncertain' : 'blank';
  return { value: status === 'marked' ? String(selected[0]) : '', status, scores };
}

export function readCameraPixels(image: { width: number; height: number; data: Uint8ClampedArray }, corners: Point[]): Record<string, Mark> {
  const project = createProjection(ANSWER_ANCHORS, corners);
  const sample = (p: Point) => {
    const q = project(p), x = Math.round(q.x), y = Math.round(q.y);
    if (x < 0 || y < 0 || x >= image.width || y >= image.height) throw new Error('Formun tamamı fotoğrafta görünmeli. Hizalamayı kontrol edin.');
    // Red dropout removes the pink preprinted rings/letters; local white compensates shadows.
    return image.data[(y * image.width + x) * 4];
  };
  return Object.fromEntries(cameraFields.map(field => {
    const scores = field.points.map(p => {
      const background: number[] = [];
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        background.push(sample({ x: p.x + Math.cos(a) * 11, y: p.y + Math.sin(a) * 11 }));
      }
      background.sort((a, b) => a - b);
      const white = background[12];
      if (white < 65) throw new Error('Fotoğraf çok karanlık. Daha aydınlık bir yerde yeniden çekin.');
      let dark = 0, count = 0;
      for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) if (dx * dx + dy * dy <= 25) {
        dark += Math.max(0, (white - sample({ x: p.x + dx, y: p.y + dy })) / white);
        count++;
      }
      return dark / count;
    });
    const result = classifyMark(scores);
    return [field.id, { ...result, value: result.value === '' ? '' : field.options[Number(result.value)] }];
  }));
}
