// --- OKLCH and OKLAB to RGB conversion helper to prevent html2canvas parsing errors ---
function oklabToRgb(L_val: number, a_val: number, b_val: number): { r: number; g: number; b: number } {
  // OKLAB -> LMS
  const l_ = L_val + 0.3963377774 * a_val + 0.2158037573 * b_val;
  const m_ = L_val - 0.1055613458 * a_val - 0.0638541728 * b_val;
  const s_ = L_val - 0.0894841775 * a_val - 1.2914855414 * b_val;

  const l_cube = l_ * l_ * l_;
  const m_cube = m_ * m_ * m_;
  const s_cube = s_ * s_ * s_;

  // LMS -> Linear sRGB
  const r = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
  const g = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413193965 * s_cube;
  const b = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;

  // Gamma correction
  const f = (x: number) => {
    const abs = Math.abs(x);
    const res = abs >= 0.0031308 ? 1.055 * Math.pow(abs, 1 / 2.4) - 0.055 : 12.92 * abs;
    return x < 0 ? -res : res;
  };

  const R = Math.round(Math.max(0, Math.min(1, f(r))) * 255);
  const G = Math.round(Math.max(0, Math.min(1, f(g))) * 255);
  const B = Math.round(Math.max(0, Math.min(1, f(b))) * 255);

  return { r: R, g: G, b: B };
}

function parseOklch(str: string): { l: number; c: number; h: number; a: number } | null {
  const match = str.match(/oklch\(([^)]+)\)/i);
  if (!match) return null;
  const cleaned = match[1].trim();
  const tokens = cleaned.split(/[\s,+/]+/).filter(Boolean);
  if (tokens.length < 3) return null;

  let lVal = parseFloat(tokens[0]);
  if (tokens[0].endsWith("%")) {
    lVal = lVal / 100;
  }
  const cVal = parseFloat(tokens[1]);
  let hVal = parseFloat(tokens[2]);
  if (tokens[2].endsWith("deg")) {
    hVal = parseFloat(tokens[2].slice(0, -3));
  } else if (tokens[2].endsWith("rad")) {
    hVal = parseFloat(tokens[2].slice(0, -3)) * (180 / Math.PI);
  } else if (tokens[2].endsWith("turn")) {
    hVal = parseFloat(tokens[2].slice(0, -4)) * 360;
  }

  let aVal = 1;
  if (tokens.length >= 4) {
    const alphaToken = tokens[3];
    aVal = parseFloat(alphaToken);
    if (alphaToken.endsWith("%")) {
      aVal = aVal / 100;
    }
  }

  if (isNaN(lVal) || isNaN(cVal) || isNaN(hVal)) return null;
  return { l: lVal, c: cVal, h: hVal, a: aVal };
}

function parseOklab(str: string): { l: number; a: number; b: number; alpha: number } | null {
  const match = str.match(/oklab\(([^)]+)\)/i);
  if (!match) return null;
  const cleaned = match[1].trim();
  const tokens = cleaned.split(/[\s,+/]+/).filter(Boolean);
  if (tokens.length < 3) return null;

  let lVal = parseFloat(tokens[0]);
  if (tokens[0].endsWith("%")) {
    lVal = lVal / 100;
  }
  const aVal = parseFloat(tokens[1]);
  const bVal = parseFloat(tokens[2]);

  let alphaVal = 1;
  if (tokens.length >= 4) {
    const alphaToken = tokens[3];
    alphaVal = parseFloat(alphaToken);
    if (alphaToken.endsWith("%")) {
      alphaVal = alphaVal / 100;
    }
  }

  if (isNaN(lVal) || isNaN(aVal) || isNaN(bVal)) return null;
  return { l: lVal, a: aVal, b: bVal, alpha: alphaVal };
}

function oklchToRgbString(str: string): string {
  return str.replace(/oklch\([^)]+\)/gi, (match) => {
    const parsed = parseOklch(match);
    if (!parsed) return match;
    const { l, c, h, a } = parsed;

    // OKLCH -> OKLAB
    const L_val = l;
    const hRad = (h * Math.PI) / 180;
    const a_val = c * Math.cos(hRad);
    const b_val = c * Math.sin(hRad);

    const { r, g, b } = oklabToRgb(L_val, a_val, b_val);

    if (a < 1) {
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  });
}

function oklabToRgbString(str: string): string {
  return str.replace(/oklab\([^)]+\)/gi, (match) => {
    const parsed = parseOklab(match);
    if (!parsed) return match;
    const { l, a, b, alpha } = parsed;
    const { r, g, b: rgbB } = oklabToRgb(l, a, b);
    if (alpha < 1) {
      return `rgba(${r}, ${g}, ${rgbB}, ${alpha})`;
    }
    return `rgb(${r}, ${g}, ${rgbB})`;
  });
}

function convertColorsToRgb(str: string): string {
  if (typeof str !== "string") return str;
  let val = str;
  if (val.includes("oklch")) {
    val = oklchToRgbString(val);
  }
  if (val.includes("oklab")) {
    val = oklabToRgbString(val);
  }
  return val;
}

// Hook getComputedStyle globally to intercept color functions and prevent html2canvas failures
if (typeof window !== "undefined" && !(window as any).__oklch_patched) {
  (window as any).__oklch_patched = true;
  const originalGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = function (elt, pseudoElt) {
    const style = originalGetComputedStyle(elt, pseudoElt);
    return new Proxy(style, {
      get(target, prop) {
        if (prop === "getPropertyValue") {
          return function (propertyName: string) {
            const val = target.getPropertyValue(propertyName);
            return convertColorsToRgb(val);
          };
        }
        if (typeof prop !== "string" && typeof prop !== "number") {
          return (target as any)[prop];
        }
        const value = (target as any)[prop];
        if (typeof value === "string") {
          return convertColorsToRgb(value);
        }
        if (typeof value === "function") {
          return value.bind(target);
        }
        return value;
      },
    });
  };
}


export const printHtmlSafely = (htmlContent: string, customPrintStyles: string = "") => {
  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Yazdır</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; background: white; color: black; }
            ${customPrintStyles}
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  } else {
    alert("Lütfen tarayıcınızda açılır pencerelere (pop-up) izin verin.");
  }
};

