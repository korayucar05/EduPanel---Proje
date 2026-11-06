export type OpticalPoint = { x: number; y: number };

export const ATTENDANCE_ROW_MARKER_INTERVAL = 5;

export type OpticalReadResult = {
  markedLessons: number[][];
  markerPoints: [OpticalPoint, OpticalPoint, OpticalPoint, OpticalPoint];
  previewUrl: string;
  identity: AttendanceOpticalIdentity | null;
  calibration: {
    blankDarkness: number;
    markThreshold: number;
  };
};

export type AttendanceOpticalIdentity = {
  classCode: number;
  date: string;
};

const CODE_GRID_SIZE = 13;
export const ATTENDANCE_CODE_LAYOUT = { gridSize: CODE_GRID_SIZE, xMm: 23.5, yMm: 180.5, sizeMm: 18, paddingCells: 1 } as const;
const CODE_X_MM = ATTENDANCE_CODE_LAYOUT.xMm;
const CODE_Y_MM = ATTENDANCE_CODE_LAYOUT.yMm;
const CODE_SIZE_MM = ATTENDANCE_CODE_LAYOUT.sizeMm;
const CODE_EPOCH_UTC = Date.UTC(2020, 0, 1);

export const getAttendanceClassCode = (classroomId: string) => {
  let hash = 0x811c;
  for (const character of String(classroomId || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x0101) & 0xffff;
  }
  return hash & 0xffff;
};

const numberBits = (value: number, length: number) =>
  Array.from({ length }, (_, index) => Boolean((value >> (length - index - 1)) & 1));

const bitsNumber = (bits: boolean[]) => bits.reduce((value, bit) => (value << 1) | Number(bit), 0);

const crc8Bits = (bits: boolean[]) => {
  let crc = 0;
  for (const bit of bits) {
    const mix = ((crc >> 7) & 1) ^ Number(bit);
    crc = (crc << 1) & 0xff;
    if (mix) crc ^= 0x07;
  }
  return crc;
};

const isFinderCell = (row: number, column: number) =>
  (row < 5 && column < 5)
  || (row < 5 && column >= CODE_GRID_SIZE - 5)
  || (row >= CODE_GRID_SIZE - 5 && column < 5);

const finderValue = (localRow: number, localColumn: number) =>
  localRow === 0 || localRow === 4 || localColumn === 0 || localColumn === 4
  || (localRow === 2 && localColumn === 2);

const codeDataPositions = () => {
  const positions: Array<[number, number]> = [];
  for (let row = 0; row < CODE_GRID_SIZE; row += 1) {
    for (let column = 0; column < CODE_GRID_SIZE; column += 1) {
      if (!isFinderCell(row, column)) positions.push([row, column]);
    }
  }
  return positions;
};

const dateToDayCode = (date: string) => {
  const parsed = Date.parse(`${date}T00:00:00Z`);
  return Math.max(0, Math.min(0x3fff, Math.floor((parsed - CODE_EPOCH_UTC) / 86400000)));
};

const dayCodeToDate = (dayCode: number) => new Date(CODE_EPOCH_UTC + dayCode * 86400000).toISOString().slice(0, 10);

export const createAttendanceCodeMatrix = (classroomId: string, date: string) => {
  const payload = [
    ...numberBits(0x0a, 4),
    ...numberBits(getAttendanceClassCode(classroomId), 16),
    ...numberBits(dateToDayCode(date), 14),
  ];
  const encoded = [...payload, ...numberBits(crc8Bits(payload), 8)];
  const repeated = [...encoded, ...encoded];
  const matrix = Array.from({ length: CODE_GRID_SIZE }, () => Array<boolean>(CODE_GRID_SIZE).fill(false));

  for (let row = 0; row < CODE_GRID_SIZE; row += 1) {
    for (let column = 0; column < CODE_GRID_SIZE; column += 1) {
      if (row < 5 && column < 5) matrix[row][column] = finderValue(row, column);
      else if (row < 5 && column >= CODE_GRID_SIZE - 5) matrix[row][column] = finderValue(row, column - (CODE_GRID_SIZE - 5));
      else if (row >= CODE_GRID_SIZE - 5 && column < 5) matrix[row][column] = finderValue(row - (CODE_GRID_SIZE - 5), column);
    }
  }
  codeDataPositions().forEach(([row, column], index) => {
    matrix[row][column] = repeated[index] ?? ((row + column) % 2 === 0);
  });
  return matrix;
};

