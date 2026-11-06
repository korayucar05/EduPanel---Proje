import React from "react";
import {
  BarChart3,
  BookOpen,
  Building2,
  CircleGauge,
  GraduationCap,
  Medal,
  Search,
  Settings,
  Star,
  Target,
  Trophy,
  UserRoundSearch,
  Users,
} from "lucide-react";
import type { InstitutionReportV2Data } from "./buildInstitutionReportV2Data";
import enstituLogo from "../../assets/splash/enstitu-logo-transparent.png";
import ReportFamilyHeader from "../../components/exam/reports/components/ReportFamilyHeader";

const palette = {
  ink: "#07394A",
  teal: "#008A8A",
  teal2: "#18B7B1",
  teal3: "#75D4D7",
  green: "#0C766F",
  gold: "#F7BE43",
  orange: "#FF7A3D",
  red: "#F04F44",
  pale: "#F6FBFC",
  line: "#D4E8EC",
  muted: "#597581",
};

const scoreColors = [palette.red, palette.orange, palette.gold, palette.teal2, palette.green];
const subjectColors = ["#4AB584", "#FF7542", "#F8C442", "#F2C846", "#4BB88D", "#F4C94B", "#F5C44A", "#4BB98F"];

const fmt = (value: number, digits = 1) => Number.isFinite(value) ? value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "0";
const fmtDate = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("tr-TR");
};

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-[16px] border border-[#d7e8ec] bg-white shadow-[0_2px_8px_rgba(8,65,78,.045)] ${className}`}>{children}</section>;
}

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return <div className="flex items-start gap-3">
    <div className="mt-[1px] text-[#087c7b]">{icon}</div>
    <div>
      <h2 className="text-[22px] font-black leading-none tracking-[-.35px] text-[#07394a]">{title}</h2>
      {subtitle && <p className="mt-1 text-[11px] font-medium leading-tight text-[#617e89]">{subtitle}</p>}
    </div>
  </div>;
}

function MetricCard({ icon, label, value, detail, accent = "teal" }: { icon: React.ReactNode; label: string; value: string; detail: string; accent?: "teal" | "gold" }) {
  const bg = accent === "gold" ? "#F9C653" : "#73D2D5";
  return <Panel className="flex h-[132px] items-start gap-3 px-4 py-4">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: bg, color: accent === "gold" ? "#5d481a" : palette.ink }}>{icon}</div>
    <div className="min-w-0 pt-1">
      <div className="text-[13px] font-black leading-[1.15] text-[#163f50]">{label}</div>
      <div className="mt-3 text-[32px] font-black leading-none tracking-[-1px] text-[#07394a]">{value}</div>
      <div className="mt-2 text-[10px] font-semibold leading-tight text-[#68828c]">{detail}</div>
    </div>
  </Panel>;
}

function Donut({ report }: { report: InstitutionReportV2Data }) {
  const bands = report.scoreBands.length ? report.scoreBands : [{ label: "-", count: 0, rate: 100 }];
  let cursor = 0;
  const stops: string[] = [];
  bands.forEach((band, index) => {
    const start = cursor;
    const end = cursor + Math.max(0, band.rate);
    stops.push(`${scoreColors[index % scoreColors.length]} ${start}% ${end}%`);
    cursor = end;
  });
  if (cursor < 100) stops.push(`#edf5f6 ${cursor}% 100%`);
  return <div className="relative h-[205px] w-[205px] shrink-0 rounded-full" style={{ background: `conic-gradient(${stops.join(",")})` }}>
    <div className="absolute inset-[43px] flex flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_#e9f0f2]">
      <div className="text-[28px] font-black leading-none text-[#07394a]">{report.summary.studentCount}</div>
      <div className="mt-1 text-[12px] font-black text-[#234d5d]">Öğrenci</div>
    </div>
  </div>;
}

function Header({ report, page, pageCount = 2 }: { report: InstitutionReportV2Data; page: number; pageCount?: number }) {
  return <div className="mb-4">
    <ReportFamilyHeader
      variant="institution"
      schoolName={report.schoolName}
      examName={report.examName}
      examDate={report.examDate}
      reportName="KARŞILAŞTIRMALI KURUM SINAV RAPORU"
      meta={[
        {label:"ÖĞRENCİ",value:report.summary.studentCount},
        {label:"ŞUBE",value:report.summary.classroomCount},
        {label:"SAYFA",value:`${page}/${pageCount}`},
      ]}
    />
  </div>;
}

