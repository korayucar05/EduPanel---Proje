import React, { useEffect, useRef, useState } from 'react';
import { ANSWER_ANCHORS, cameraFields, createProjection, readCameraPixels, type Mark, type Point } from '../utils/examCameraOptical';

type Photo = { url: string; pixels: ImageData };
const cornerNames = ['sol üst', 'sağ üst', 'sağ alt', 'sol alt'];
const statusNames = { marked: 'Okundu', blank: 'Boş', multiple: 'Çift işaret', uncertain: 'Belirsiz' };

export default function ExamCameraReader() {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [corners, setCorners] = useState<Point[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark> | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [examName, setExamName] = useState('');
  const loadId = useRef(0);
  useEffect(() => () => { loadId.current++; }, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  const loadPhoto = async (file?: File) => {
    if (!file) return;
    const id = ++loadId.current;
    setBusy(true); setError(''); setMarks(null); setCorners([]); setConfirmed(false); setPhoto(null);
    let url = '';
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error('Fotoğraf 30 MB sınırını aşıyor.');
      url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      if (id !== loadId.current) { URL.revokeObjectURL(url); return; }
      if (Math.min(img.naturalWidth, img.naturalHeight) < 900) throw new Error('Fotoğraf çözünürlüğü yetersiz. Kısa kenar en az 900 piksel olmalı.');
      const scale = Math.min(1, 2600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale); canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Tarayıcı görüntü işleme alanını açamadı.');
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setPhoto({ url, pixels: ctx.getImageData(0, 0, canvas.width, canvas.height) });
    } catch (e) {
      if (url) URL.revokeObjectURL(url);
      if (id === loadId.current) setError(e instanceof Error ? e.message : 'Fotoğraf açılamadı. JPEG veya PNG deneyin.');
    } finally { if (id === loadId.current) setBusy(false); }
  };

  let projected: Array<{ id: string; points: Point[] }> = [];
  if (photo && corners.length === 4) {
    try {
      const project = createProjection(ANSWER_ANCHORS, corners);
      projected = cameraFields.map(f => ({ id: f.id, points: f.points.map(project) }));
    } catch { /* Invalid corner order is reported by the read action. */ }
  }
  const unresolved = marks ? Object.values(marks).filter(m => m.status === 'multiple' || m.status === 'uncertain').length : 0;
  const updateMark = (id: string, value: string) => {
    setMarks(previous => previous ? { ...previous, [id]: { ...previous[id], value, status: value ? 'marked' : 'blank' } } : previous);
    setConfirmed(false);
  };
  const download = () => {
    if (!marks || !confirmed || unresolved) return;
    const record = {
      schema: 'rota-camera-omr-v1', template: 'OMR.87/4', examName: examName.trim(), readAt: new Date().toISOString(),
      studentNo: Array.from({ length: 5 }, (_, i) => marks[`student-${i}`].value || ' ').join(''),
      grade: marks.grade.value, section: marks.section.value, booklet: marks.booklet.value, examType: marks.exam.value,
      answers: Array.from({ length: 4 }, (_, b) => Array.from({ length: 46 }, (_, q) => marks[`answer-${b}-${q}`].value || ' ').join('')),
      reviewed: true, fields: marks,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = 'optik-okuma.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <section className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
    <h2 className="text-xl font-bold">Telefon Kamerasıyla Optik Okuma</h2>
    <p className="text-sm text-slate-600">OMR.87/4 • Gönderdiğiniz TYT/AYT formu • 4 × 46 soru. Formu düz zeminde, gölgesiz ve tamamı görünecek şekilde çekin. Yazılar fotoğrafta düz durmalı. İşlem bu cihazda yapılır.</p>
    <div className="flex flex-wrap gap-3">
      <label className="cursor-pointer rounded-xl bg-purple-900 px-4 py-3 text-white">Fotoğraf çek
        <input aria-label="Telefon kamerasıyla fotoğraf çek" className="sr-only" type="file" accept="image/*" capture="environment" disabled={busy} onChange={e => { void loadPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
      <label className="cursor-pointer rounded-xl border px-4 py-3">Galeriden seç
        <input aria-label="Galeriden form fotoğrafı seç" className="sr-only" type="file" accept="image/*" disabled={busy} onChange={e => { void loadPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
    </div>
    {busy && <p role="status">Fotoğraf hazırlanıyor…</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}
    {photo && <>
      <p className="text-sm font-semibold">{corners.length < 4 ? `CEVAPLAR pembe çerçevesinin ${cornerNames[corners.length]} dış köşesine dokunun (${corners.length + 1}/4). Üst köşeler başlık bandını, alt köşeler 46. soruyu kapsamalı.` : 'Yeşil noktalar baloncukların merkezinde olmalı. Kayma varsa köşeleri yeniden seçin.'}</p>
      <div className="max-h-[75vh] overflow-auto rounded-xl border bg-slate-100">
        <svg role="img" aria-label="Form fotoğrafı ve seçilen optik okuma noktaları" viewBox={`0 0 ${photo.pixels.width} ${photo.pixels.height}`} className="block w-full min-w-[600px]" onClick={e => {
          if (corners.length >= 4) return;
          const rect = e.currentTarget.getBoundingClientRect();
          setCorners(old => [...old, { x: (e.clientX - rect.left) / rect.width * photo.pixels.width, y: (e.clientY - rect.top) / rect.height * photo.pixels.height }]);
          setMarks(null); setConfirmed(false); setError('');
        }}>
          <image href={photo.url} width={photo.pixels.width} height={photo.pixels.height} />
          {corners.map((p, i) => <g key={i}><circle cx={p.x} cy={p.y} r={9} fill="#2563eb" /><text x={p.x + 12} y={p.y} fill="blue" fontSize={24}>{i + 1}</text></g>)}
          {projected.map(f => f.points.map((p, i) => <circle key={`${f.id}-${i}`} cx={p.x} cy={p.y} r={3} fill={marks?.[f.id]?.status === 'multiple' || marks?.[f.id]?.status === 'uncertain' ? '#f97316' : '#16a34a'} />))}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-xl border px-4 py-2" onClick={() => { setCorners([]); setMarks(null); setConfirmed(false); setError(''); }}>Köşeleri yeniden seç</button>
        <button disabled={corners.length !== 4} className="rounded-xl bg-purple-900 px-4 py-2 text-white disabled:opacity-40" onClick={() => {
          try { setMarks(readCameraPixels(photo.pixels, corners)); setConfirmed(false); setError(''); }
          catch (e) { setMarks(null); setError(e instanceof Error ? e.message : 'Okuma başarısız.'); }
        }}>İşaretleri oku</button>
      </div>
    </>}
    {marks && <div className="space-y-4">
      <p className="rounded-xl bg-amber-50 p-3 text-sm">{unresolved} belirsiz/çift işaret var. Tüm alanları fotoğrafla karşılaştırın. Turuncu alanlarda doğru seçeneği veya “Boş”u seçerek çözümleyin. Sonuç sınav kayıtlarına otomatik yazılmaz; JSON olarak indirilir.</p>
      <label className="block">Sınav adı<input value={examName} onChange={e => setExamName(e.target.value)} className="ml-3 rounded border p-2" /></label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {cameraFields.map(field => {
          const mark = marks[field.id], needsReview = mark.status === 'multiple' || mark.status === 'uncertain';
          return <label key={field.id} className={`flex items-center justify-between gap-2 rounded border p-2 text-xs ${needsReview ? 'border-orange-400 bg-orange-50' : ''}`}>
            <span>{field.label}<small className="block text-slate-500">{statusNames[mark.status]}</small></span>
            <select aria-label={field.label} className="rounded border p-2" value={needsReview ? '?' : mark.value} onChange={e => updateMark(field.id, e.target.value)}>
              {needsReview && <option value="?" disabled>Kontrol edin</option>}
              <option value="">Boş</option>{field.options.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>;
        })}
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} disabled={unresolved > 0} onChange={e => setConfirmed(e.target.checked)} />Kimlik ve cevapları fotoğrafla karşılaştırdım.</label>
      <button className="rounded-xl bg-emerald-700 px-4 py-3 text-white disabled:opacity-40" disabled={!confirmed || unresolved > 0} onClick={download}>Kontrol edilen sonucu indir (JSON)</button>
    </div>}
  </section>;
}
