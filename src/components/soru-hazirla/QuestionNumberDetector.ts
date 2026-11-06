
export type QuestionMarker = {
  number: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function findRedQuestionAreas(imageData: ImageData): QuestionMarker[] {
  const { data, width, height } = imageData;
  const areas: QuestionMarker[] = [];

  // Kırmızı soru numarası kutuları için ilk tarama altyapısı.
  // Sonraki aşamada OCR ile kutu içindeki sayı okunacak.
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      if (r > 150 && g < 120 && b < 120) {
        found = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (found) {
    areas.push({
      number: "?",
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    });
  }

  return areas;
}