type GrayImage = {
  width: number;
  height: number;
  gray: Uint8Array;
  previewUrl: string;
};

const loadGrayImage = (file: File): Promise<GrayImage> => new Promise((resolve, reject) => {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Görüntü okuma alanı oluşturulamadı."));
      return;
    }
    context.drawImage(image, 0, 0, width, height);
    const rgba = context.getImageData(0, 0, width, height).data;
    const gray = new Uint8Array(width * height);
    for (let index = 0, pixel = 0; index < rgba.length; index += 4, pixel += 1) {
      gray[pixel] = Math.round(rgba[index] * 0.299 + rgba[index + 1] * 0.587 + rgba[index + 2] * 0.114);
    }
    resolve({ width, height, gray, previewUrl: objectUrl });
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Görüntü dosyası açılamadı."));
  };
  image.src = objectUrl;
});

const createDarkIntegral = ({ width, height, gray }: GrayImage) => {
  const stride = width + 1;
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let rowTotal = 0;
    for (let x = 1; x <= width; x += 1) {
      rowTotal += 255 - gray[(y - 1) * width + x - 1];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + rowTotal;
    }
  }
  return { integral, stride };
};

const boxAverage = (
  integral: Float64Array,
  stride: number,
  x: number,
  y: number,
  size: number,
) => {
  const x2 = x + size;
  const y2 = y + size;
  const sum = integral[y2 * stride + x2] - integral[y * stride + x2]
    - integral[y2 * stride + x] + integral[y * stride + x];
  return sum / (size * size);
};

const findCornerMarker = (
  image: GrayImage,
  corner: "tl" | "tr" | "bl" | "br",
): OpticalPoint => {
  const { width, height } = image;
  const { integral, stride } = createDarkIntegral(image);
  const physicalScale = Math.min(width / 142, height / 200);
  const size = Math.max(8, Math.round(physicalScale * 3));
  const isRight = corner.endsWith("r");
  const isBottom = corner.startsWith("b");
  const xStart = isRight ? Math.floor(width * 0.78) : 0;
  const xEnd = isRight ? width - size : Math.ceil(width * 0.22) - size;
  const yStart = isBottom ? Math.floor(height * 0.82) : 0;
  const yEnd = isBottom ? height - size : Math.ceil(height * 0.18) - size;
  const cornerX = isRight ? width : 0;
  const cornerY = isBottom ? height : 0;
  let bestScore = -Infinity;
  let bestPoint = { x: 0, y: 0 };

  for (let y = Math.max(0, yStart); y <= Math.max(0, yEnd); y += 2) {
    for (let x = Math.max(0, xStart); x <= Math.max(0, xEnd); x += 2) {
      const darkness = boxAverage(integral, stride, x, y, size);
      const centerX = x + size / 2;
      const centerY = y + size / 2;
      const distancePenalty = Math.hypot((centerX - cornerX) / width, (centerY - cornerY) / height) * 90;
      const score = darkness - distancePenalty;
      if (score > bestScore) {
        bestScore = score;
        bestPoint = { x: centerX, y: centerY };
      }
    }
  }

  const markerDarkness = boxAverage(
    integral,
    stride,
    Math.max(0, Math.min(width - size, Math.round(bestPoint.x - size / 2))),
    Math.max(0, Math.min(height - size, Math.round(bestPoint.y - size / 2))),
    size,
  );
  if (markerDarkness < 135) throw new Error("Optik köşe işaretleri algılanamadı. Fişi düz, aydınlık ve tek başına kadraja alın.");
  return bestPoint;
};