function Footer({ page, pageCount = 2 }: { page: number; pageCount?: number }) {
  return <footer className="absolute inset-x-0 bottom-0 h-[93px] overflow-hidden">
    <div className="absolute -bottom-[85px] -left-[80px] h-[160px] w-[760px] rotate-[2deg] rounded-[50%] bg-[#006d76]" />
    <div className="absolute -bottom-[92px] left-[260px] h-[160px] w-[720px] -rotate-[2deg] rounded-[50%] bg-[#15aaa6]" />
    <div className="absolute bottom-[17px] left-[35px] z-10 font-serif text-[14px] italic text-white/90">Daha iyi bir gelecek, nitelikli eğitimle mümkün.</div>
    <div className="absolute bottom-[20px] right-[34px] z-10 flex items-center gap-4 text-[10px] font-bold text-[#426978]">
      <img src={enstituLogo} alt="" className="h-6 w-9 object-contain" />
      <span className="font-black text-[#0c4d5a]">e-Nstitü</span><span>• Yönetici Analiz Raporu</span><span className="h-5 w-px bg-[#5b8790]" /><span>Bilgi. Analiz. Gelişim.</span><span className="text-[#0d6d73]">{page}/{pageCount}</span>
    </div>
  </footer>;
}

function SubjectRows({ report, limit }: { report: InstitutionReportV2Data; limit?: number }) {
  const rows = typeof limit === "number" ? report.subjects.slice(0, limit) : report.subjects;
  return <div className="mt-3 overflow-hidden rounded-[9px] border border-[#dcebed]">
    <div className="grid grid-cols-[1.7fr_.75fr_.75fr_.7fr_.75fr_.72fr_1.7fr] items-center bg-[#edf7f8] px-3 py-2 text-[10px] font-black text-[#184757]">
      <span>Ders</span><span className="text-center">Doğru (D)</span><span className="text-center">Yanlış (Y)</span><span className="text-center">Boş (B)</span><span className="text-center">Net</span><span className="text-center">Başarı %</span><span />
    </div>
    {rows.map((subject, index) => <div key={subject.subjectName} className={`grid grid-cols-[1.7fr_.75fr_.75fr_.7fr_.75fr_.72fr_1.7fr] items-center px-3 py-[7px] text-[10px] ${index % 2 ? "bg-white" : "bg-[#f8fbfc]"}`}>
      <span className="truncate font-black text-[#153f50]">{subject.subjectName}</span>
      <span className="text-center font-semibold">{fmt(subject.averageCorrect, 1)}</span>
      <span className="text-center font-semibold">{fmt(subject.averageWrong, 1)}</span>
      <span className="text-center font-semibold">{fmt(subject.averageEmpty, 1)}</span>
      <span className="text-center font-black text-[#07394a]">{fmt(subject.averageNet, 1)}</span>
      <span className="text-center font-black text-[#145366]">%{fmt(subject.successRate, 0)}</span>
      <span className="h-[10px] overflow-hidden rounded-full bg-[#e8edef]"><span className="block h-full rounded-full" style={{ width: `${Math.min(100, Math.max(2, subject.successRate))}%`, backgroundColor: subjectColors[index % subjectColors.length] }} /></span>
    </div>)}
  </div>;
}

