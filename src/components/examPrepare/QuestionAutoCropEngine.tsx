
/*
 Soru numarası filtresi:
 - Renk kullanılmaz.
 - Kırmızı/siyah/mavi fark etmez.
 - Sadece "1." formatındaki başlangıçlar dikkate alınır.
 - Şekil içindeki rakamlar kart başlangıcı kabul edilmez.
*/

export function isQuestionStart(text:string){
  return /^\d+\.$/.test(text.trim());
}