const interpolatePoint = (
  points: [OpticalPoint, OpticalPoint, OpticalPoint, OpticalPoint],
  xMm: number,
  yMm: number,
) => {
  const [tl, tr, bl, br] = points;
  const u = (xMm - 8.5) / 123;
  const v = (yMm - 7.5) / 184;
  return {
    x: (1 - u) * (1 - v) * tl.x + u * (1 - v) * tr.x + (1 - u) * v * bl.x + u * v * br.x,
    y: (1 - u) * (1 - v) * tl.y + u * (1 - v) * tr.y + (1 - u) * v * bl.y + u * v * br.y,
  };
};

const readGray = (image: GrayImage, point: OpticalPoint) => {
  const x = Math.max(0, Math.min(image.width - 1, Math.round(point.x)));
  const y = Math.max(0, Math.min(image.height - 1, Math.round(point.y)));
  return image.gray[y * image.width + x];
};

const decodeIdentityBits = (bits: boolean[]): AttendanceOpticalIdentity | null => {
  if (bits.length < 42) return null;
  const payload = bits.slice(0, 34);
  const storedCrc = bitsNumber(bits.slice(34, 42));
  if (bitsNumber(payload.slice(0, 4)) !== 0x0a || crc8Bits(payload) !== storedCrc) return null;
  const classCode = bitsNumber(payload.slice(4, 20));
  const dayCode = bitsNumber(payload.slice(20, 34));
  return { classCode, date: dayCodeToDate(dayCode) };
};

export const decodeAttendanceCodeMatrix = (matrix: boolean[][]) => {
  const bits = codeDataPositions().map(([row, column]) => Boolean(matrix[row]?.[column]));
  const first = decodeIdentityBits(bits.slice(0, 42));
  const second = decodeIdentityBits(bits.slice(42, 84));
  if (first && second && first.classCode === second.classCode && first.date === second.date) return first;
  if (first) return first;
  if (second) return second;
  throw new Error("Fiş karekodu okunamadı. Sınıfı manuel seçerek devam edebilirsiniz.");
};

const decodeAttendanceIdentity = (
  image: GrayImage,
  markers: [OpticalPoint, OpticalPoint, OpticalPoint, OpticalPoint],
) => {
  const sampled = Array.from({ length: CODE_GRID_SIZE }, (_, row) =>
    Array.from({ length: CODE_GRID_SIZE }, (_, column) => {
      const x = CODE_X_MM + ((column + 1.5) / (CODE_GRID_SIZE + 2)) * CODE_SIZE_MM;
      const y = CODE_Y_MM + ((row + 1.5) / (CODE_GRID_SIZE + 2)) * CODE_SIZE_MM;
      return readGray(image, interpolatePoint(markers, x, y)) < 145;
    }));
  return decodeAttendanceCodeMatrix(sampled);
};

const sampleDarkness = (
  image: GrayImage,
  markers: [OpticalPoint, OpticalPoint, OpticalPoint, OpticalPoint],
  xMm: number,
  yMm: number,
  halfWidthMm: number,
  halfHeightMm: number,
) => {
  let dark = 0;
  let total = 0;
  for (let yi = 0; yi < 7; yi += 1) {
    for (let xi = 0; xi < 13; xi += 1) {
      const x = xMm - halfWidthMm + (xi / 12) * halfWidthMm * 2;
      const y = yMm - halfHeightMm + (yi / 6) * halfHeightMm * 2;
      if (readGray(image, interpolatePoint(markers, x, y)) < 155) dark += 1;
      total += 1;
    }
  }
  return dark / total;
};

const findRowCenter = (
  image: GrayImage,
  markers: [OpticalPoint, OpticalPoint, OpticalPoint, OpticalPoint],
  expectedY: number,
) => {
  let bestY = expectedY;
  let bestDarkness = -1;
  for (let offset = -2.2; offset <= 2.2; offset += 0.1) {
    const darkness = sampleDarkness(image, markers, 10.2, expectedY + offset, 0.55, 0.55);
    if (darkness > bestDarkness) {
      bestDarkness = darkness;
      bestY = expectedY + offset;
    }
  }
  if (bestDarkness <= 0.45) throw new Error("Öğrenci satırı referans noktası okunamadı. Fişin tamamını, gölgesiz ve net biçimde yeniden çekin.");
  return bestY;
};