function ReportPageOne({ report }: { report: InstitutionReportV2Data }) {
  const bestClass = report.classrooms[0];
  const bestScoreBand = [...report.scoreBands].sort((a, b) => b.count - a.count)[0];
  return <article id="hasat-institution-report-v2-page-1" className="relative mx-auto box-border h-[1588px] w-[1123px] overflow-hidden bg-[#fbfefe] px-[22px] pb-[105px] text-[#173f4e]" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
    <Header report={report} page={1} />

    <section className="grid grid-cols-5 gap-3">
      <MetricCard icon={<Users className="h-7 w-7" />} label="Katılan Öğrenci" value={String(report.summary.studentCount)} detail={`${report.summary.classroomCount} şubeden katılım`} />
      <MetricCard icon={<Building2 className="h-7 w-7" />} label="Şube Sayısı" value={String(report.summary.classroomCount)} detail={`${report.summary.subjectCount} ders analiz edildi`} />
      <MetricCard icon={<BarChart3 className="h-7 w-7" />} label="Kurum Net Ortalaması" value={fmt(report.summary.averageNet, 1)} detail={`En yüksek ${fmt(report.summary.highestNet, 1)} net`} />
      <MetricCard icon={<Trophy className="h-7 w-7" />} label="Kurum Puan Ortalaması" value={fmt(report.summary.averageScore, 1)} detail="Kurum genel puanı" accent="gold" />
      <MetricCard icon={<Star className="h-7 w-7" />} label="Genel Başarı" value={`%${fmt(report.summary.successRate, 1)}`} detail={`${report.summary.subjectCount} ders üzerinden`} accent="gold" />
    </section>

    <section className="mt-4 grid grid-cols-[1.02fr_.98fr] gap-3">
      <Panel className="h-[380px] p-4">
        <SectionTitle icon={<BarChart3 className="h-7 w-7" />} title="Şube Karşılaştırması" subtitle="Şubelerin performanslarını karşılaştırmalı olarak inceleyin." />
        <div className="mt-3 overflow-hidden rounded-[9px] border border-[#e2eef0]">
          <div className="grid grid-cols-[1.5fr_.9fr_.9fr_.8fr] bg-[#edf7f8] px-3 py-3 text-[10px] font-black text-[#164758]"><span>Şube</span><span className="text-center">Ortalama Net</span><span className="text-center">Ortalama Puan</span><span className="text-center">Başarı Oranı</span></div>
          {report.classrooms.slice(0, 5).map((item, index) => {
            const max = Math.max(1, ...report.classrooms.map(x => x.averageNet));
            return <div key={item.classroom} className="grid grid-cols-[1.5fr_.9fr_.9fr_.8fr] items-center border-t border-[#e6eff1] px-3 py-[10px] text-[11px]">
              <div className="grid grid-cols-[44px_1fr] items-center gap-2"><strong className="text-[#123f50]">{item.classroom}</strong><span className="h-[26px] bg-[#eaf4f5]"><span className="block h-full" style={{ width: `${Math.max(8, item.averageNet / max * 100)}%`, background: `linear-gradient(90deg, ${palette.teal2}, ${palette.green})` }} /></span></div>
              <strong className="text-center text-[#103f50]">{fmt(item.averageNet, 1)}</strong><strong className="text-center text-[#173f50]">{fmt(item.averageScore, 1)}</strong><strong className="text-center text-[#163f50]">%{fmt(item.successRate, 1)}</strong>
            </div>;
          })}
        </div>
        <div className="mt-3 flex items-center gap-4 rounded-[10px] bg-[#eef8fa] px-4 py-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff4d9] text-[#eda518]"><Trophy className="h-7 w-7" /></div>
          <div className="text-[10px] text-[#345e6d]"><div className="text-[13px] font-black text-[#0d4a59]">En başarılı şube: {bestClass?.classroom || "-"}</div><div className="mt-1">{bestClass ? `Ortalama ${fmt(bestClass.averageNet, 1)} net ile kurum performansında ilk sırada.` : "Şube verisi bulunmuyor."}</div></div>
        </div>
      </Panel>

      <Panel className="h-[380px] p-4">
        <SectionTitle icon={<CircleGauge className="h-7 w-7" />} title="Puan Dağılımı" subtitle="Öğrencilerin puan aralıklarına göre dağılımı" />
        <div className="mt-4 flex items-center gap-6">
          <Donut report={report} />
          <div className="min-w-0 flex-1 space-y-3">
            {report.scoreBands.map((band, index) => <div key={band.label} className="grid grid-cols-[12px_1fr_44px_40px] items-center gap-2 text-[10px]"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: scoreColors[index % scoreColors.length] }} /><span className="font-semibold text-[#284f5e]">{band.label}</span><strong className="text-right">%{fmt(band.rate, 0)}</strong><span className="text-right text-[#6a8791]">({band.count})</span></div>)}
          </div>
        </div>
        <div className="mt-2 grid grid-cols-[1fr_118px] gap-3 rounded-[10px] bg-[#e9f8f9] px-4 py-3 text-[10px]">
          <div className="flex items-center gap-3"><BarChart3 className="h-7 w-7 text-[#087d7c]" /><span>En yoğun puan aralığı <strong className="text-[#07394a]">{bestScoreBand?.label || "-"}</strong> seviyesindedir.</span></div>
          <div className="flex items-center justify-end gap-2"><Target className="h-7 w-7 text-[#087d7c]" /><span className="font-black text-[#174a5a]">Hedef<br />%60+</span></div>
        </div>
      </Panel>
    </section>

    <section className="mt-4 grid grid-cols-[1fr_180px] gap-3">
      <Panel className="h-[346px] p-4">
        <SectionTitle icon={<BookOpen className="h-7 w-7" />} title="Ders Başarı Haritası" subtitle="Ders bazında doğru, yanlış, boş, net ve başarı oranlarını inceleyin." />
        <SubjectRows report={report} limit={8} />
      </Panel>
      <Panel className="relative h-[346px] overflow-hidden p-5">
        <div className="absolute -right-12 bottom-[-28px] h-[150px] w-[150px] rotate-12 rounded-[44%] bg-[#e8f8f8]" />
        <div className="text-[54px] font-serif leading-none text-[#79c9cc]">“</div>
        <div className="mt-2 font-serif text-[17px] italic leading-[1.45] text-[#244f60]">Her veri,<br />daha iyi bir eğitim<br />için yeni bir<br />fırsattır.</div>
        <div className="mt-6 h-[2px] w-12 bg-[#164a58]" />
        <div className="mt-4 text-[13px] font-medium leading-5 text-[#416979]">Analiz Ettikçe<br />Güçleniyoruz</div>
      </Panel>
    </section>

    <section className="mt-4 grid grid-cols-[.9fr_1.25fr] gap-3">
      <Panel className="h-[226px] p-4">
        <SectionTitle icon={<Search className="h-7 w-7" />} title="Önemli Tespitler" />
        <div className="mt-4 space-y-3">
          {report.insights.slice(0, 4).map((item, index) => <div key={index} className="grid grid-cols-[25px_1fr] items-start gap-2 text-[10px] leading-4 text-[#4c6f7b]"><span className="flex h-6 w-6 items-center justify-center rounded-full font-black text-white" style={{ backgroundColor: ["#45b79c", "#f5bf3d", "#29b5ae", "#607d89"][index] }}>{index + 1}</span><span className="pt-1">{item}</span></div>)}
        </div>
      </Panel>
      <Panel className="h-[226px] p-4">
        <SectionTitle icon={<Settings className="h-7 w-7" />} title="Eylem Planı" subtitle="Daha iyi sonuçlar için önerilen adımlar" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          {report.actionPlan.slice(0, 3).map((item, index) => <div key={`${item.priority}-${item.title}`} className="relative h-[145px] rounded-[10px] border border-[#dcebed] bg-[#fbfefe] p-3">
            <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#f6bf43] text-[10px] font-black text-[#483a15]">{index + 1}</span>
            <div className="text-[#098b86]">{index === 0 ? <Target className="h-7 w-7" /> : index === 1 ? <Users className="h-7 w-7" /> : <UserRoundSearch className="h-7 w-7" />}</div>
            <div className="mt-2 pr-6 text-[13px] font-black leading-[1.05] text-[#0b4050]">{item.title}</div>
            <div className="mt-2 line-clamp-4 text-[9.5px] leading-[1.45] text-[#58747f]">{item.detail}</div>
          </div>)}
        </div>
      </Panel>
    </section>

    <Footer page={1} />
  </article>;
}

