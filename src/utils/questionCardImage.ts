const smoothRange = (value: number, start: number, end: number) => {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
};

/** Conservative colour-preserving cleanup; retain antialiased edges and pale diagrams. */
export function enhanceQuestionCardPixels(pixels: Uint8ClampedArray): void {
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3] / 255;
    const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]].map(value => value * alpha + 255 * (1 - alpha));
    const low = Math.min(...rgb);
    const high = Math.max(...rgb);
    const chroma = high - low;
    // Only nearly white, neutral compression speckles are removed.
    if (low >= 242 && chroma < 12) {
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
    } else {
      const luminance = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      // HSV saturation: strengthen weak colours toward 65%, by at most 25%.
      // Smooth gates leave neutral JPEG noise, near-white edges and dark text alone.
      const saturation = high > 0 ? chroma / high : 0;
      const confidence = smoothRange(chroma, 12, 36) * smoothRange(high, 24, 64);
      const gain = saturation > 0 && saturation < 0.65
        ? 1 + confidence * Math.min(0.25, (0.65 / saturation - 1) * 0.5)
        : 1;
      // Continuous curve avoids binary thresholding of thin mathematical symbols.
      const darkening = 0.07 * Math.sin(Math.PI * luminance / 255);
      for (let channel = 0; channel < 3; channel += 1) {
        // Scaling distance from the maximum channel preserves HSV hue and value.
        const strengthened = high - (high - rgb[channel]) * gain;
        pixels[i + channel] = strengthened * (1 - darkening);
      }
    }
    pixels[i + 3] = 255;
  }
}

/** Canvas encoders default to 96 DPI; set actual JPEG print density explicitly. */
export function setJpegDensity(bytes: Uint8Array, dpi = 400): Uint8Array {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("Geçerli JPEG üretilemedi.");
  const result = bytes.slice();
  let offset = 2;
  while (offset + 4 <= result.length && result[offset] === 0xff) {
    const marker = result[offset + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = result[offset + 2] * 256 + result[offset + 3];
    if (length < 2 || offset + length + 2 > result.length) break;
    if (marker === 0xe0 && length >= 16 && result[offset + 4] === 74 && result[offset + 5] === 70 && result[offset + 6] === 73 && result[offset + 7] === 70 && result[offset + 8] === 0) {
      result[offset + 11] = 1;
      result[offset + 12] = result[offset + 14] = dpi >> 8;
      result[offset + 13] = result[offset + 15] = dpi & 255;
      return result;
    }
    offset += length + 2;
  }
  const header = new Uint8Array([255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 2, 1, dpi >> 8, dpi & 255, dpi >> 8, dpi & 255, 0, 0]);
  const output = new Uint8Array(bytes.length + header.length);
  output.set(bytes.subarray(0, 2)); output.set(header, 2); output.set(bytes.subarray(2), 2 + header.length);
  return output;
}
