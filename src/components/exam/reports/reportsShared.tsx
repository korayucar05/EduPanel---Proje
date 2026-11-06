import React from "react";
import { Download, Printer, X } from "lucide-react";
import type { AccessControlState, PanelUser } from "../../../lib/accessControl";

export const DEVELOPMENT_REPORT_TEXT = `Bence e-Nstitü'ın en güçlü özelliklerinden biri "Gelişim Analizi" olmalı. Çünkü tek bir sınav öğrencinin seviyesini gösterir, ancak birden fazla deneme sınavı öğrencinin gelişimini gösterir.

Sadece puan artışına bakmak yanıltıcı olabilir. Bunun yerine aşağıdaki kriterleri kullanabilirsiniz.

1. Genel Başarı Eğilimi ⭐⭐⭐⭐⭐

En temel kriterdir.

Son 5 deneme sınavındaki puan veya netlerin eğimi hesaplanır.

Değişim - Durum
+%15 ve üzeri - Çok Güçlü Gelişim
+%8 – %15 - Güçlü Gelişim
+%3 – %8 - Düzenli Gelişim
-%3 – +%3 - İstikrarlı
-%3 – -%8 - Düşüş Eğilimi
-%8 altı - Kritik Düşüş

2. Kazanım Gelişim Endeksi ⭐⭐⭐⭐⭐

Bence en önemli kriter budur.

Her kazanım için başarı yüzdesi tutulur.

Örneğin

Kesirler

Deneme 1 : %32
Deneme 2 : %41
Deneme 3 : %53
Deneme 4 : %61
Deneme 5 : %74

e-Nstitü bunu

Çok Güçlü Gelişim

olarak gösterebilir.

3. Zor Sorulardaki Başarı

Öğrenci artık zor soruları yapmaya başladı mı?

Örneğin

İlk sınav

Kolay
★★★★★

Orta
★★★

Zor
★

Son sınav

Kolay
★★★★★

Orta
★★★★★

Zor
★★★★

Bu çok büyük gelişmedir.

4. Dikkatsizlik Endeksi

Kolay soruları kaçırıyor mu?

Örneğin

Kolay sorularda yanlış

Deneme 1 : 12
Deneme 2 : 9
Deneme 3 : 7
Deneme 4 : 4
Deneme 5 : 2

Bu öğrencinin dikkati gelişiyor demektir.

5. Risk Alma Başarısı

Eskiden boş bıraktığı soruları çözmeye başlamış mı?

Boş

25
22
19
15
9

Çok güzel gelişim.

6. Net İstikrarı

Netler

65
66
64
67
66

İstikrarlı

veya

80
55
82
49
85

Dalgalı

7. Ders Bazlı Gelişim

Türkçe
↑

Matematik
↓

Fizik
↑↑

Kimya
→

Biyoloji
↓↓

8. Kazanım Kalıcılığı

Bir kazanımı öğrendi mi?

Kazanım A

20
55
82
86
91

Kalıcı öğrenme

veya

20
75
34
81
39

Kalıcı değil.

9. Sıralama Gelişimi

Kurum

145
122
103
84
51

Sınıf

15
13
10
8
4

10. Ortalama Üzeri Başarı

Her sınavda

Öğrenci
Sınıf
Kurum

karşılaştırılır.

Öğrenci
72

Sınıf
61

Kurum
58

Her sınavda fark açılıyor mu?

11. Hedefe Yaklaşma Endeksi

Öğrenci hedefini seçer.

Örneğin

TYT
90 Net

Bugün
72

İlerleme

42
47
55
63
72

12. Başarı İvmesi

Son üç sınava göre gelişim.

65
67
71

İvme
↑

veya

71
69
67

İvme
↓

13. Güçlü ve Zayıf Alan Dengesi

Başlangıç

Türkçe 90
Matematik 32

Son

Türkçe 88
Matematik 70

Dengelenmiş.

14. Öğrenme Hızı

Yeni öğrenilen kazanımların sayısı.

1. sınav
12

2.
17

3.
23

4.
29

15. Sürekli Başarı Serisi

Arka arkaya gelişme.

↑
↑
↑
↑
↑

veya

↑
↓
↑
↓
↑

Ben olsam e-Nstitü'ta bunları tek tek göstermek yerine "Gelişim Kartları" oluştururdum.

Gelişim Kartı - Açıklama

📈 Genel Gelişim - Son sınavlara göre başarı eğilimi
🎯 Kazanım Gelişimi - Öğrenilen kazanımların artışı
📚 Ders Gelişimi - Her ders için gelişim durumu
🧠 Zor Soru Başarısı - Ayırt edici sorulardaki performans
⚠️ Dikkat Analizi - Kolay sorulardaki hata oranı
📊 İstikrar - Performansın dalgalı mı düzenli mi olduğu
🏆 Sıralama Analizi - Sınıf ve kurum sıralamasındaki değişim
🚀 Başarı İvmesi - Son üç sınavdaki yükseliş veya düşüş
🎯 Hedef Takibi - Hedef nete yaklaşma durumu
⭐ Gelişim Puanı - Tüm kriterlerden hesaplanan 0–100 arası gelişim puanı

Bu yapı, e-Nstitü'ı yalnızca bir sınav analiz programı olmaktan çıkarıp, öğrencinin akademik gelişimini zaman içinde izleyen ve rehberlik çalışmalarını destekleyen bir gelişim platformuna dönüştürebilir. Özellikle rehber öğretmenler ve okul yöneticileri için hangi öğrencinin gerçekten ilerlediğini, hangisinin sadece anlık yüksek performans gösterdiğini ayırt etmeyi çok kolaylaştırır.`;

