
// Cevap anahtarı görsel okuma altyapısı.
// JPEG/PDF cevap anahtarı yüklendiğinde OCR sonucu:
// 1-A
// 2-B
// 3-C
// formatına dönüştürülür.

export function parseVisualAnswerText(text:string){
  return text
    .split(/\r?\n/)
    .map(line=>{
      const m=line.match(/(\d+)\s*[-: ]\s*([A-E])/i);
      return m ? {
        question:Number(m[1]),
        answer:m[2].toUpperCase()
      } : null;
    })
    .filter(Boolean);
}