function ReportPageTwo({ report }: { report: InstitutionReportV2Data }) {
  return <article id="hasat-institution-report-v2-page-2" className="relative mx-auto box-border h-[1588px] w-[1123px] overflow-hidden bg-[#fbfefe] px-[22px] pb-[105px] text-[#173f4e]" style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
    <Header report={report} page={2} />

    <Panel className="p-5">
      <SectionTitle icon={<GraduationCap className="h-7 w-7" />} title="Ayrıntılı Kurum Analizi" subtitle="Şube, öğrenci ve ders bazında ayrıntılı sonuçlar" />
      <div className="mt-4 rounded-[12px] bg-[#eef8f9] px-5 py-4 text-[12px] font-semibold leading-6 text-[#315e6c]">{report.executiveSummary}</div>
    </Panel>

    <section className="mt-4 grid grid-cols-2 gap-3">
      <Panel className="h-[370px] p-4">
        <SectionTitle icon={<Building2 className="h-7 w-7" />} title="Şube Karşılaştırma Tablosu" />
        <div className="mt-4 overflow-hidden rounded-[10px] border border-[#dcebed]">
          <div className="grid grid-cols-[1fr_.8fr_.9fr_.9fr_.8fr] bg-[#087b7a] px-3 py-3 text-[10px] font-black text-white"><span>Şube</span><span className="text-center">Katılım</span><span className="text-center">Ort. Net</span><span className="text-center">Ort. Puan</span><span className="text-center">Başarı</span></div>
          {report.classrooms.slice(0, 8).map((item, index) => <div key={item.classroom} className={`grid grid-cols-[1fr_.8fr_.9fr_.9fr_.8fr] px-3 py-[9px] text-[10px] ${index % 2 ? "bg-white" : "bg-[#f5fafb]"}`}><strong>{item.classroom}</strong><span className="text-center">{item.studentCount}</span><strong className="text-center">{fmt(item.averageNet, 1)}</strong><span className="text-center">{fmt(item.averageScore, 1)}</span><span className="text-center">%{fmt(item.successRate, 1)}</span></div>)}
        </div>
      </Panel>

      <Panel className="h-[370px] p-4">
        <SectionTitle icon={<Medal className="h-7 w-7" />} title="İlk 10 Öğrenci" subtitle="Kurum genelinde en yüksek netler" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {report.topStudents.slice(0, 10).map((item, index) => <div key={`${item.name}-${index}`} className="grid grid-cols-[30px_1fr_58px] items-center rounded-[9px] border border-[#dfebed] bg-[#fbfefe] px-2 py-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0b7d7c] text-[10px] font-black text-white">{index + 1}</span>
            <div className="min-w-0 px-2"><strong className="block truncate text-[9.5px] text-[#173f4e]">{item.name}</strong><span className="text-[8.5px] text-[#718a93]">{item.classroom}</span></div>
            <div className="text-right"><strong className="block text-[11px] text-[#0a6f70]">{fmt(item.net, 1)}</strong><span className="text-[8px] text-[#718a93]">{fmt(item.score, 0)} puan</span></div>
          </div>)}
        </div>
      </Panel>
    </section>

    <Panel className="mt-4 h-[485px] p-4">
      <SectionTitle icon={<BookOpen className="h-7 w-7" />} title="Ders Bazlı Kurum Ortalamaları" subtitle="Tüm derslerin doğru, yanlış, boş, net ve başarı karşılaştırması" />
      <SubjectRows report={report} />
    </Panel>

    <section className="mt-4 grid grid-cols-[.92fr_1.08fr] gap-3">
      <Panel className="h-[252px] p-4">
        <SectionTitle icon={<Search className="h-7 w-7" />} title="Yönetimin Dikkat Etmesi Gerekenler" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {report.attentionItems.slice(0, 6).map((item, index) => <div key={`${item.title}-${index}`} className="rounded-[9px] border border-[#dcebed] bg-[#f9fcfd] p-3">
            <div className="text-[10.5px] font-black leading-tight text-[#164758]">{item.title}</div><div className="mt-1 line-clamp-3 text-[8.5px] leading-[1.4] text-[#637e88]">{item.detail}</div>
          </div>)}
        </div>
      </Panel>
      <Panel className="h-[252px] p-4">
        <SectionTitle icon={<Settings className="h-7 w-7" />} title="Kurum Eylem Planı" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {report.actionPlan.slice(0, 4).map((item, index) => <div key={`${item.priority}-${item.title}`} className="rounded-[9px] border border-[#dcebed] bg-[#fbfefe] p-3">
            <div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f6bf43] text-[9px] font-black">{index + 1}</span><strong className="text-[10.5px] leading-tight text-[#164758]">{item.title}</strong></div>
            <div className="mt-1 line-clamp-2 text-[8.5px] leading-[1.4] text-[#637e88]">{item.detail}</div><div className="mt-1 text-[8px] font-bold text-[#087c7b]">{item.owner}</div>
          </div>)}
        </div>
      </Panel>
    </section>

    <Footer page={2} />
  </article>;
}

export function InstitutionReportV2({ report }: { report: InstitutionReportV2Data }) {
  return <div className="space-y-8">
    <ReportPageOne report={report} />
    <ReportPageTwo report={report} />
  </div>;
}