export const safeIntelligenceCompute=<T,>(label:string,compute:()=>T,fallback:T):T=>{
  try{return compute();}
  catch(error){
    console.error(`[e-Nstitü Intelligence] ${label} hesaplanamadı:`,error);
    return fallback;
  }
};

export const EMPTY_WARNING:any={
  version:"2.0",generatedAt:"",totalStudents:0,criticalNow:0,projectedCritical:0,
  worseningStudentCount:0,improvingStudentCount:0,students:[],classroomWarnings:[],
  subjectWarnings:[],topWarnings:[],recommendations:[],
  summary:{status:"stable",headline:"Erken uyarı verisi hazırlanıyor",detail:"Henüz değerlendirilebilir erken uyarı verisi bulunmuyor."},
};
export const EMPTY_EXECUTIVE:any={
  version:"1.0",generatedAt:"",schoolHealthScore:0,brainIndex:0,criticalStudentCount:0,
  highPriorityCount:0,expectedTotalNetGain:0,leadingClassroom:undefined,leadingSubject:undefined,
  alerts:[],tasks:[],classroomMap:[],
  summary:{status:"stable",headline:"Akademik görünüm hazırlanıyor",detail:"Yönetici karar verileri henüz oluşturulamadı."},
};

export class ReportsRuntimeBoundary extends React.Component<{children:React.ReactNode},{error:Error|null}>{
  state:{error:Error|null}={error:null};
  static getDerivedStateFromError(error:Error){return{error};}
  componentDidCatch(error:Error,info:React.ErrorInfo){console.error("Sınav Raporları çalışma zamanı hatası:",error,info);}
  render(){
    if(this.state.error){
      return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-950 shadow-sm">
        <h2 className="text-base font-black">Sınav Raporları açılırken bir hata oluştu</h2>
        <p className="mt-2 text-xs leading-6 text-rose-800">{this.state.error.message||"Bilinmeyen çalışma zamanı hatası"}</p>
        <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-4 text-[10px] leading-5 text-slate-700">{this.state.error.stack||""}</pre>
        <button type="button" onClick={()=>this.setState({error:null})} className="mt-4 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-black text-white hover:bg-rose-800">Tekrar dene</button>
      </div>;
    }
    return this.props.children;
  }
}

export type ReportFocus={section:string;title:string;tone:string};

