import React, { useEffect, useMemo, useState } from 'react';
import { Check, FileText, Plus, Save, Search, Trash2 } from 'lucide-react';
import { sqliteStorage } from '../../core/state/SyncStateStore';

const steps = ['Olay ve Davranış', 'Öğrenci', 'Soruşturma Süreci', 'Toplantı ve Karar', 'Evraklar'] as const;
const sanctions = ['Kınama', 'Okuldan kısa süreli uzaklaştırma', 'Okul değiştirme', 'Örgün eğitim dışına çıkarma'] as const;
type Person = { name: string; detail: string; statement?: string };
// Ortak olay bilgilerinden bağımsız, her öğrenciye özel disiplin değerlendirmesi.
type AccusedStudent = {
  id: string; studentId: string; studentName: string; studentClass: string; studentNumber: string; birthDate: string;
  parentName: string; parentAddress: string; sanction: string; behaviorId: string; behaviorIds?: string[];
  sameYearRepeat: boolean; lowerSanction: boolean; accusedStatement: string;
  rationale: string; voting: 'unanimous' | 'majority'; decisionNumber: string; informationReports: InformationReport[];
};
const subjectFields = ['studentId', 'studentName', 'studentClass', 'studentNumber', 'birthDate', 'parentName', 'parentAddress', 'sanction', 'behaviorId', 'behaviorIds', 'sameYearRepeat', 'lowerSanction', 'accusedStatement', 'rationale', 'voting', 'decisionNumber', 'informationReports'] as const;
const blankAccused = (id: string): AccusedStudent => ({
  id, studentId: '', studentName: '', studentClass: '', studentNumber: '', birthDate: '', parentName: '', parentAddress: '',
  sanction: 'Kınama', behaviorId: '', behaviorIds: [], sameYearRepeat: false, lowerSanction: false,
  accusedStatement: '', rationale: '', voting: 'unanimous', decisionNumber: '', informationReports: [],
});
const readAccused = (workflow: Workflow): AccusedStudent[] => {
  if (Array.isArray(workflow.accusedStudents) && workflow.accusedStudents.length) return workflow.accusedStudents.map(person => ({
    ...person, behaviorIds: Array.isArray(person.behaviorIds) && person.behaviorIds.length ? person.behaviorIds : (person.behaviorId ? [person.behaviorId] : []),
  }));
  const person = blankAccused('ilk-ogrenci');
  const previous = { ...person, ...Object.fromEntries(subjectFields.map(key => [key, workflow[key] ?? person[key]])) } as AccusedStudent;
  previous.behaviorIds = Array.isArray(previous.behaviorIds) && previous.behaviorIds.length ? previous.behaviorIds : (previous.behaviorId ? [previous.behaviorId] : []);
  return [previous];
};
const switchToAccused = (workflow: Workflow, id: string): Workflow => {
  const subjects = readAccused(workflow);
  const selected = subjects.find(item => item.id === id);
  if (!selected) return workflow;
  return { ...workflow, accusedStudents: subjects, selectedAccusedId: id,
    ...Object.fromEntries(subjectFields.map(key => [key, selected[key]])) } as Workflow;
};

type InformationKind = 'studentFriend' | 'studentIncident' | 'teacher' | 'counselor';
type InformationReport = { id: string; kind: InformationKind; authorName: string; authorDetail: string; date: string; answers: Record<string, string> };
const informationTemplates: Record<InformationKind, { title: string; description: string; label: string; fields: string[] }> = {
  studentFriend: { title: 'Öğrenci – Arkadaşı Hakkında', description: 'Öğrencinin arkadaşının davranışları hakkındaki görüşleri', label: 'Bilgi veren öğrenci', fields: ['Dersteki Davranışları', 'Teneffüslerdeki Davranışları', 'Okul Dışındaki Davranışları'] },
  studentIncident: { title: 'Öğrenci – Olay Hakkında', description: 'Öğrencinin olayla ilgili bilgileri ve arkadaşı hakkındaki görüşleri', label: 'Bilgi veren öğrenci', fields: ['Konu İle İlgili Bilgilerim', 'Arkadaşım Hakkındaki Görüşlerim'] },
  teacher: { title: 'Öğretmen Görüşü', description: 'Öğretmenin öğrencinin ders ve sosyal yaşantısına ilişkin görüşleri', label: 'Bilgi veren öğretmen', fields: ['Dersimdeki Tutumu', 'Ders Dışı Faaliyetleri', 'Arkadaşları İle İlişkisi'] },
  counselor: { title: 'Rehber Öğretmen Görüşü', description: 'Rehber öğretmenin kişisel ve sosyal özelliklere ilişkin görüşleri', label: 'Bilgi veren rehber öğretmen', fields: ['Kişisel Özellikleri', 'Sosyal Özellikleri'] },
};
type Workflow = {
  accusedStudents?: AccusedStudent[]; selectedAccusedId?: string;
  district: string; school: string; principal: string; chairTitle: string; documentNumber: string;
  chair: string; members: { name: string; title: string }[];
  studentId: string; studentName: string; studentClass: string; studentNumber: string; birthDate: string;
  parentName: string; parentAddress: string;
  incidentDate: string; incidentPlace: string; reporter: string; incidentSummary: string;
  sanction: string; behaviorId: string; behaviorIds?: string[]; sameYearRepeat: boolean; lowerSanction: boolean;
  statementDate: string; statementTime: string; statementPlace: string;
  victim: Person; victimStatement: string; accusedStatement: string; additionalVictims: (Person & { statement: string })[]; witnesses: Person[];
  informationReports?: InformationReport[];
  meetingDate: string; meetingTime: string; decisionNumber: string; voting: 'unanimous' | 'majority'; rationale: string;
};
const empty: Workflow = {
  district: 'Altınordu', school: 'Ordu Lisesi', principal: 'Hasan BÖLÜK', chairTitle: 'Müdür Yardımcısı', documentNumber: '',
  chair: '', members: [
    { name: '', title: 'Öğretmen' }, { name: '', title: 'Öğretmen' },
    { name: '', title: 'Okul Aile Birliği Üyesi' }, { name: '', title: 'Onur Kurulu İkinci Başkanı' },
  ],
  studentId: '', studentName: '', studentClass: '', studentNumber: '', birthDate: '', parentName: '', parentAddress: '',
  incidentDate: '', incidentPlace: '', reporter: '', incidentSummary: '', sanction: 'Kınama', behaviorId: '', behaviorIds: [], sameYearRepeat: false, lowerSanction: false,
  statementDate: '', statementTime: '10:00', statementPlace: 'Müdür yardımcısı odası', victim: { name: '', detail: '' }, victimStatement: '', accusedStatement: '', additionalVictims: [], witnesses: [],
  informationReports: [], meetingDate: '', meetingTime: '14:00', decisionNumber: '', voting: 'unanimous', rationale: '',
};
const STORAGE = 'enstitu-behavior-discipline-wizard-v1';
const controlClass = 'w-full h-10 rounded-lg border border-amber-200 bg-yellow-50 px-3 text-[13px] outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100';
// Kurulun tek kaynağı Kurul ve Komisyonlar bölümündeki okul öğrenci ödül ve disiplin kurulu kaydıdır.
// Kaydı düzenlemek için ikinci bir form oluşturulmaz.
const DISCIPLINE_COMMITTEE_ID = 'BOARD-STUDENT-AWARD-DISCIPLINE';
const normalizeBoardName = (name: unknown) => String(name || '').toLocaleLowerCase('tr-TR').replace(/[^a-zçğıöşü0-9]+/g, ' ').trim();
type DisciplineBoardPerson = { name: string; title: string };
type DisciplineBoardInfo = {
  chair: string;
  chairTitle: string;
  members: DisciplineBoardPerson[];
  principal: string;
  school: string;
  district: string;
  found: boolean;
};
const readDisciplineBoard = (): DisciplineBoardInfo => {
  const blank = { chair: '', chairTitle: 'Müdür Yardımcısı', members: [] as DisciplineBoardPerson[], principal: '', school: '', district: '', found: false };
  try {
    const raw = sqliteStorage.getItem('school_committees');
    const committees = raw ? JSON.parse(raw) : [];
    const board = Array.isArray(committees) ? committees.find((entry: any) =>
      entry?.id === DISCIPLINE_COMMITTEE_ID || normalizeBoardName(entry?.name) === normalizeBoardName('Okul Öğrenci Ödül ve Disiplin Kurulu')) : null;
    const setup = board?.disciplineBoard;
    const chair = String(setup?.presidentName || board?.presidentName || '').trim();
    const members: DisciplineBoardPerson[] = [];
    if (Array.isArray(setup?.teacherNames)) for (const name of setup.teacherNames) if (String(name || '').trim()) members.push({ name: String(name).trim(), title: 'Öğretmen Üye' });
    if (setup?.honorVicePresident?.name) members.push({ name: String(setup.honorVicePresident.name), title: 'Onur Kurulu İkinci Başkanı' });
    if (setup?.parentAssociationMemberName) members.push({ name: String(setup.parentAssociationMemberName), title: 'Okul Aile Birliği Veli Üyesi' });
    if (!members.length && Array.isArray(board?.members)) for (const m of board.members) if (m?.teacherName) members.push({ name: String(m.teacherName), title: String(m.role || 'Üye') });
    // Müdür adı, kurul kaydında ayrı bir alan değildir; uygulamanın mevcut Okul Bilgileri kaydından alınır.
    const schoolRaw = sqliteStorage.getItem('school_info_a_profile');
    const schoolInfo = schoolRaw ? JSON.parse(schoolRaw) : {};
    return {
      ...blank, chair, members, found: Boolean(board),
      principal: String(schoolInfo?.principalName || '').trim(),
      school: String(schoolInfo?.officialName || '').trim(),
      district: String(schoolInfo?.instLine2 || '').trim(),
    };
  } catch { return blank; }
};