const calibrateAttendanceRows = (
  image: GrayImage,
  markers: [OpticalPoint, OpticalPoint, OpticalPoint, OpticalPoint],
  studentCount: number,
) => {
  if (studentCount <= 0) return [];
  const anchorIndexes = Array.from({ length: studentCount }, (_, index) => index)
    .filter((index) => index % ATTENDANCE_ROW_MARKER_INTERVAL === 0 || index === studentCount - 1);
  const anchors = anchorIndexes.map((rowIndex) => {
    const expectedY = 30.1 + rowIndex * 4.45;
    return { rowIndex, correction: findRowCenter(image, markers, expectedY) - expectedY };
  });

  return Array.from({ length: studentCount }, (_, rowIndex) => {
    const expectedY = 30.1 + rowIndex * 4.45;
    const previous = [...anchors].reverse().find((anchor) => anchor.rowIndex <= rowIndex) || anchors[0];
    const next = anchors.find((anchor) => anchor.rowIndex >= rowIndex) || anchors[anchors.length - 1];
    if (previous.rowIndex === next.rowIndex) return expectedY + previous.correction;
    const ratio = (rowIndex - previous.rowIndex) / (next.rowIndex - previous.rowIndex);
    return expectedY + previous.correction + (next.correction - previous.correction) * ratio;
  });
};

export async function readAttendanceOpticalImage(file: File, studentCount: number): Promise<OpticalReadResult> {
  const image = await loadGrayImage(file);
  try {
    const markers: [OpticalPoint, OpticalPoint, OpticalPoint, OpticalPoint] = [
      findCornerMarker(image, "tl"),
      findCornerMarker(image, "tr"),
      findCornerMarker(image, "bl"),
      findCornerMarker(image, "br"),
    ];
    let identity: AttendanceOpticalIdentity | null = null;
    try { identity = decodeAttendanceIdentity(image, markers); } catch { /* Manuel sınıf seçimi kullanılabilir. */ }
    const calibratedRows = calibrateAttendanceRows(image, markers, studentCount);
    const darknessGrid = Array.from({ length: studentCount }, (_, rowIndex) => {
      const rowY = calibratedRows[rowIndex];
      return Array.from({ length: 8 }, (_, lessonIndex) => {
        const bubbleX = 55.25 + lessonIndex * 9.5;
        // Oval kenarını örneklememek için yalnızca iç bölge ölçülür.
        return sampleDarkness(image, markers, bubbleX, rowY, 1.55, 0.68);
      });
    });
    const sortedDarkness = darknessGrid.flat().sort((a, b) => a - b);
    // En açık hücrelerin ortalaması fişteki kâğıt/gölge seviyesini temsil eder.
    const baselineCount = Math.max(8, Math.floor(sortedDarkness.length * 0.3));
    const blankDarkness = sortedDarkness.slice(0, baselineCount).reduce((sum, value) => sum + value, 0) / baselineCount;
    // İnce oval çizgileri ve kamera gölgelerini işaret saymadan kalem izini korur.
    const markThreshold = Math.max(0.115, Math.min(0.28, blankDarkness + 0.075));
    const markedLessons = darknessGrid.map((row) => row.flatMap((darkness, lessonIndex) =>
      darkness >= markThreshold ? [lessonIndex + 1] : []));
    return {
      markedLessons,
      markerPoints: markers,
      previewUrl: image.previewUrl,
      identity,
      calibration: { blankDarkness, markThreshold },
    };
  } catch (error) {
    URL.revokeObjectURL(image.previewUrl);
    throw error;
  }
}

export async function readAttendanceOpticalIdentity(file: File): Promise<AttendanceOpticalIdentity> {
  const image = await loadGrayImage(file);
  try {
    const markers: [OpticalPoint, OpticalPoint, OpticalPoint, OpticalPoint] = [
      findCornerMarker(image, "tl"),
      findCornerMarker(image, "tr"),
      findCornerMarker(image, "bl"),
      findCornerMarker(image, "br"),
    ];
    return decodeAttendanceIdentity(image, markers);
  } finally {
    URL.revokeObjectURL(image.previewUrl);
  }
}