export type Props={
  exam:any;
  results:any[];
  selectedStudent?:any|null;
  availableExams?:any[];
  evaluateExam?:(exam:any)=>any[];
  reportCategory?:"admin"|"teacher"|"student";
  showAllCategories?:boolean;
  /** The shell owns this when a report title must be shown beside the active exam selector. */
  focusedReport?:ReportFocus|null;
  onFocusedReportChange?:(report:ReportFocus|null)=>void;
  networkAccessState?:AccessControlState;
  networkCurrentUser?:PanelUser;
};
export type ReportAudience="admin"|"teacher"|"student"|"parent";
export type ReportItem={title:string;description:string;action?:()=>Promise<Blob>;pdfReady?:boolean;audiences?:ReportAudience[];openPremiumView?:()=>void;premiumViewLabel?:string;premiumViewIcon?:React.ElementType;primaryViewAction?:()=>void};
export const REPORT_QUEUE_KEY="exam_whatsapp_report_queue";
export const rankOnly=(value:any,fallback:number)=>{const match=String(value??"").match(/\d+/);return match?Number(match[0]):fallback;};
export const participationOnly=(value:any,fallback:number)=>{const matches=String(value??"").match(/\d+/g);return matches&&matches.length>1?Number(matches[1]):fallback;};
export const subjectResult=(student:any,subjectName:string)=>(student.subjects||[]).find((subject:any)=>subject.subjectName===subjectName);
export const finiteNumber=(value:any,fallback=0)=>{
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:fallback;
};
export const safeFixed=(value:any,digits=2,fallback=0)=>finiteNumber(value,fallback).toFixed(digits);
export const averagePerformance=(students:any[])=>{
  if(!students.length)return{questions:"-",correct:"-",wrong:"-",empty:"-",net:"-",score:"-"};
  const totals=students.reduce((sum,student)=>{const questions=(student.subjects||[]).reduce((count:number,subject:any)=>count+(subject.totalQuestions||0),0);const score=student.score??(questions?Math.max(0,(student.totals?.net||0)/questions*500):0);return{correct:sum.correct+(student.totals?.correct||0),wrong:sum.wrong+(student.totals?.wrong||0),empty:sum.empty+(student.totals?.empty||0),net:sum.net+(student.totals?.net||0),score:sum.score+score};},{correct:0,wrong:0,empty:0,net:0,score:0});
  const average=(value:number)=>Number((value/students.length).toFixed(2));
  return{questions:"-",correct:average(totals.correct),wrong:average(totals.wrong),empty:average(totals.empty),net:average(totals.net),score:average(totals.score)};
};

export function PdfPreviewOverlay({blob,filename,title,onClose}:{blob:Blob;filename:string;title:string;onClose:()=>void}){
  const url=React.useMemo(()=>URL.createObjectURL(blob),[blob]);
  React.useEffect(()=>()=>URL.revokeObjectURL(url),[url]);
  const download=()=>{const anchor=document.createElement("a");anchor.href=url;anchor.download=filename;anchor.click();};
  const print=()=>{const frame=document.getElementById("report-pdf-preview") as HTMLIFrameElement|null;frame?.contentWindow?.print();};
  return <section className="mt-4 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><header className="flex h-14 items-center justify-between border-b border-slate-200 bg-slate-900 px-4 text-white"><div className="min-w-0"><h2 className="truncate text-sm font-black">{title}</h2><p className="text-[10px] text-slate-400">Rapor önizleme</p></div><div className="flex gap-1"><button onClick={download} title="PDF İndir" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-blue-600"><Download className="h-4 w-4"/></button><button onClick={print} title="Yazdır" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-emerald-600"><Printer className="h-4 w-4"/></button><button onClick={onClose} title="Kapat" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-rose-600"><X className="h-4 w-4"/></button></div></header><iframe id="report-pdf-preview" title={`${title} PDF önizleme`} src={`${url}#zoom=125`} className="h-[820px] w-full border-0 bg-slate-200"/></section>;
}