const sectionClass = 'rounded-xl border border-slate-200 bg-white p-4 space-y-3';

export type DisciplineBehaviorChoice = { id: string; name: string; sanctionType?: string; article?: string; content?: string; type?: string };
export default function DisciplineSixStepWizard({ students = [], behaviors = [], readOnly = false }: {
  students?: any[]; behaviors?: DisciplineBehaviorChoice[]; readOnly?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [statementTab, setStatementTab] = useState<'call' | 'collect' | 'defense'>('call');
  const [data, setData] = useState<Workflow>(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      const workflow = raw ? { ...empty, ...JSON.parse(raw) } as Workflow : { ...empty };
      const subjects = readAccused(workflow);
      return switchToAccused({ ...workflow, accusedStudents: subjects },
        subjects.some(s => s.id === workflow.selectedAccusedId) ? String(workflow.selectedAccusedId) : subjects[0].id);
    } catch { return switchToAccused({ ...empty }, 'ilk-ogrenci'); }
  });
  const [board, setBoard] = useState<DisciplineBoardInfo>(readDisciplineBoard);
  useEffect(() => {
    const refresh = () => setBoard(readDisciplineBoard());
    window.addEventListener('school_committees_updated', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('school_committees_updated', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);
  const [saved, setSaved] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentSuggestions, setStudentSuggestions] = useState(false);
  const [personSearch, setPersonSearch] = useState<Record<string, string>>({});
  const [activePersonSearch, setActivePersonSearch] = useState<string | null>(null);
  const [selectedVictimIndex, setSelectedVictimIndex] = useState(0);
  const [behaviorQuery, setBehaviorQuery] = useState('');
  const [reportSearch, setReportSearch] = useState<Record<string, string>>({});
  const set = <K extends keyof Workflow>(key: K, value: Workflow[K]) => {
    setData(previous => {
      const next = { ...previous, [key]: value };
      if ((subjectFields as readonly string[]).includes(String(key))) {
        next.accusedStudents = readAccused(previous).map(item => item.id === previous.selectedAccusedId ? { ...item, [key]: value } : item);
      }
      return next;
    });
    setSaved(false);
  };
  const chooseAccused = (id: string) => { setData(previous => switchToAccused(previous, id)); setStudentQuery(''); setStudentSuggestions(false); };
  const addAccused = () => {
    const id = `ogrenci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setData(previous => switchToAccused({ ...previous, accusedStudents: [...readAccused(previous), blankAccused(id)] }, id));
    setStudentQuery(''); setStudentSuggestions(false); setSaved(false);
  };
  const removeAccused = (id: string) => {
    if (!window.confirm('Seçilen öğrencinin ifade, davranış ve karar taslağı dahil bu olay içindeki bilgileri kaldırılacak. Onaylıyor musunuz?')) return;
    setData(previous => {
      let subjects = readAccused(previous).filter(s => s.id !== id);
      if (!subjects.length) subjects = [blankAccused(`ogrenci-${Date.now()}`)];
      return switchToAccused({ ...previous, accusedStudents: subjects },
        previous.selectedAccusedId === id ? subjects[0].id : String(previous.selectedAccusedId));
    });
    setSaved(false);
  };
  const save = () => {
    const numbers = readAccused(data).map(person => person.studentNumber.trim()).filter(Boolean);
    if (new Set(numbers).size !== numbers.length) { window.alert('Aynı okul numarası bir olay dosyasına iki defa eklenemez.'); return; }
    try { localStorage.setItem(STORAGE, JSON.stringify(data)); setSaved(true); }
    catch { window.alert('Kayıt yapılamadı. Tarayıcı depolama iznini kontrol edin.'); }
  };
  const saveButton = () => (
    <button type="button" disabled={readOnly} onClick={save}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
      title={saved ? 'Taslak kaydedildi' : 'Değişiklikleri kaydet'}>
      <Save size={14}/> Kaydet
    </button>
  );
  // Mağdur ve tanık seçimi, ana modülden gelen güncel öğrenci listesine dayanır.
  const studentName = (s: any) => String(s.fullName || s.name || [s.firstName, s.lastName].filter(Boolean).join(' ') || '').trim();
  const studentNumber = (s: any) => String(s.number || s.schoolNumber || s.studentNumber || '').trim();
  const studentClass = (s: any) => String(s.classroom || s.className || s.classSection || s.class || '').trim();
  const studentMatches = useMemo(() => {
    const q = studentQuery.trim().toLocaleLowerCase('tr-TR');
    if (!q) return [];
    if (/^\d+$/.test(q)) {
      const exact = students.filter(s => studentNumber(s).trim() === q);
      if (exact.length) return exact.slice(0, 12);
    }
    return students.filter(s => `${s.fullName || s.name || ''} ${s.number || s.schoolNumber || ''}`.toLocaleLowerCase('tr-TR').includes(q)).slice(0, 12);
  }, [students, studentQuery]);
  const normalizedSanction = (s: string) => {
    const v = String(s || '').toLocaleLowerCase('tr-TR');
    if (v.includes('kınama')) return sanctions[0];
    if (v.includes('kısa süreli')) return sanctions[1];
    if (v.includes('değiştir')) return sanctions[2];
    if (v.includes('örgün') || v.includes('çıkarma')) return sanctions[3];
    return '';
  };
  const choices = useMemo(() => behaviors.filter(b => b.type !== 'Olumlu' && b.type !== 'Gözlem'), [behaviors]);
  const filteredChoices = choices.filter(b => normalizedSanction(b.sanctionType || '') === data.sanction && `${b.name} ${b.content || ''}`.toLocaleLowerCase('tr-TR').includes(behaviorQuery.toLocaleLowerCase('tr-TR')));
  const selectedBehaviorIds = Array.isArray(data.behaviorIds) && data.behaviorIds.length ? data.behaviorIds : (data.behaviorId ? [data.behaviorId] : []);
  const selectedBehaviors = choices.filter(b => selectedBehaviorIds.includes(String(b.id)));
  const chosen = selectedBehaviors[0];
  const toggleBehavior = (id: string) => {
    const nextIds = selectedBehaviorIds.includes(id) ? selectedBehaviorIds.filter(value => value !== id) : [...selectedBehaviorIds, id];
    setData(previous => {
      const next = { ...previous, behaviorIds: nextIds, behaviorId: nextIds[0] || '' };
      next.accusedStudents = readAccused(previous).map(person => person.id === previous.selectedAccusedId
        ? { ...person, behaviorIds: nextIds, behaviorId: nextIds[0] || '' } : person);
      return next;
    });
    setSaved(false);
  };
  const clearBehaviors = () => {
    setData(previous => {
      const next = { ...previous, behaviorIds: [], behaviorId: '' };
      next.accusedStudents = readAccused(previous).map(person => person.id === previous.selectedAccusedId
        ? { ...person, behaviorIds: [], behaviorId: '' } : person);
      return next;
    });
    setSaved(false);
  };
  const field = (label: string, key: keyof Workflow, placeholder = '', type = 'text') => (
    <label className="block min-w-0 space-y-1 text-xs font-semibold text-slate-600" key={String(key)}>
      <span>{label}</span>
      <input disabled={readOnly} type={type} value={String(data[key] ?? '')} placeholder={placeholder} onChange={e => set(key, e.target.value as never)} className={controlClass} />
    </label>
  );
  const multiline = (label: string, key: keyof Workflow, placeholder: string, rows = 3) => (
    <label className="block space-y-1 text-xs font-semibold text-slate-600">
      <span>{label}</span>
      <textarea disabled={readOnly} rows={rows} value={String(data[key] || '')} onChange={e => set(key, e.target.value as never)} placeholder={placeholder} className={`${controlClass} h-auto min-h-20 py-2 resize-y`} />
    </label>
  );
  const redHeadings = new Set(['İfadeye çağrı', 'Mağdur öğrencilerin çağrı pusulaları (varsa)', 'Tanık öğrencilerin çağrı pusulaları (varsa)', 'Mağdur öğrencilerin ifadeleri (varsa)', 'Hakkında işlem yapılan öğrencinin ifadesi', 'Tanık öğrencilerin ifadeleri', 'Öğrencilerden Bilgi Toplama', 'Öğretmenlerden Bilgi Toplama', 'Kurul toplantısı', 'Karar', 'Hakkında işlem yapılan öğrenci', 'Davranış — yönetmelikteki karşılığı']);
  const heading = (emoji: string, title: string, note?: string) => <div className="space-y-1"><h3 className={`text-sm font-bold ${redHeadings.has(title) ? 'text-red-600' : 'text-slate-900'}`}>{emoji} {title}</h3>{note && <p className="text-xs leading-5 text-slate-500">{note}</p>}</div>;
  const personInput = (person: Person, key: keyof Person, val: string, kind: 'victim' | 'witness', index = 0) => {
    const next = { ...person, [key]: val };
    if (kind === 'victim') {
      if (index === 0) set('victim', next);
      else set('additionalVictims', (data.additionalVictims || []).map((v, i) => i === index - 1 ? { ...v, [key]: val } : v));
    }
    else set('witnesses', data.witnesses.map((w, i) => i === index ? next : w));
  };
  const selectPersonStudent = (kind: 'victim' | 'witness', index: number, student: any) => {
    const name = studentName(student);
    const detail = [studentClass(student), studentNumber(student)].filter(Boolean).join(' - ');
    if (kind === 'victim') {
      if (index === 0) set('victim', { name, detail });
      else set('additionalVictims', (data.additionalVictims || []).map((v, i) => i === index - 1 ? { ...v, name, detail } : v));
    } else set('witnesses', data.witnesses.map((w, i) => i === index ? { ...w, name, detail } : w));
    const searchKey = `${kind}-${index}`;
    setPersonSearch(prev => ({ ...prev, [searchKey]: '' }));
    setActivePersonSearch(null);
  };
  const personStudentSearch = (kind: 'victim' | 'witness', index: number) => {
    const searchKey = `${kind}-${index}`;
    const query = (personSearch[searchKey] || '').trim().toLocaleLowerCase('tr-TR');
    const exactNumberMatches = /^\d+$/.test(query) ? students.filter(s => studentNumber(s) === query) : [];
    const matching = exactNumberMatches.length ? exactNumberMatches.slice(0, 12) : query ? students.filter(s => `${studentName(s)} ${studentNumber(s)} ${studentClass(s)}`.toLocaleLowerCase('tr-TR').includes(query)).slice(0, 12) : [];
    return <div className="relative space-y-1">
      <label className="block text-xs font-semibold text-slate-600" htmlFor={`person-search-${searchKey}`}>Sistemden öğrenci ara</label>
      <div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-500" />
        <input id={`person-search-${searchKey}`} disabled={readOnly} className={`${controlClass} pl-9`} value={personSearch[searchKey] || ''}
          placeholder="Ad, soyad veya okul numarasıyla ara"
          onFocus={() => setActivePersonSearch(searchKey)}
          onChange={e => { setPersonSearch(prev => ({ ...prev, [searchKey]: e.target.value })); setActivePersonSearch(searchKey); }}
          onKeyDown={e => { if (e.key === 'Escape') setActivePersonSearch(null); if (e.key === 'Enter' && matching.length === 1) { e.preventDefault(); selectPersonStudent(kind, index, matching[0]); } }} />
      </div>
      {activePersonSearch === searchKey && query && <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
        {matching.length ? matching.map((s, i) => <button key={`${studentNumber(s)}-${i}`} type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-amber-50"
          onClick={() => selectPersonStudent(kind, index, s)}>{studentName(s)} · {studentClass(s)} · {studentNumber(s)}</button>)
          : <p className="p-3 text-xs text-slate-500">Eşleşen öğrenci bulunamadı.</p>}
      </div>}
    </div>;
  };
  const updateStudent = (s: any) => {
    const record = {
      studentId: String(s.id || ''), studentName: studentName(s), studentClass: studentClass(s),
      studentNumber: studentNumber(s), birthDate: String(s.birthDate || ''),
    };
    setData(previous => {
      const subjects = readAccused(previous);
      // Aynı öğrenci daha önce eklenmişse yeni kayıt açmadan onun kartına geç.
      const existing = subjects.find(person =>
        (record.studentId && person.studentId === record.studentId) ||
        (record.studentNumber && person.studentNumber === record.studentNumber));
      if (existing) return switchToAccused(previous, existing.id);

      const selected = subjects.find(person => person.id === previous.selectedAccusedId);
      // Dolu öğrenci kartına başka bir öğrenci yazmak ilk kaydı siler.
      // Bu nedenle önceki kart korunur ve ikinci öğrenci için yeni kart açılır.
      const hasStudent = Boolean(selected && (selected.studentId || selected.studentName.trim() || selected.studentNumber.trim()));
      if (hasStudent) {
        const id = `ogrenci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const added = { ...blankAccused(id), ...record };
        return switchToAccused({ ...previous, accusedStudents: [...subjects, added] }, id);
      }
      const updated = subjects.map(person => person.id === previous.selectedAccusedId ? { ...person, ...record } : person);
      return switchToAccused({ ...previous, accusedStudents: updated }, String(previous.selectedAccusedId || updated[0].id));
    });
    setStudentQuery(''); setStudentSuggestions(false); setSaved(false);
  };
  const reports = data.informationReports || [];
  const addReport = (kind: InformationKind) => {
    const report: InformationReport = { id: `${Date.now()}-${reports.length}`, kind, authorName: '', authorDetail: '', date: '', answers: {} };
    set('informationReports', [...reports, report]);
  };
  const patchReport = (id: string, patch: Partial<InformationReport>) => set('informationReports', reports.map(r => r.id === id ? { ...r, ...patch } : r));
  const pdfInformation = async (report: InformationReport) => {
    if (!data.studentName.trim()) { window.alert('Önce Öğrenci adımından hakkında işlem yapılan öğrenciyi seçiniz.'); return; }
    if (!report.authorName.trim()) { window.alert('Önce bilgi veren kişinin adını giriniz.'); return; }
    setPdfBusy(`info-${report.id}`);
    try {
      const pdfModule = await import('pdfmake/build/pdfmake');
      const fontModule = await import('pdfmake/build/vfs_fonts');
      const pdfMake: any = (pdfModule as any).default || pdfModule;
      pdfMake.vfs = (fontModule as any).default?.pdfMake?.vfs || (fontModule as any).default || (fontModule as any).pdfMake?.vfs || fontModule;
      const template = informationTemplates[report.kind];
      const printable = (value: unknown) => String(value ?? '').trim() || '................................................................';
      const fmtDate = (value: string) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('.') : (value || '.... / .... / ........');
      const teacher = report.kind === 'teacher' || report.kind === 'counselor';
      const content: any[] = [
        { text: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU BİLGİ TOPLAMA FORMU', alignment: 'center', bold: true, margin: [0, 0, 0, 24] },
        { text: `Okul ödül ve disiplin kurulunda görüşülmesi için gönderilen ${printable(data.studentClass)} sınıfı ${printable(data.studentNumber)} numaralı öğrencisi ${printable(data.studentName)} hakkında ${report.kind === 'studentIncident' ? 'öğrenci ve olayla ilgili bilgi ve görüşlerinizi' : report.kind === 'studentFriend' ? 'arkadaşınız hakkındaki görüşlerinizi' : teacher ? 'öğrenci hakkındaki görüşlerinizi' : 'görüşlerinizi'} aşağıya yazmanızı rica ederim.`, alignment: 'justify', lineHeight: 1.25 },
        { text: `${fmtDate(report.date)}\n${printable(board.chair)}\nÖdül ve Disiplin Kurulu Başkanı\n${printable(board.chairTitle)}`, alignment: 'right', margin: [0, 14, 0, 24] },
        { text: teacher ? (report.kind === 'counselor' ? 'Rehber Öğretmen Bilgileri' : 'Öğretmen Bilgileri') : 'Öğrenci Bilgileri', bold: true, decoration: 'underline', margin: [0, 0, 0, 12] },
        { text: `Adı Soyadı  : ${printable(report.authorName)}`, margin: [0, 0, 0, 7] },
        { text: `${teacher ? 'Branşı / Görevi' : 'Sınıfı ve Okul Numarası'}  : ${printable(report.authorDetail)}`, margin: [0, 0, 0, 24] },
        { text: report.kind === 'studentFriend' || report.kind === 'studentIncident' ? 'Arkadaşım Hakkındaki Görüşlerim' : 'Öğrenci Hakkındaki Görüşlerim', bold: true, decoration: 'underline', margin: [0, 0, 0, 14] },
        ...template.fields.flatMap(field => [
          { text: `${field}:`, bold: true, margin: [0, 0, 0, 6] },
          { text: printable(report.answers?.[field]), lineHeight: 1.35, margin: [0, 0, 0, 20] },
        ]),
        { text: `Tarih   : ${fmtDate(report.date)}\n\nİmza    : ................................................`, margin: [0, 16, 0, 0] },
      ];
      const documentDefinition: any = { pageSize: 'A4', pageOrientation: 'portrait', pageMargins: [55, 60, 55, 55], defaultStyle: { font: 'Roboto', fontSize: 12, color: '#111111', lineHeight: 1.15 }, content };
      pdfMake.createPdf(documentDefinition).download(`Bilgi_Toplama_${report.kind}_${report.id}.pdf`);
    } catch (error) {
      console.error('Bilgi toplama PDF hazırlanamadı:', error);
      window.alert('PDF hazırlanamadı. PDF kütüphanesini kontrol ediniz.');
    } finally { setPdfBusy(null); }
  };
  const reportEditor = (report: InformationReport) => {
    const template = informationTemplates[report.kind];
    const isStudent = report.kind === 'studentFriend' || report.kind === 'studentIncident';
    const query = (reportSearch[report.id] || '').trim().toLocaleLowerCase('tr-TR');
    const matches = query ? students.filter(s => `${studentName(s)} ${studentNumber(s)} ${studentClass(s)}`.toLocaleLowerCase('tr-TR').includes(query)).slice(0, 12) : [];
    return <div key={report.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1"><h4 className="text-xs font-bold text-slate-800">{template.title}</h4><p className="text-[11px] text-slate-500">{template.description}</p></div>
        <div className="flex items-center gap-2">{saveButton()}<button type="button" disabled={pdfBusy !== null} onClick={() => void pdfInformation(report)} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"><FileText size={14}/> {pdfBusy === `info-${report.id}` ? 'Hazırlanıyor...' : 'PDF'}</button><button type="button" disabled={readOnly} aria-label="Bilgi toplama formunu kaldır" onClick={() => set('informationReports', reports.filter(r => r.id !== report.id))} className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-40"><Trash2 size={14}/></button></div>
      </div>
      {isStudent && <div className="relative space-y-1"><label className="text-xs font-semibold text-slate-600">Sistemden bilgi veren öğrenciyi ara</label><div className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-slate-500"/><input disabled={readOnly} className={`${controlClass} pl-9`} value={reportSearch[report.id] || ''} placeholder="Ad soyad veya okul numarası" onChange={e => setReportSearch(p => ({ ...p, [report.id]: e.target.value }))}/></div>
        {query && <div className="absolute z-30 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">{matches.length ? matches.map((s, index) => <button key={`${studentNumber(s)}-${index}`} type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-yellow-50" onClick={() => { patchReport(report.id, { authorName: studentName(s), authorDetail: [studentClass(s), studentNumber(s)].filter(Boolean).join(' - ') }); setReportSearch(p => ({ ...p, [report.id]: '' })); }}>{studentName(s)} · {studentClass(s)} · {studentNumber(s)}</button>) : <p className="p-3 text-xs text-slate-500">Eşleşen öğrenci bulunamadı.</p>}</div>}
      </div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="space-y-1 text-xs font-semibold text-slate-600"><span>{template.label} – Adı soyadı</span><input disabled={readOnly} className={controlClass} value={report.authorName} onChange={e => patchReport(report.id, { authorName: e.target.value })} placeholder="Ad Soyad"/></label><label className="space-y-1 text-xs font-semibold text-slate-600"><span>{isStudent ? 'Sınıf / okul numarası' : 'Branşı / görevi'}</span><input disabled={readOnly} className={controlClass} value={report.authorDetail} onChange={e => patchReport(report.id, { authorDetail: e.target.value })} placeholder={isStudent ? '11/A - 123' : 'Matematik Öğretmeni'}/></label><label className="space-y-1 text-xs font-semibold text-slate-600"><span>Form tarihi</span><input disabled={readOnly} type="date" className={controlClass} value={report.date} onChange={e => patchReport(report.id, { date: e.target.value })}/></label></div>
      {template.fields.map(field => <label key={field} className="block space-y-1 text-xs font-semibold text-slate-600"><span>{field}</span><textarea disabled={readOnly} rows={3} className={`${controlClass} h-auto min-h-20 resize-y py-2`} value={report.answers?.[field] || ''} placeholder="Bilgi veren kişinin kendi görüşlerini yazınız." onChange={e => patchReport(report.id, { answers: { ...report.answers, [field]: e.target.value } })}/></label>)}
    </div>;
  };
  const pdfButton = (kind: 'call' | 'victimCall' | 'witnessCall' | 'victim' | 'accused' | 'witness', personIndex = 0) => (
    <span className="inline-flex shrink-0 items-center gap-2">{saveButton()}
    <button type="button" disabled={pdfBusy !== null} onClick={() => void downloadPdf(kind, personIndex)}
      className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
      title={`${kind === 'call' ? 'Çağrı pusulasını' : kind === 'victimCall' ? 'Mağdur öğrenci çağrı pusulasını' : kind === 'witnessCall' ? 'Tanık öğrenci çağrı pusulasını' : kind === 'victim' ? 'Mağdur öğrenci ifadesini' : kind === 'accused' ? 'Hakkında işlem yapılan öğrenci ifadesini' : 'Tanık öğrenci ifadesini'} PDF indir`}>
      <FileText size={15} /> {pdfBusy === `${kind}-${personIndex}` ? 'Hazırlanıyor...' : 'PDF'}
    </button></span>
  );
  const downloadPdf = async (kind: 'call' | 'victimCall' | 'witnessCall' | 'victim' | 'accused' | 'witness', personIndex = 0) => {
    const victim = personIndex === 0 ? { ...data.victim, statement: data.victimStatement } : (data.additionalVictims || [])[personIndex - 1];
    const witness = data.witnesses[personIndex];
    const name = kind === 'accused' || kind === 'call' ? data.studentName : kind === 'victim' || kind === 'victimCall' ? victim?.name : witness?.name;
    const detail = kind === 'accused' || kind === 'call' ? [data.studentClass, data.studentNumber].filter(Boolean).join(' / ') : kind === 'victim' || kind === 'victimCall' ? victim?.detail : witness?.detail;
    const statement = kind === 'accused' ? data.accusedStatement : kind === 'victim' ? victim?.statement : witness?.statement;
    if (!name?.trim()) {
      window.alert('Belge için önce ilgili öğrenciyi Çağrı Pusulası bölümünden seçiniz.');
      return;
    }
    setPdfBusy(`${kind}-${personIndex}`);
    try {
      const pdfModule = await import('pdfmake/build/pdfmake');
      const fontModule = await import('pdfmake/build/vfs_fonts');
      const pdfMake: any = (pdfModule as any).default || pdfModule;
      const fonts = (fontModule as any).default?.pdfMake?.vfs || (fontModule as any).default || (fontModule as any).pdfMake?.vfs || fontModule;
      pdfMake.vfs = fonts;
      const val = (v: unknown) => String(v ?? '').trim() || '........................................';
      const date = (v: string) => {
        if (!v) return '.... / .... / ........';
        const parts = v.split('-');
        return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : v;
      };
      const line = (label: string, value: unknown, space = 7): any => ({
        columns: [{ text: label, width: 195, bold: true }, { text: ':', width: 12 }, { text: val(value), width: '*' }],
        margin: [0, 0, 0, space],
      });
      const title = (v: string): any => ({ text: v, bold: true, alignment: 'center', margin: [0, 0, 0, 21] });
      const subheading = (v: string): any => ({ text: v, bold: true, alignment: 'center', margin: [0, 17, 0, 13] });
      const chairSignature: any = { text: `${date(data.statementDate)}\n${val(board.chair)}\nÖdül ve Disiplin Kurulu Başkanı\n${val(board.chairTitle)}`, alignment: 'right', margin: [0, 18, 0, 29] };
      const statementAt = `${date(data.statementDate)}  ${val(data.statementTime)}  /  ${val(data.statementPlace)}`;
      const isCall = kind === 'call' || kind === 'victimCall' || kind === 'witnessCall';
      const callRole = kind === 'victimCall' ? 'mağdur öğrenci' : kind === 'witnessCall' ? 'tanık öğrenci' : 'hakkında işlem yapılan öğrenci';
      const content: any[] = isCall ? [
        title('OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU ÇAĞRI PUSULASI'),
        line('ADI SOYADI', name),
        line('DOĞUM TARİHİ', kind === 'call' ? date(data.birthDate) : ''),
        line('DÖNEMİ, OKUL NUMARASI', detail),
        line('ALANI / DALI', ''),
        line('TOPLANTI TARİHİ, SAATİ', statementAt, 23),
        { text: `Olayla ilgili olarak ${callRole} sıfatıyla ifadenize başvurulacaktır. Millî Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği'nin ilgili hükümleri uyarınca ${val(data.statementPlace)} yerinde, yukarıda belirtilen tarih ve saatte hazır bulunmanızı rica ederim.`, alignment: 'justify', margin: [0, 0, 0, 12], lineHeight: 1.4 },
        chairSignature,
        { text: 'OKUDUM', bold: true, margin: [0, 16, 0, 13] },
        line('Adı Soyadı', name, 12), line('Tarih', '', 12), line('İmza', '', 0),
      ] : [
        title(`OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU ${kind === 'victim' ? 'MAĞDUR ÖĞRENCİNİN' : kind === 'accused' ? 'HAKKINDA İŞLEM YAPILAN ÖĞRENCİNİN' : 'GÖRGÜ TANIĞI ÖĞRENCİNİN'} İFADESİ`),
        { text: kind === 'victim'
          ? 'Okul disiplin kurulunda görüşülmesi için gönderilen dosya ile ilgili olarak olayda mağdur duruma düşen öğrencinin vermiş olduğu ifade tutanağıdır.'
          : kind === 'accused'
            ? 'Okul disiplin kurulunda görüşülmesi için gönderilen dosyada adı geçen öğrenciyle yapılan ön görüşmede öğrencinin vermiş olduğu ifade tutanağıdır.'
            : 'Olay hakkında bilgisine başvurulan görgü tanığı öğrencinin vermiş olduğu ifade tutanağıdır.', alignment: 'justify', lineHeight: 1.3 },
        chairSignature,
        subheading(`DİSİPLİN OLAYI İLE İLGİLİ ${kind === 'victim' ? 'MAĞDUR' : kind === 'accused' ? 'HAKKINDA İŞLEM YAPILAN' : 'GÖRGÜ TANIĞI'} ÖĞRENCİNİN BİLGİLERİ`),
        line('Adı Soyadı', name),
        line('Doğum Tarihi', kind === 'accused' ? date(data.birthDate) : ''),
        line('Sınıfı, Numarası, Alanı/Dalı, Dönemi', detail),
        ...(kind === 'accused' ? [
          line('Yatılı / gündüzlü', ''), line('Sağlık durumu (gerekiyorsa)', ''),
          line('Aile durumu (gerekiyorsa)', ''), line('Açık adres (gerekiyorsa)', ''),
        ] : []),
        subheading(`DİSİPLİN OLAYI İLE İLGİLİ ${kind === 'victim' ? 'MAĞDUR' : kind === 'accused' ? 'HAKKINDA İŞLEM YAPILAN' : 'GÖRGÜ TANIĞI'} ÖĞRENCİNİN İFADESİ`),
        { text: 'OLAY:', bold: true, margin: [0, 5, 0, 7] },
        { text: val(data.incidentSummary), margin: [0, 0, 0, 20], lineHeight: 1.25 },
        { text: 'İFADE:', bold: true, margin: [0, 0, 0, 7] },
        { text: String(statement || '').trim() || '..................................................................................................................\n'.repeat(10), margin: [0, 0, 0, 32], lineHeight: 1.35 },
        line('Adı Soyadı', name, 12), line('Tarih', date(data.statementDate), 12), line('İmza', '', 0),
      ];
      const docDefinition: any = {
        pageSize: 'A4', pageOrientation: 'portrait', pageMargins: [55, 60, 55, 55],
        defaultStyle: { font: 'Roboto', fontSize: 12, color: '#111111', lineHeight: 1.15 }, content,
      };
      const filename = kind === 'call' ? 'Disiplin_Kurulu_Cagri_Pusulasi.pdf'
        : kind === 'victimCall' ? `Magdur_Ogrenci_${personIndex + 1}_Cagri_Pusulasi.pdf`
        : kind === 'witnessCall' ? `Tanik_Ogrenci_${personIndex + 1}_Cagri_Pusulasi.pdf`
        : kind === 'victim' ? `Magdur_Ogrenci_${personIndex + 1}_Ifade_Tutanagi.pdf`
        : kind === 'accused' ? `Hakkinda_Islem_Yapilan_Ogrenci_${data.studentNumber || 'Taslak'}_Ifadesi.pdf`
        : `Tanik_Ogrenci_${personIndex + 1}_Ifade_Tutanagi.pdf`;
      pdfMake.createPdf(docDefinition).download(filename);
    } catch (err) {
      console.error('Disiplin PDF oluşturulamadı:', err);
      window.alert('PDF hazırlanamadı. PDF kütüphanesini ve tarayıcı indirme izinlerini kontrol edin.');
    } finally { setPdfBusy(null); }
  };

  useEffect(() => { if (data.behaviorId && !choices.some(b => String(b.id) === data.behaviorId)) return; }, [choices, data.behaviorId]);

  return <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 pb-4 pt-0">
    <div className="rounded-3xl border-2 border-dashed border-teal-600 bg-white p-4">
      <div
        className="flex min-h-[52px] flex-wrap items-center gap-2 rounded-2xl bg-teal-600 bg-theme-pattern p-1.5"
        style={{ backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.065) 0%, rgba(255,255,255,0.035) 40%, transparent 43%)', backgroundSize: '34px 34px' }}
      >
        {steps.map((name, i) => <button
          key={name}
          type="button"
          onClick={() => setStep(i)}
          aria-current={step === i ? 'step' : undefined}
          className={`min-h-[39px] rounded-xl border border-white px-4 py-2 text-sm font-extrabold leading-tight shadow-sm transition-colors ${step === i ? 'bg-white text-teal-800' : 'bg-amber-800 text-white hover:bg-amber-900'}`}
        >{name}</button>)}
      </div>
    </div>
    {step === 0 && <>
      <section className={sectionClass}>{heading('📌', 'Olay')}
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">{field('Olayın tarihi', 'incidentDate', '', 'date')}{field('Olayın yeri', 'incidentPlace', 'Okul bahçesi, sınıf...')}{field('Bildiren / şikâyetçi', 'reporter', 'Nöbetçi öğretmen...')}{saveButton()}</div>
        {multiline('Olayın özeti', 'incidentSummary', 'Ne oldu? Kısa ve nesnel biçimde yazınız; bu metin daha sonra tutanaklarda kullanılabilir.')}
        <p className="text-xs text-slate-500">Davranışın yönetmelikteki karşılığı, Öğrenci sekmesinde her öğrenci için ayrı seçilir.</p>
      </section>

    </>}
    {step === 1 && <>
      <div className="grid grid-cols-1 items-start gap-4 xl:h-[calc(100vh-190px)] xl:min-h-[520px] xl:overflow-hidden xl:items-stretch xl:grid-cols-[minmax(0,33fr)_minmax(0,67fr)]">
        <div className="min-w-0 space-y-4 xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:space-y-0 xl:gap-4">
      <section className={`${sectionClass} xl:min-h-0 xl:flex-1 xl:overflow-y-auto`}>
        {heading('🧑‍🎓', 'Hakkında işlem yapılan öğrenci')}
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="relative min-w-0 flex-1">
              <label className="mb-1 block text-xs font-bold text-slate-600">Öğrenci ara</label>
              <input className={`${controlClass} bg-yellow-50`} value={studentQuery} placeholder="Ad, soyad veya okul no" onFocus={() => setStudentSuggestions(true)} onChange={e => { setStudentQuery(e.target.value); setStudentSuggestions(true); }} onKeyDown={e => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const typed = studentQuery.trim();
                const exact = /^\d+$/.test(typed)
                  ? students.find(item => studentNumber(item).trim() === typed)
                  : undefined;
                if (exact) { updateStudent(exact); return; }
                if (!/^\d+$/.test(typed) && studentMatches.length === 1) updateStudent(studentMatches[0]);
              }}/>
            </div>
            <button type="button" disabled={readOnly} onClick={addAccused} className="inline-flex h-[38px] shrink-0 items-center justify-center gap-1 rounded-lg border border-dashed border-indigo-500 bg-indigo-50 px-3 text-xs font-bold text-indigo-700 disabled:opacity-40"><Plus size={14}/> Öğrenci Ekle</button>
          </div>
          {studentSuggestions && studentMatches.length > 0 && <div className="max-h-52 overflow-y-auto rounded-lg border border-indigo-200 bg-white shadow-lg" role="listbox" aria-label="Öğrenci arama sonuçları">{studentMatches.map((s,i)=><button type="button" key={String(s.id || i)} onClick={()=>updateStudent(s)} className="block w-full px-3 py-2 text-left text-xs hover:bg-indigo-50">{s.fullName || s.name} · {s.classroom || s.className} · {s.number || s.schoolNumber}</button>)}</div>}
          <div className="flex flex-col gap-2">
          {readAccused(data).map((person, index) => <div key={person.id} className={`flex w-full min-w-0 items-center justify-between gap-1 rounded-xl border px-1 py-1 ${person.id === data.selectedAccusedId ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
            <button type="button" onClick={() => chooseAccused(person.id)} className="min-w-0 flex-1 break-words px-2 py-1 text-left text-xs font-semibold text-slate-800">{index + 1}. {person.studentName || 'Yeni öğrenci'} {person.studentNumber ? `· ${person.studentNumber}` : ''}</button>
            <button type="button" disabled={readOnly} onClick={() => removeAccused(person.id)} aria-label={`${index + 1}. öğrenciyi kaldır`} title="Bu öğrenciye ait dosya bilgilerini kaldır" className="rounded-md px-1 py-1 text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 size={13}/></button>
          </div>)}
        </div>
          {field('Adı soyadı', 'studentName', 'Ad Soyad')}
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">{field('Sınıfı/şubesi', 'studentClass', '11/A')}</div>
            <div className="min-w-0">{field('Okul numarası', 'studentNumber', '123')}</div>
          </div>
          {field('Doğum tarihi', 'birthDate', '', 'date')}
          {field('Velisinin adı soyadı', 'parentName', 'Ad Soyad')}
          {field('Velinin adresi (tebligat için)', 'parentAddress', 'Mahalle, sokak, no, ilçe/il')}
          <div className="flex justify-end">{saveButton()}</div>
        </div>
      </section>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">Özel nitelikli öğrenci bilgileri bu ekranda toplanmaz. Öğrenciye uygulanacak işlemler için yürürlükteki yönetmelik ve bireysel değerlendirmeler ayrıca kontrol edilmelidir.</div>
        </div>
        <div className="min-w-0 xl:h-full xl:min-h-0">
      <section className={`${sectionClass} xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden`}>
        {heading('⚖️', 'Davranış — yönetmelikteki karşılığı', 'Önce ceza türünü, sonra davranışı seçiniz. Buradaki seçim bir ceza kararı değil, değerlendirme taslağıdır.')}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{sanctions.map(s => <button type="button" key={s} onClick={() => set('sanction', s)} className={`min-h-14 rounded-lg border px-3 text-left text-xs font-bold ${data.sanction===s ? 'border-indigo-600 bg-indigo-50 text-indigo-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{s}</button>)}</div>
        <input value={behaviorQuery} onChange={e=>setBehaviorQuery(e.target.value)} placeholder="Bu ceza türündeki davranışları filtrele..." className={controlClass}/>
        <div className="min-h-48 max-h-96 overflow-y-auto overscroll-contain rounded-lg border border-slate-200 divide-y divide-slate-100 xl:max-h-none xl:flex-1">
          {filteredChoices.length ? filteredChoices.map(b => <label key={b.id} className={`flex cursor-pointer items-start gap-3 px-3 py-2 text-xs ${selectedBehaviorIds.includes(String(b.id))?'bg-indigo-50':'bg-white hover:bg-slate-50'}`}><input type="checkbox" disabled={readOnly} checked={selectedBehaviorIds.includes(String(b.id))} onChange={()=>toggleBehavior(String(b.id))}/><span><strong>{b.article ? b.article + ' · ' : ''}</strong>{b.name}{b.content && b.content!==b.name && <span className="block text-slate-500">{b.content}</span>}</span></label>) : <p className="p-3 text-xs text-amber-800">Bu grup için kayıtlı davranış bulunamadı. Davranış Tanımları verilerini kontrol edin; mevzuat maddesi uydurulmaz.</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold text-slate-600">Seçilen yönetmelik maddesi: {selectedBehaviorIds.length}</span><button type="button" disabled={readOnly || selectedBehaviorIds.length === 0} onClick={clearBehaviors} className="rounded-lg border border-red-200 px-3 py-1.5 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40">Tüm Seçimleri Kaldır</button></div>
        <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={data.sameYearRepeat} onChange={e=>set('sameYearRepeat',e.target.checked)}/> Aynı öğretim yılı içerisinde tekrarlanan davranış değerlendirmesi gerekiyor.</label>
        <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={data.lowerSanction} onChange={e=>set('lowerSanction',e.target.checked)}/> Daha alt ceza değerlendirmesi yapılacak.</label>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><div className="text-[10px] font-bold text-emerald-700">SEÇİLEN DEĞERLENDİRME</div><div className="text-sm font-bold text-emerald-900">{data.sanction}</div><div className="mt-1 text-xs text-emerald-800">{selectedBehaviors.length ? selectedBehaviors.map(b => b.name).join(' • ') : 'Henüz davranış seçilmedi'}</div></div>
      </section>
        </div>
      </div>
    </>}
    {(step === 2 || step === 3) && (step === 3 ? <section className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
      <label className="block text-xs font-bold text-indigo-900">İşlem yapılacak öğrenci</label>
      <select value={data.selectedAccusedId || ''} onChange={e => chooseAccused(e.target.value)} className={`${controlClass} mt-1 max-w-xs`}>
        {readAccused(data).map((person, index) => <option key={person.id} value={person.id}>{index + 1}. {person.studentName || 'Adı girilmemiş öğrenci'} {person.studentClass ? `· ${person.studentClass}` : ''} {person.studentNumber ? `· No: ${person.studentNumber}` : ''}</option>)}
      </select>
      <p className="mt-1 text-[11px] text-indigo-800">Karar alanları yalnızca seçilen öğrenciye aittir.</p>
    </section> : null)}
    {step === 2 && <>
      <div className="grid min-w-0 grid-cols-1 items-end gap-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3 lg:grid-cols-3">
        <div className="min-w-0 w-full">
          <label className="block text-xs font-bold text-indigo-900">İşlem yapılacak öğrenci</label>
          <select value={data.selectedAccusedId || ''} onChange={e => chooseAccused(e.target.value)} className={`${controlClass} mt-1 w-full min-w-0`}>
            {readAccused(data).map((person, index) => <option key={person.id} value={person.id}>{index + 1}. {person.studentName || 'Adı girilmemiş öğrenci'} {person.studentClass ? `· ${person.studentClass}` : ''} {person.studentNumber ? `· No: ${person.studentNumber}` : ''}</option>)}
          </select>
        </div>
        <nav aria-label="İfade işlemleri" className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:col-span-2">
          {([['call', 'Çağrı Pusulası / İfadeler'], ['collect', 'Bilgi Toplama'], ['defense', 'Savunma']] as const).map(([id, label]) =>
            <button key={id} type="button" onClick={() => setStatementTab(id)}
              className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${statementTab === id ? 'border-amber-800 bg-amber-800 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-amber-50'}`}>{label}</button>
          )}
        </nav>
      </div>
      {statementTab === 'call' && <div className="grid min-w-0 items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4" aria-label="Hakkında işlem yapılan öğrenci">
        <section className={sectionClass}>
          <div className="flex items-start justify-between gap-3">{heading('📝', 'İfadeye çağrı', 'İfade tarihi, saati ve yeri bu bölümde belirlenir. Savunma çağrısı ayrı bir resmî işlemdir.')}{pdfButton('call')}</div>
          <div className="grid grid-cols-2 gap-3">{field('İfade tarihi', 'statementDate', '', 'date')}{field('İfade saati', 'statementTime', '10:00', 'time')}</div>
          {field('İfadenin alınacağı yer', 'statementPlace', 'Müdür yardımcısı odası')}
          <p className="text-xs text-slate-600">Hakkında işlem yapılan öğrenci: {data.studentName || 'Öğrenci aşamasında henüz seçilmedi'} · {[data.studentClass, data.studentNumber].filter(Boolean).join(' / ') || 'Sınıf / numara belirtilmedi'}</p>
        </section>
        <section className={sectionClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {heading('🧑‍🎓', 'Hakkında işlem yapılan öğrencinin ifadesi', 'Öğrenci bilgileri Öğrenci aşamasından alınır; bu alan öğrencinin olay hakkındaki ön ifadesidir, resmî savunma ile karıştırılmamalıdır.')}
            {pdfButton('accused')}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{data.studentName || 'Öğrenci henüz seçilmedi'} · {[data.studentClass, data.studentNumber].filter(Boolean).join(' / ') || 'Sınıf / numara belirtilmedi'}</div>
        </section>
        </div>
        <div className="min-w-0 space-y-4" aria-label="Mağdur öğrenciler">
        <section className={sectionClass}>
          {heading('🙋', 'Mağdur öğrencilerin çağrı pusulaları (varsa)', 'Öğrencileri bir kez seçiniz. İfade bölümüne otomatik aktarılırlar.')}
          <div className="flex min-w-0 items-end gap-2">
            <div className="min-w-0 flex-1">{personStudentSearch('victim', Math.min(selectedVictimIndex, (data.additionalVictims || []).length))}</div>
            <button disabled={readOnly} type="button" onClick={() => {
              const victims = [data.victim, ...(data.additionalVictims || [])];
              if (victims.length === 1 && !victims[0].name.trim() && !victims[0].detail.trim()) { setSelectedVictimIndex(0); return; }
              set('additionalVictims', [...(data.additionalVictims || []), { name: '', detail: '', statement: '' }]);
              setSelectedVictimIndex(victims.length);
              setActivePersonSearch(null);
            }} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-dashed border-indigo-400 px-2 text-xs font-bold text-indigo-700 disabled:opacity-40"><Plus size={13}/> Mağdur Ekle</button>
          </div>
          <div className="space-y-2">
            {([data.victim, ...(data.additionalVictims || [])]).map((victim, i) => <div key={i} className={`flex w-full min-w-0 items-center gap-2 rounded-lg border px-2 py-1 ${selectedVictimIndex === i ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
              <button type="button" onClick={() => { setSelectedVictimIndex(i); setActivePersonSearch(null); }} className="min-w-0 flex-1 truncate py-1 text-left text-xs font-semibold">{i + 1}. {victim.name || 'Yeni mağdur öğrenci'}{victim.detail ? ` · ${victim.detail}` : ''}</button>
              <button type="button" disabled={readOnly} aria-label={`${i + 1}. mağdur öğrenciyi kaldır`}
                onClick={event => {
                  event.stopPropagation();
                  if (readOnly || !window.confirm('Bu mağdur öğrenciyi ve varsa kayıtlı ifadesini kaldırmak istiyor musunuz?')) return;
                  const remaining = [data.victim, ...(data.additionalVictims || [])].filter((_, index) => index !== i);
                  const safe = remaining.length ? remaining : [{ name: '', detail: '' }];
                  setData(previous => ({ ...previous, victim: safe[0], additionalVictims: safe.slice(1).map(v => ({ ...v, statement: v.statement || '' })), victimStatement: i === 0 ? (safe[0].statement || '') : previous.victimStatement }));
                  setSelectedVictimIndex(current => Math.min(current > i ? current - 1 : current, safe.length - 1));
                  setSaved(false);
                }} className="shrink-0 rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 size={14}/></button>
            </div>)}
          </div>
          {([data.victim, ...(data.additionalVictims || [])]).map((v, i) => i !== selectedVictimIndex ? null :
            <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-700">{i + 1}. mağdur öğrenci bilgileri</span>{pdfButton('victimCall', i)}</div>
              <label className="block space-y-1 text-xs font-semibold text-slate-600"><span>Adı soyadı</span><input disabled={readOnly} className={controlClass} value={v.name} onChange={e => personInput(v, 'name', e.target.value, 'victim', i)} placeholder="Ad Soyad" /></label>
              <label className="block space-y-1 text-xs font-semibold text-slate-600"><span>Sınıfı / numarası</span><input disabled={readOnly} className={controlClass} value={v.detail} onChange={e => personInput(v, 'detail', e.target.value, 'victim', i)} placeholder="10/C - 245" /></label>
            </div>
          )}
        </section>
        <section className={sectionClass}>
          {heading('🙋', 'Mağdur öğrencilerin ifadeleri (varsa)', 'Çağrı Pusulası bölümünde seçilen öğrenciler burada görünür. Her mağdurun ifadesi ayrı kaydedilir.')}
          {([data.victim, ...(data.additionalVictims || [])]).filter(v => v.name.trim()).length === 0 && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Henüz mağdur öğrenci seçilmedi. Varsa Çağrı Pusulası bölümünden ekleyiniz.</p>}
          {([data.victim, ...(data.additionalVictims || [])]).map((v, i) => !v.name.trim() ? null :
            <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-700">{i + 1}. mağdur: {v.name} · {v.detail}</span>{pdfButton('victim', i)}</div>
              <label className="block space-y-1 text-xs font-semibold text-slate-600"><span>Mağdur öğrencinin ifadesi</span>
                <textarea disabled={readOnly} rows={5} className={`${controlClass} h-auto min-h-20 resize-y py-2`} value={i === 0 ? data.victimStatement : (v as Person & {statement:string}).statement || ''}
                  onChange={e => i === 0 ? set('victimStatement', e.target.value) : set('additionalVictims', (data.additionalVictims || []).map((p, j) => j === i - 1 ? { ...p, statement: e.target.value } : p))} placeholder="Öğrencinin kendi ifadesini yazınız."/>
              </label>
            </div>
          )}
        </section>
        </div>
        <div className="min-w-0 space-y-4" aria-label="Tanık öğrenciler">
        <section className={sectionClass}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {heading('👁️', 'Tanık öğrencilerin çağrı pusulaları (varsa)', 'Tanıkları bu bölümden seçiniz. Her tanık için ayrı çağrı pusulası hazırlanır.')}
            <button disabled={readOnly} type="button" onClick={() => set('witnesses', [...data.witnesses, { name: '', detail: '', statement: '' }])} className="flex items-center gap-1 rounded-lg border border-dashed border-indigo-400 px-3 py-2 text-xs font-bold text-indigo-700 disabled:opacity-40"><Plus size={13}/> Tanık ekle</button>
          </div>
          {data.witnesses.map((w, i) => <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700">{i + 1}. tanık öğrenci</span><div className="flex gap-2">{pdfButton('witnessCall', i)}<button disabled={readOnly} type="button" aria-label={`${i + 1}. tanığı kaldır`} onClick={() => set('witnesses', data.witnesses.filter((_, x) => x !== i))} className="rounded-lg border border-red-200 px-3 text-red-600 disabled:opacity-40"><Trash2 size={15}/></button></div></div>
            {personStudentSearch('witness', i)}
            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1 text-xs font-semibold text-slate-600"><span>Adı soyadı</span><input disabled={readOnly} value={w.name} onChange={e => personInput(w, 'name', e.target.value, 'witness', i)} className={controlClass} placeholder="Ad Soyad"/></label><label className="space-y-1 text-xs font-semibold text-slate-600"><span>Sınıfı / numarası veya görevi</span><input disabled={readOnly} value={w.detail} onChange={e => personInput(w, 'detail', e.target.value, 'witness', i)} className={controlClass} placeholder="11/A - 87"/></label></div>
          </div>)}
        </section>
        <section className={sectionClass}>
          {heading('👁️', 'Tanık öğrencilerin ifadeleri', 'Çağrı Pusulası bölümünde seçilen tanıkların ifadeleri burada alınır.')}
          {!data.witnesses.some(w => w.name.trim()) && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Henüz tanık eklenmedi. Varsa Çağrı Pusulası bölümünden seçiniz.</p>}
          {data.witnesses.map((w, i) => !w.name.trim() ? null : <div key={i} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-700">{i + 1}. tanık: {w.name} · {w.detail}</span>{pdfButton('witness', i)}</div>
            <label className="block space-y-1 text-xs font-semibold text-slate-600"><span>Tanık öğrencinin ifadesi</span><textarea disabled={readOnly} rows={5} className={`${controlClass} h-auto min-h-20 resize-y py-2`} value={w.statement || ''} onChange={e => set('witnesses', data.witnesses.map((p, j) => j === i ? { ...p, statement: e.target.value } : p))} placeholder="Tanığın olay hakkındaki ifadesini yazınız."/></label>
          </div>)}
        </section>
        </div>
      </div>}
      {statementTab === 'collect' && <>
        <section className={sectionClass}>
          {heading('🎓', 'Öğrencilerden Bilgi Toplama', 'Aynı olay için farklı öğrencilerden birden fazla bilgi toplama formu alınabilir. Her form ayrı PDF olarak hazırlanır.')}
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={readOnly} onClick={() => addReport('studentFriend')} className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-400 bg-indigo-50 px-3 py-3 text-xs font-bold text-indigo-700 disabled:opacity-40"><Plus size={14}/> Öğrenci – Arkadaşı Hakkında</button>
            <button type="button" disabled={readOnly} onClick={() => addReport('studentIncident')} className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-400 bg-indigo-50 px-3 py-3 text-xs font-bold text-indigo-700 disabled:opacity-40"><Plus size={14}/> Öğrenci – Olay Hakkında</button>
          </div>
          {reports.filter(r => r.kind === 'studentFriend' || r.kind === 'studentIncident').map(reportEditor)}
        </section>
        <section className={sectionClass}>
          {heading('👩‍🏫', 'Öğretmenlerden Bilgi Toplama', 'Öğretmen ve rehber öğretmen görüşleri ayrı formlara kaydedilir.')}
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" disabled={readOnly} onClick={() => addReport('teacher')} className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-400 bg-indigo-50 px-3 py-3 text-xs font-bold text-indigo-700 disabled:opacity-40"><Plus size={14}/> Öğretmen Görüşü</button>
            <button type="button" disabled={readOnly} onClick={() => addReport('counselor')} className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-indigo-400 bg-indigo-50 px-3 py-3 text-xs font-bold text-indigo-700 disabled:opacity-40"><Plus size={14}/> Rehber Öğretmen Görüşü</button>
          </div>
          {reports.filter(r => r.kind === 'teacher' || r.kind === 'counselor').map(reportEditor)}
        </section>
      </>}
      {statementTab === 'defense' && <section className={`${sectionClass} min-h-40`}>
        {heading('🛡️', 'Savunma', 'Savunma işlemleri için ayrı alt bölüm oluşturuldu. Savunma formu ve alanları sonraki düzenlemede hazırlanabilir.')}
      </section>}
    </>}
    {step === 3 && <>
      <section className={sectionClass}>{!board.found && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Okul Öğrenci Ödül ve Disiplin Kurulu kaydı bulunamadı. Kurul ve Komisyonlar bölümünden kurul bilgilerini tamamlayınız.</p>}{board.found && !board.chair && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Kurul başkanı henüz tanımlanmamış. Kurul ve Komisyonlar bölümünden atayınız.</p>}{heading('▣', 'Kurul toplantısı', 'Kurula geliş tarihinden itibaren uygulanacak karar süresi ve toplantı usulü, güncel yönetmeliğe göre ayrıca kontrol edilmelidir.')}
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">Kurul ve Komisyonlar kaydından: <strong>Başkan:</strong> {board.chair || 'Henüz atanmadı'} · <strong>Üyeler:</strong> {board.members.map(m => `${m.name} (${m.title})`).join(', ') || 'Henüz atanmadı'} · <strong>Okul müdürü:</strong> {board.principal || 'Okul Bilgileri kaydında bulunamadı'}</p>
        <div className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">{field('Toplantı (savunma) tarihi', 'meetingDate', '', 'date')}{field('Saati', 'meetingTime', '14:00', 'time')}{field('Karar numarası', 'decisionNumber', '2026/5')}{saveButton()}</div>
      </section>
      <section className={sectionClass}>{heading('📝', 'Karar', 'Kurul kararı gerekçeli hazırlanır; bu taslakta karar otomatik olarak kesinleştirilmez.')}
        <div className="flex gap-5 text-xs font-semibold text-slate-700">{(['unanimous','majority'] as const).map(v=><label key={v} className="flex items-center gap-2"><input type="radio" name="voting" checked={data.voting===v} onChange={()=>set('voting',v)}/>{v==='unanimous'?'Oy birliğiyle':'Oy çokluğuyla'}</label>)}</div>
        {multiline('Cezanın takdirinde esas alınan hususlar (gerekçe)','rationale','Öğrencinin ifadesi, deliller, rehberlik değerlendirmesi, hafifletici/ağırlaştırıcı etkenler...',4)}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><span className="text-[10px] font-bold text-emerald-700">KARAR TASLAĞINDA SEÇİLEN CEZA TÜRÜ</span><div className="mt-1 font-bold text-emerald-900">{data.sanction}</div><div className="mt-1 text-xs text-emerald-800">{selectedBehaviors.length ? selectedBehaviors.map(b => b.name).join(' • ') : 'Davranış seçilmedi'}</div></div>
      </section>
    </>}
    {step === 4 && <section className={`${sectionClass} min-h-56 flex flex-col items-center justify-center text-center`}><FileText className="h-10 w-10 text-slate-300 mb-3"/><h3 className="font-bold text-slate-800">Evraklar</h3><p className="mt-2 max-w-lg text-xs leading-5 text-slate-500">Bu bölüm isteğiniz doğrultusunda şimdilik boş bırakıldı. Form ve evrak işlemlerini daha sonra birlikte yapılandıracağız.</p></section>}
  </div>;
}


