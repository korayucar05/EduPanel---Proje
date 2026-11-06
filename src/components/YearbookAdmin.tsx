import React from "react";
import { BookOpen, Download, LockKeyhole, UnlockKeyhole } from "lucide-react";
import yearbookLeftPage from "../assets/yearbook/yearbook-bg-left.png";
import yearbookRightPage from "../assets/yearbook/yearbook-bg-right.png";
import studentPhotoFrame from "../assets/yearbook/student-photo-frame-green.png";

type Student = { id: string; name: string; number: string; classroom: string };
type SurveyQuestion = { id: string; text: string; answerType: string; options: string[]; required: boolean };
type YearbookSurvey = { id: string; title: string; description?: string; questions: SurveyQuestion[] };
type AuthorStatus = Student & { submitted: boolean; entry?: { comment: string; surveyAnswers: Record<string, string | string[]>; updatedAt?: string } | null };
type Detail = {
  open: boolean;
  surveyId: string;
  survey: YearbookSurvey | null;
  target: Student | null;
  authors: AuthorStatus[];
  totals: { total: number; submitted: number; missing: number };
};

const studentNo = (value: string) => {
  const n = Number(String(value || "").replace(/\D/g, ""));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

export default function YearbookAdmin() {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [open, setOpen] = React.useState(false);
  const [activeSurvey, setActiveSurvey] = React.useState<YearbookSurvey | null>(null);
  const [classroom, setClassroom] = React.useState("");
  const [targetId, setTargetId] = React.useState("");
  const [detail, setDetail] = React.useState<Detail | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [yearbookPhotos, setYearbookPhotos] = React.useState<Record<string, string>>({});

  const loadBase = React.useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [rosterRes, settingsRes] = await Promise.all([
        fetch("/api/yearbook/roster", { cache: "no-store" }),
        fetch("/api/yearbook/settings", { cache: "no-store" }),
      ]);
      const rosterJson = await rosterRes.json().catch(() => ({}));
      const settingsJson = await settingsRes.json().catch(() => ({}));
      if (!rosterRes.ok) throw new Error(rosterJson.error || "Sınıf ve öğrenci bilgileri alınamadı.");
      if (!settingsRes.ok) throw new Error(settingsJson.error || "Yıllık ayarları alınamadı.");
      const rows = (Array.isArray(rosterJson.students) ? rosterJson.students : [])
        .map((x: any) => ({ id: String(x.id || ""), name: String(x.name || ""), number: String(x.number || ""), classroom: String(x.classroom || "") }))
        .filter((x: Student) => x.id && x.name && x.classroom)
        .sort((a: Student, b: Student) => a.classroom.localeCompare(b.classroom, "tr-TR", { numeric: true }) || studentNo(a.number) - studentNo(b.number) || a.name.localeCompare(b.name, "tr-TR"));
      setStudents(rows);
      setOpen(settingsJson.open === true);
      setActiveSurvey(settingsJson.survey || null);
    } catch (e: any) { setError(e?.message || "Yıllık bilgileri alınamadı."); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void loadBase(); }, [loadBase]);

  const loadDetail = React.useCallback(async (cls: string, id: string) => {
    if (!cls || !id) { setDetail(null); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/yearbook/admin?classroom=${encodeURIComponent(cls)}&targetStudentId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Yıllık değerlendirmeleri alınamadı.");
      setDetail(j);
      setOpen(j.open === true);
      setActiveSurvey(j.survey || null);
    } catch (e: any) { setError(e?.message || "Yıllık değerlendirmeleri alınamadı."); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void loadDetail(classroom, targetId); }, [classroom, targetId, loadDetail]);

  const setSystemOpen = async (next: boolean) => {
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/yearbook/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ open: next }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Yıllık durumu değiştirilemedi.");
      setOpen(next);
      if (detail) setDetail({ ...detail, open: next });
    } catch (e: any) { setError(e?.message || "Yıllık durumu değiştirilemedi."); }
    finally { setSaving(false); }
  };

  const classrooms: string[] = Array.from(new Set<string>(students.map(x => x.classroom))).sort((a, b) => a.localeCompare(b, "tr-TR", { numeric: true }));
  const classStudents = students.filter(x => x.classroom === classroom).sort((a,b) => studentNo(a.number)-studentNo(b.number) || a.name.localeCompare(b.name,"tr-TR"));
  const printClassYearbook = async () => {
    const targetStudents = students.filter(student => student.classroom === classroom);
    if (!classroom || !targetStudents.length || pdfBusy) {
      if (!classroom) setError("Önce PDF oluşturmak istediğiniz sınıf/şubeyi seçin.");
      return;
    }

    // Pencereyi tıklama anında açıyoruz. Böylece uzun veri hazırlama işlemi sonrasında
    // tarayıcının açılır pencere engeline takılıp "hazırlanıyor" durumunda kalmaz.
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setError("PDF penceresi açılamadı. Tarayıcı açılır pencere engelini kaldırın.");
      return;
    }
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>EduPanel Yıllık - ${classroom}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#475569} .loading{max-width:520px;margin:80px auto;text-align:center;font-weight:700}</style></head><body><div class="loading">Yıllık PDF hazırlanıyor…</div></body></html>`);
    printWindow.document.close();

    setPdfBusy(true); setError("");
    try {
      const rows: Array<{ student: Student; detail: Detail }> = [];
      const batchSize = 8;
      for (let i = 0; i < targetStudents.length; i += batchSize) {
        const batch = targetStudents.slice(i, i + batchSize);
        const results = await Promise.all(batch.map(async student => {
          try {
            const r = await fetch(`/api/yearbook/admin?classroom=${encodeURIComponent(student.classroom)}&targetStudentId=${encodeURIComponent(student.id)}`, { cache: "no-store" });
            const j = await r.json().catch(() => ({}));
            return r.ok && j?.target ? { student, detail: j as Detail } : null;
          } catch { return null; }
        }));
        results.forEach(row => { if (row) rows.push(row); });
      }
      if (!rows.length) throw new Error("PDF için öğrenci yıllık bilgileri alınamadı.");

      const esc = (v: unknown) => String(v ?? "").replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c] || c));
      const titleName = (v: string) => v.trim().split(/\s+/).filter(Boolean).map(part => { const lower = part.toLocaleLowerCase("tr-TR"); return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1); }).join(" ");
      const splitName = (v: string) => { const parts = titleName(v).split(/\s+/).filter(Boolean); return parts.length <= 1 ? { firstName: parts[0] || "", surname: "" } : { firstName: parts.slice(0,-1).join(" "), surname: parts[parts.length - 1] }; };
      const commentsHtml = (d: Detail, from: number, to?: number) => d.authors
        .filter(a => a.submitted && a.entry && String(a.entry.comment || "").trim())
        .slice(from, to)
        .map(a => `<div class="comment"><b>${esc(titleName(a.name))}</b><span>${esc(a.entry?.comment || "")}</span></div>`)
        .join("");

      const surveyStatsStartPage = rows.length * 2 + 1;
      const surveyStatisticsHtml = [classroom].map((cls, statsIndex) => {
        const classRows = rows.filter(row => row.student.classroom === cls);
        const survey = classRows.find(row => row.detail.survey)?.detail.survey || null;
        if (!survey) return "";

        const allEntries = classRows.flatMap(row => row.detail.authors)
          .filter(author => author.submitted && author.entry)
          .map(author => author.entry!);

        const questionStats = survey.questions.map((question, index) => {
          const answers = allEntries.map(entry => entry.surveyAnswers?.[question.id]).filter(value => {
            if (Array.isArray(value)) return value.length > 0;
            return String(value || "").trim().length > 0;
          });
          const responseCount = answers.length;
          if (!responseCount) {
            return `<div class="statItem"><div class="statQuestion"><span>${index + 1}</span>${esc(question.text)}</div><div class="statSummary">Yanıt bulunmuyor.</div></div>`;
          }

          if (question.options?.length) {
            const counts = new Map<string, number>();
            question.options.forEach(option => counts.set(String(option), 0));
            answers.forEach(value => {
              const values = Array.isArray(value) ? value : [value];
              values.forEach(item => {
                const key = String(item || "").trim();
                if (key) counts.set(key, (counts.get(key) || 0) + 1);
              });
            });
            const optionSummary = Array.from(counts.entries()).map(([option, count]) => {
              const pct = responseCount ? Math.round((count / responseCount) * 100) : 0;
              return `<span><b>${esc(option)}</b> %${pct}</span>`;
            }).join(" · ");
            return `<div class="statItem"><div class="statQuestion"><span>${index + 1}</span>${esc(question.text)}</div><div class="statSummary">${optionSummary}</div><div class="statCount">${responseCount} yanıt</div></div>`;
          }

          const frequencies = new Map<string, number>();
          answers.forEach(value => {
            const text = Array.isArray(value) ? value.join(" · ") : String(value || "").trim();
            if (text) frequencies.set(text, (frequencies.get(text) || 0) + 1);
          });
          const topAnswers = Array.from(frequencies.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr-TR"))
            .slice(0, 3)
            .map(([text, count]) => `${esc(text)}${count > 1 ? ` (${count})` : ""}`)
            .join(" · ");
          return `<div class="statItem"><div class="statQuestion"><span>${index + 1}</span>${esc(question.text)}</div><div class="statSummary">${topAnswers || `${responseCount} yanıt`}</div><div class="statCount">${responseCount} yanıt</div></div>`;
        }).join("");

        return `<article class="page surveyStatsPage">
          <img class="pageBg" src="${yearbookRightPage}" alt="">
          <div class="statsHeader"><div class="statsClass">${esc(cls)} ŞUBESİ</div><div class="statsTitle">${esc(survey.title || "Yıllık Anketi")} · İstatistik Sonuçları</div><div class="statsMeta">${allEntries.length} değerlendirme kaydı</div></div>
          <div class="statsGrid">${questionStats}</div>
          <div class="pageNumber pageNumberRight">${surveyStatsStartPage + statsIndex}</div>
        </article>`;
      }).join("");

      const html = rows.map(({ student, detail: d }, studentIndex) => {
        const entries = d.authors.filter(a => a.submitted && a.entry);
        const mid = Math.ceil(entries.length / 2);
        const photo = yearbookPhotos[student.id] || "";
        const photoHtml = photo ? `<img class="studentPhoto" src="${esc(photo)}" alt="">` : `<div class="photoEmpty">Fotoğraf yok</div>`;
        const leftPageNo = studentIndex * 2 + 1;
        const rightPageNo = leftPageNo + 1;
        const split = splitName(student.name);
        return `<section class="spread">
          <article class="page left">
            <img class="pageBg" src="${yearbookLeftPage}" alt="">
            <div class="frameWrap">
              <div class="photoOpening">${photoHtml}</div>
              <img class="photoFrame" src="${studentPhotoFrame}" alt="">
              <div class="frameName"><div>${student.number ? `${esc(student.number)} - ` : ""}${esc(split.firstName)}</div>${split.surname ? `<div class="frameSurname">${esc(split.surname)}</div>` : ""}</div>
            </div>
            <div class="comments leftcomments">${commentsHtml(d,0,mid)}</div>
            <div class="pageNumber pageNumberLeft">${leftPageNo}</div>
          </article>
          <article class="page right">
            <img class="pageBg" src="${yearbookRightPage}" alt="">
            <div class="comments rightcomments">${commentsHtml(d,mid)}</div>
            <div class="pageNumber pageNumberRight">${rightPageNo}</div>
          </article>
        </section>`;
      }).join("") + surveyStatisticsHtml;

      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>EduPanel Yıllık - ${esc(classroom)}</title><style>
        @import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');
        @page{size:A4 portrait;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}html,body{margin:0;padding:0;background:#ddd}.spread{display:contents}.page{width:210mm;height:297mm;position:relative;overflow:hidden;page-break-after:always;background:#fff}.pageBg{position:absolute;z-index:0;inset:0;width:210mm;height:297mm;object-fit:fill;display:block;pointer-events:none}.frameWrap{position:absolute;z-index:1;left:15mm;top:20mm;width:55mm;aspect-ratio:780/1024}.photoOpening{position:absolute;z-index:1;left:10.77%;top:8.59%;width:78.08%;height:67.38%;overflow:hidden;background:#f8fafc}.studentPhoto{width:100%;height:100%;object-fit:cover;display:block}.photoEmpty{width:100%;height:100%;display:grid;place-items:center;font:7pt Arial,sans-serif;color:#94a3b8}.photoFrame{position:absolute;z-index:2;inset:0;width:100%;height:100%;object-fit:fill;pointer-events:none}.frameName{position:absolute;z-index:3;left:11%;right:11%;bottom:1.8%;height:16.8%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-family:'Great Vibes',cursive;font-size:16pt;color:#fff;line-height:.95}.frameSurname{margin-top:1mm;font-size:17pt}.studentMeta{position:absolute;z-index:1;left:15mm;top:99mm;width:55mm;text-align:center;font:700 6.5pt Arial,sans-serif;letter-spacing:.13em;color:#8a5d3d}.comments{position:absolute;z-index:1;overflow:hidden}.leftcomments{left:9%;right:7%;top:39%;bottom:6%}.rightcomments{left:7%;right:9%;top:11%;bottom:6%}.righttitle{position:absolute;z-index:1;left:7%;right:9%;top:7%;font-family:Georgia,serif;font-size:10pt;font-style:italic;font-weight:bold;color:#5a315b;border-bottom:.3mm solid #6f315144;padding-bottom:2mm}.comment{margin:0 0 3.2mm;font:10pt Georgia,serif;line-height:1.35;color:#453b32;white-space:pre-wrap}.comment b{font-size:10pt;color:#3f2b35;margin-right:1.5mm}.comment span{font-weight:400;color:#453b32}.pageNumber{position:absolute;z-index:2;bottom:7mm;min-width:12mm;height:7mm;padding:0 3mm;display:flex;align-items:center;justify-content:center;border:.2mm solid #c7d7d5;background:#ffffffb8;border-radius:999px;font:700 7pt Georgia,serif;color:#5f7775}.pageNumberLeft{left:10mm}.pageNumberRight{right:10mm}.surveyStatsPage{padding:18mm 16mm 14mm}.statsHeader,.statsGrid{position:relative;z-index:1}.statsHeader{border-bottom:.35mm solid #6f315144;padding-bottom:4mm;margin-bottom:5mm}.statsClass{font:800 10pt Arial,sans-serif;letter-spacing:.16em;color:#217b77}.statsTitle{margin-top:1.5mm;font:700 15pt Georgia,serif;color:#4a3448}.statsMeta{margin-top:1mm;font:7.5pt Arial,sans-serif;color:#7a6a72}.statsGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm 4mm;align-content:start}.statItem{min-height:27mm;padding:2.4mm 2.7mm;border:.2mm solid #4f8f8a30;border-radius:2.5mm;background:#ffffffaa;overflow:hidden}.statQuestion{display:flex;gap:1.5mm;font:700 7.2pt Arial,sans-serif;line-height:1.25;color:#34495e}.statQuestion span{flex:0 0 auto;display:inline-grid;place-items:center;width:5mm;height:5mm;border-radius:50%;background:#e7f5f3;color:#217b77;font-size:6.5pt}.statSummary{margin-top:1.5mm;font:6.8pt Arial,sans-serif;line-height:1.35;color:#4b5563}.statSummary b{color:#3f2b35}.statCount{margin-top:1.2mm;font:700 6.2pt Arial,sans-serif;color:#8b7b84}@media print{html,body{background:white}.page{break-after:page}}
      </style></head><body>${html}<script>
        (async()=>{const imgs=[...document.images];await Promise.all(imgs.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r})));if(document.fonts&&document.fonts.ready){try{await document.fonts.ready}catch(e){}}setTimeout(()=>window.print(),250)})();
      <\/script></body></html>`);
      printWindow.document.close();
    } catch (e: any) {
      const message = e?.message || "Şube PDF çıktısı hazırlanamadı.";
      setError(message);
      try {
        printWindow.document.open();
        printWindow.document.write(`<!doctype html><html><body style="font-family:Arial;padding:32px;color:#b91c1c"><h2>PDF hazırlanamadı</h2><p>${String(message).replace(/[&<>]/g, "")}</p></body></html>`);
        printWindow.document.close();
      } catch {}
    } finally { setPdfBusy(false); }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid gap-3 rounded-3xl border bg-white p-5 shadow-sm md:grid-cols-[150px_minmax(190px,1fr)_130px_190px_190px] md:items-end">
          <label>
            <select aria-label="Sınıf seç" value={classroom} onChange={e => { setClassroom(e.target.value); setTargetId(""); setDetail(null); }} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800">
              <option value="">Sınıf seçin</option>{classrooms.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <select aria-label="Öğrenci seç" value={targetId} disabled={!classroom} onChange={e => setTargetId(e.target.value)} className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-800 disabled:bg-slate-100">
              <option value="">Öğrenci seçin</option>{classStudents.map(s => <option key={s.id} value={s.id}>{s.number ? `${s.number} · ` : ""}{s.name}</option>)}
            </select>
          </label>
          <button type="button" className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-400 px-4 text-sm font-black text-emerald-950 shadow-sm">
            <BookOpen className="h-4 w-4 shrink-0"/>Anket
          </button>
          <button type="button" disabled={saving} onClick={() => void setSystemOpen(!open)} className={`flex h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-black shadow-sm ${open ? "bg-emerald-400 text-emerald-950" : "border border-rose-200 bg-white text-rose-700"}`}>
            {open ? <UnlockKeyhole className="h-5 w-5"/> : <LockKeyhole className="h-5 w-5"/>}{open ? "ÖĞRENCİLERE AÇIK" : "ÖĞRENCİLERE KAPALI"}
          </button>
          <button type="button" disabled={pdfBusy || !classroom || !classStudents.length} onClick={() => void printClassYearbook()} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-violet-700 px-4 text-sm font-black text-white shadow-sm disabled:opacity-50">
            <Download className="h-4 w-4"/>{pdfBusy ? "HAZIRLANIYOR" : classroom ? `${classroom} PDF` : "ŞUBE PDF"}
          </button>
        </section>

        {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div> : null}

        {detail?.target ? <>
          <YearbookSpread
            detail={detail}
            leftPageNo={Math.max(1, classStudents.findIndex(student => student.id === detail.target?.id) * 2 + 1)}
            photoUrl={yearbookPhotos[detail.target.id] || ""}
            onPhotoChange={(file) => {
              const studentId = detail.target?.id;
              if (!studentId || !file) return;
              const nextUrl = URL.createObjectURL(file);
              setYearbookPhotos(prev => {
                const oldUrl = prev[studentId];
                if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
                return { ...prev, [studentId]: nextUrl };
              });
            }}
            onPhotoRemove={() => {
              const studentId = detail.target?.id;
              if (!studentId) return;
              setYearbookPhotos(prev => {
                const oldUrl = prev[studentId];
                if (oldUrl?.startsWith("blob:")) URL.revokeObjectURL(oldUrl);
                const next = { ...prev };
                delete next[studentId];
                return next;
              });
            }}
          />

          <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-5 py-4"><h3 className="text-lg font-black text-slate-900">Sınıf arkadaşlarının düşünceleri</h3><p className="mt-1 text-xs font-semibold text-slate-500">Öğrenciler okul numarasına göre sıralıdır. Kırmızı isimler henüz kayıt yapmayan öğrencileri gösterir.</p></div>
            <div className="divide-y">
              {detail.authors.map(a => <article key={a.id} className="grid gap-3 p-4 md:grid-cols-[220px_1fr]">
                <div><div className={`font-black ${a.submitted ? "text-slate-900" : "text-red-600"}`}>{a.number ? `${a.number} · ` : ""}{a.name}</div><span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-black ${a.submitted ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{a.submitted ? "YAZDI" : "HENÜZ YAZMADI"}</span></div>
                {a.submitted && a.entry ? <div><p className="whitespace-pre-wrap rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm font-medium leading-6 text-slate-700">{a.entry.comment}</p>{a.entry.updatedAt ? <p className="mt-2 text-[10px] font-bold text-slate-400">Son düzenleme: {new Date(a.entry.updatedAt).toLocaleString("tr-TR")}</p> : null}</div> : <div className="rounded-2xl border border-dashed border-red-200 bg-red-50/40 p-3 text-sm font-bold text-red-400">Bu öğrenci henüz düşüncesini yazmadı.</div>}
              </article>)}
            </div>
          </section>
        </> : !loading ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm font-bold text-slate-400">Bir sınıf ve öğrenci seçtiğinizde yıllık kayıtları burada göreceksiniz.</div> : null}
      </div>
    </div>
  );
}

function YearbookSpread({ detail, photoUrl, onPhotoChange, onPhotoRemove, leftPageNo }: { detail: Detail; photoUrl: string; onPhotoChange: (file: File) => void; onPhotoRemove: () => void; leftPageNo: number }) {
  const photoInputRef = React.useRef<HTMLInputElement | null>(null);
  const formatStudentName = (value?: string) => String(value || "").trim().split(/\s+/).filter(Boolean).map(part => {
    const lower = part.toLocaleLowerCase("tr-TR");
    return lower.charAt(0).toLocaleUpperCase("tr-TR") + lower.slice(1);
  }).join(" ");
  const splitStudentName = (value?: string) => {
    const parts = formatStudentName(value).split(/\s+/).filter(Boolean);
    if (parts.length <= 1) return { firstName: parts[0] || "", surname: "" };
    return { firstName: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1] };
  };
  const displayName = splitStudentName(detail.target?.name);
  const entries = detail.authors.filter(author => author.submitted && author.entry && String(author.entry.comment || "").trim());
  const midpoint = Math.ceil(entries.length / 2);
  const pages = [entries.slice(0, midpoint), entries.slice(midpoint)];
  const PageComments = ({ rows }: { rows: AuthorStatus[]; compact?: boolean }) => (
    <div className="content-start">
      {rows.filter(author => String(author.entry?.comment || "").trim()).map(author => <p key={author.id} className="mb-[10px] whitespace-pre-wrap font-serif text-[10pt] leading-[1.35] text-[#453b32]">
        <span className="mr-1.5 font-bold text-[#3f2b35]">{formatStudentName(author.name)}</span>
        <span className="font-normal">{author.entry?.comment}</span>
      </p>)}
    </div>
  );

  return <section className="overflow-hidden rounded-3xl border border-amber-200 bg-[#e9dfcf] p-2 shadow-sm">
    <div className="overflow-x-auto">
      <div className="mx-auto grid min-w-[820px] max-w-[1180px] grid-cols-2 gap-0 bg-transparent p-0 shadow-2xl">
        <article className="relative aspect-[210/297] overflow-hidden bg-center" style={{ backgroundImage: `url(${yearbookLeftPage})`, backgroundSize: "100% 100%" }}>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) onPhotoChange(file); e.currentTarget.value = ""; }} />

          <div className="absolute z-[20]" style={{ left: "1.5cm", top: "2cm", width: "5.5cm", aspectRatio: "780 / 1024" }}>
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="absolute z-[10] overflow-hidden bg-slate-50 outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              style={{ left: "10.77%", top: "8.59%", width: "78.08%", height: "67.38%" }}
              title="Öğrenci fotoğrafı yükle"
            >
              {photoUrl ? <img src={photoUrl} alt={`${detail.target?.name || "Öğrenci"} fotoğrafı`} className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-white/65 px-3 text-center text-[9px] font-bold leading-4 text-slate-400">Fotoğraf yüklemek için tıklayın</span>}
            </button>
            <img src={studentPhotoFrame} alt="" className="pointer-events-none absolute inset-0 z-[20] h-full w-full select-none object-fill" />
            <div className="pointer-events-none absolute z-[30] left-[11%] right-[11%] bottom-[1.8%] flex h-[16.8%] flex-col items-center justify-center text-center text-white">
              <div className="max-w-full break-words font-normal leading-[.95]" style={{ fontFamily: '"Great Vibes", cursive', fontSize: "16pt" }}>{detail.target?.number ? `${detail.target.number} - ` : ""}{displayName.firstName}</div>
              {displayName.surname ? <div className="mt-1 max-w-full break-words font-normal leading-[.95]" style={{ fontFamily: '"Great Vibes", cursive', fontSize: "17pt" }}>{displayName.surname}</div> : null}
            </div>
            {photoUrl ? <button type="button" onClick={onPhotoRemove} className="absolute -right-2 -top-2 z-[40] flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-white text-sm font-black text-rose-600 shadow-md hover:bg-rose-50" title="Yerleştirilen fotoğrafı kaldır" aria-label="Yerleştirilen fotoğrafı kaldır">×</button> : null}
          </div>

          <div className="absolute z-[30] left-[9%] right-[7%] top-[39%] bottom-[6%] overflow-hidden">
            <PageComments rows={pages[0]} />
          </div>
          <div className="absolute bottom-[2.4%] left-[4.8%] z-[40] flex h-7 min-w-10 items-center justify-center rounded-full border border-slate-300/70 bg-white/75 px-3 font-serif text-[10px] font-bold text-slate-500">{leftPageNo}</div>
        </article>
        <article className="relative aspect-[210/297] overflow-hidden border-l border-dashed border-slate-300 bg-center" style={{ backgroundImage: `url(${yearbookRightPage})`, backgroundSize: "100% 100%" }}>
          <div className="absolute left-[7%] right-[9%] top-[7%] bottom-[6%] overflow-hidden">
            <PageComments rows={pages[1]} />
          </div>
          <div className="absolute bottom-[2.4%] right-[4.8%] z-[40] flex h-7 min-w-10 items-center justify-center rounded-full border border-slate-300/70 bg-white/75 px-3 font-serif text-[10px] font-bold text-slate-500">{leftPageNo + 1}</div>
        </article>
      </div>
    </div>
  </section>;
}
