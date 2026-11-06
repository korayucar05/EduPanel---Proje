import React from "react";
import {
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  Brain,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { PanelUser } from "../../lib/accessControl";
import { buildRoleDataScope, getCurrentSchoolMembership, roleLabel, type CloudRole } from "../../core/auth";
import { decisionTaskRepository, type DecisionTaskRecord } from "../../core/data";
import { fetchCollectionFromLocalDatabase } from "../../core/data/LegacyDatabaseFacade";

type RoleBasedDashboardPortalProps = {
  currentUser?: PanelUser;
  students: Array<Record<string, any>>;
  teachers: Array<Record<string, any>>;
  courses: Array<Record<string, any>>;
  classrooms: Array<Record<string, any>>;
  stats: {
    totalStudents: number;
    activeStudents: number;
    totalTeachers: number;
    totalClasses: number;
  };
  onNavigate: (tab: string) => void;
  onRoleResolved?: (role: CloudRole) => void;
};

type PortalAction = {
  label: string;
  description: string;
  tab: string;
  icon: React.ComponentType<{ className?: string }>;
};

type AcademicSubjectRiskAlert = {
  id: string;
  examId: string;
  examName: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  classroom: string;
  subjectName: string;
  subjectSuccess: number;
  subjectAverage: number;
  otherSubjectsAverage: number;
  riskLevel: string;
  riskLabel: string;
  explanation: string;
  recipientTeacherIds?: string[];
  recipientTeacherNames?: string[];
  recipientMentorIds?: string[];
  recipientMentorNames?: string[];
  updatedAt?: string;
};

const localRoleToCloud = (role?: PanelUser["role"]): CloudRole => {
  if (role === "super_admin") return "super_admin";
  if (role === "principal") return "principal";
  return "teacher";
};

const roleActions: Record<CloudRole, PortalAction[]> = {
  super_admin: [
    { label: "Operasyon Merkezi", description: "Kurum işlerini ve kritik akışları yönet", tab: "operations-center", icon: ShieldCheck },
    { label: "e-Nstitü Brain", description: "Kurumsal karar gündemini incele", tab: "hasat-brain", icon: Brain },
    { label: "Kurum Trendleri", description: "Okulların başarı eğilimini karşılaştır", tab: "institution-trends", icon: BarChart3 },
    { label: "Kullanıcı ve Yetkiler", description: "Kurum kullanıcılarını ve izinleri yönet", tab: "settings", icon: Users },
  ],
  principal: [
    { label: "Operasyon Merkezi", description: "Bugünün kritik okul işlerini yönet", tab: "operations-center", icon: ShieldCheck },
    { label: "e-Nstitü Brain", description: "Öncelikli yönetim kararlarını incele", tab: "hasat-brain", icon: Brain },
    { label: "Sınav Raporları", description: "Kurum ve öğrenci sonuçlarını görüntüle", tab: "exam-reports", icon: ClipboardCheck },
    { label: "Kurum Trendleri", description: "Ders ve sınıf değişimlerini izle", tab: "institution-trends", icon: BarChart3 },
  ],
  assistant_principal: [
    { label: "Yönetim Görevleri", description: "Planlanan ve geciken işleri takip et", tab: "dashboard", icon: ClipboardCheck },
    { label: "Rehberlik Merkezi", description: "Riskli öğrenci ve görüşmeleri izle", tab: "guidance-center", icon: HeartHandshake },
    { label: "Disiplin Analitik", description: "Olay ve süreç yoğunluğunu incele", tab: "discipline-analytics", icon: ShieldCheck },
    { label: "Sınav Raporları", description: "Akademik sonuçlara ulaş", tab: "exam-reports", icon: BarChart3 },
  ],
  teacher: [
    { label: "Öğretmen Analitik", description: "Ders ve kazanım sonuçlarını incele", tab: "teacher-analytics", icon: BarChart3 },
    { label: "Öğrenme Haritası", description: "Eksik ve güçlü kazanımları gör", tab: "learning-map", icon: BookOpenCheck },
    { label: "Sınav Raporları", description: "Yetkili olduğun sınavları görüntüle", tab: "exam-reports", icon: ClipboardCheck },
    { label: "Mesaj Gönder", description: "Öğrenci ve velilerle iletişime geç", tab: "messages", icon: MessageSquare },
  ],
  counselor: [
    { label: "Rehberlik Merkezi", description: "Öğrenci risk haritasını ve görüşmeleri yönet", tab: "guidance-center", icon: HeartHandshake },
    { label: "Davranış Takibi", description: "Öğrenci davranış kayıtlarını incele", tab: "behavior", icon: ShieldCheck },
    { label: "Öğrenme Haritası", description: "Akademik risklerin kaynağını gör", tab: "learning-map", icon: BookOpenCheck },
    { label: "Veli İletişimi", description: "Görüşme ve bilgilendirme sürecini başlat", tab: "messages", icon: MessageSquare },
  ],
};

const roleDescription: Record<CloudRole, string> = {
  super_admin: "Tüm kurumların yönetim, güvenlik ve performans görünümü",
  principal: "Okulun akademik ve operasyonel karar merkezi",
  assistant_principal: "Günlük yönetim, öğrenci süreçleri ve görev takibi",
  teacher: "Ders, sınıf, kazanım ve öğrenci gelişim çalışma alanı",
  counselor: "Akademik, davranışsal ve sosyal risklere yönelik rehberlik çalışma alanı",
};

const normalizeText = (value: unknown) => String(value || "").trim().toLocaleLowerCase("tr-TR");

export default function RoleBasedDashboardPortal({
  currentUser,
  students,
  teachers,
  courses,
  classrooms,
  stats,
  onNavigate,
  onRoleResolved,
}: RoleBasedDashboardPortalProps) {
  const [role, setRole] = React.useState<CloudRole>(() => localRoleToCloud(currentUser?.role));
  const [tasks, setTasks] = React.useState<DecisionTaskRecord[]>([]);
  const [academicRiskAlerts, setAcademicRiskAlerts] = React.useState<AcademicSubjectRiskAlert[]>([]);

  React.useEffect(() => {
    let active = true;
    const fallback = localRoleToCloud(currentUser?.role);
    setRole(fallback);
    onRoleResolved?.(fallback);

    void getCurrentSchoolMembership()
      .then((membership) => {
        if (!active) return;
        setRole(membership.role);
        onRoleResolved?.(membership.role);
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, [currentUser?.id, currentUser?.role, onRoleResolved]);

  React.useEffect(() => {
    const scope = {
      schoolId: currentUser?.schoolId || "school-main",
      userId: currentUser?.id || "system",
      userName: currentUser?.fullName || "Sistem",
    };
    let active = true;
    const load = () => {
      void decisionTaskRepository.list(scope).then((items) => {
        if (active) setTasks(items);
      }).catch(() => undefined);
    };
    load();
    const unsubscribe = decisionTaskRepository.subscribe(scope, load);
    return () => { active = false; unsubscribe(); };
  }, [currentUser?.id, currentUser?.schoolId, currentUser?.fullName]);


  React.useEffect(() => {
    let active = true;
    const loadRiskAlerts = async () => {
      try {
        const rows = await fetchCollectionFromLocalDatabase("academic_subject_risk_alerts");
        if (active) setAcademicRiskAlerts(Array.isArray(rows) ? rows : []);
      } catch {
        if (active) setAcademicRiskAlerts([]);
      }
    };
    void loadRiskAlerts();
    const handler = () => void loadRiskAlerts();
    window.addEventListener("enstitu-academic-risk-alerts-changed", handler);
    const timer = window.setInterval(() => void loadRiskAlerts(), 60_000);
    return () => {
      active = false;
      window.removeEventListener("enstitu-academic-risk-alerts-changed", handler);
      window.clearInterval(timer);
    };
  }, [currentUser?.id]);

  const dataScope = React.useMemo(() => buildRoleDataScope({
    user: currentUser,
    role,
    students,
    teachers,
    courses,
    classrooms,
  }), [currentUser, role, students, teachers, courses, classrooms]);

  const displayName = currentUser?.fullName || "Kullanıcı";
  const openTasks = tasks.filter((task) => task.status !== "done");
  const assignedTasks = openTasks.filter((task) => {
    const assignee = normalizeText(task.assignee);
    return assignee && (assignee.includes(normalizeText(displayName)) || assignee.includes(normalizeText(currentUser?.username)));
  });
  const visibleStudents = dataScope.students;
  const criticalStudents = visibleStudents.filter((student) => {
    const risk = Number(student.riskScore ?? student.academicRisk ?? student.guidanceRisk ?? 0);
    const absence = Number(student.absence ?? student.totalAbsence ?? student.absenceDays ?? 0);
    return risk >= 70 || absence >= 20;
  }).length;

  const roleMetrics = role === "teacher"
    ? [
        { label: "Yetkili öğrenciler", value: visibleStudents.length, icon: GraduationCap },
        { label: "Bana atanmış görev", value: assignedTasks.length, icon: ClipboardCheck },
        { label: "İzlenecek öğrenci", value: criticalStudents, icon: HeartHandshake },
      ]
    : role === "counselor"
      ? [
          { label: "Riskli öğrenci", value: criticalStudents, icon: HeartHandshake },
          { label: "Açık rehberlik görevi", value: assignedTasks.length || openTasks.length, icon: ClipboardCheck },
          { label: "Yetkili öğrenciler", value: visibleStudents.length, icon: GraduationCap },
        ]
      : [
          { label: "Aktif yönetim görevi", value: openTasks.length, icon: ClipboardCheck },
          { label: "Kritik öğrenci", value: criticalStudents, icon: HeartHandshake },
          { label: "Aktif sınıf", value: stats.totalClasses, icon: Users },
        ];


  const currentUserId = String(currentUser?.id || "").trim();
  const currentUserName = normalizeText(currentUser?.fullName || currentUser?.username || "");
  const visibleAcademicRiskAlerts = academicRiskAlerts
    .filter((alert) => {
      const recipientIds = [
        ...(Array.isArray(alert.recipientTeacherIds) ? alert.recipientTeacherIds : []),
        ...(Array.isArray(alert.recipientMentorIds) ? alert.recipientMentorIds : []),
      ].map(String);
      const recipientNames = [
        ...(Array.isArray(alert.recipientTeacherNames) ? alert.recipientTeacherNames : []),
        ...(Array.isArray(alert.recipientMentorNames) ? alert.recipientMentorNames : []),
      ].map(normalizeText);
      return (currentUserId && recipientIds.includes(currentUserId)) || (currentUserName && recipientNames.includes(currentUserName));
    })
    .sort((a, b) => {
      const riskRank = (value: string) => value === "very-risky" ? 3 : value === "risky" ? 2 : 1;
      return riskRank(b.riskLevel) - riskRank(a.riskLevel) || String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
    })
    .slice(0, 6);

  return (
    <section className="overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white shadow-2xl">
      <div className="grid gap-6 p-6 lg:grid-cols-[1.15fr_1fr] lg:p-8">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-indigo-100">
            <Sparkles className="h-4 w-4" /> Rol Bazlı Çalışma Alanı
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/80 bg-indigo-700 text-xl font-black shadow-xl">
              {(currentUser as any)?.avatar ? <img src={(currentUser as any).avatar} alt={displayName} className="h-full w-full object-cover" /> : displayName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase("tr-TR")}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black tracking-tight sm:text-3xl">Yönetici Paneli</h1>
              <p className="mt-1 truncate text-base font-black text-white">{displayName}</p>
              <p className="mt-1 truncate text-xs font-semibold text-indigo-100/80">{roleLabel(role)} · {roleDescription[role]}</p>
            </div>
          </div>

          {(role === "teacher" || role === "counselor") && (
            <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs font-bold ${dataScope.configured ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-100" : "border-amber-300/25 bg-amber-400/10 text-amber-100"}`}>
              {dataScope.configured
                ? `Veri kapsamı: ${dataScope.allowedClassroomNames.length} sınıf · ${dataScope.courses.length} ders · ${visibleStudents.length} öğrenci`
                : `Veri kapsamı henüz yapılandırılmadı: ${dataScope.reason}`}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {roleMetrics.map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
                <Icon className="h-5 w-5 text-indigo-200" />
                <div className="mt-3 text-2xl font-black">{value}</div>
                <div className="mt-1 text-xs font-bold text-indigo-100/70">{label}</div>
              </div>
            ))}
          </div>

          {visibleAcademicRiskAlerts.length > 0 && (
            <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-200" />
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-200">Akademik Risk Bildirimi</div>
                  <div className="mt-0.5 text-xs font-bold text-white">Ders öğretmeni / mentör bilgilendirmesi</div>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {visibleAcademicRiskAlerts.map((alert) => (
                  <div key={alert.id} className="rounded-xl border border-white/10 bg-black/15 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="block truncate text-[11px] font-black text-white">{alert.studentName} · {alert.classroom}</strong>
                        <span className="mt-0.5 block text-[9px] font-bold text-indigo-100/70">{alert.examName} · {alert.subjectName}</span>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[8px] font-black ${alert.riskLevel === "very-risky" ? "bg-rose-600 text-white" : alert.riskLevel === "risky" ? "bg-amber-400 text-slate-950" : "bg-sky-400 text-slate-950"}`}>{alert.riskLabel}</span>
                    </div>
                    <p className="mt-2 text-[9px] font-semibold leading-4 text-indigo-50/85">{alert.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-black">
            <Sparkles className="h-4 w-4 text-amber-300" /> Hızlı çalışma alanınız
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {roleActions[role].map(({ label, description, tab, icon: Icon }) => (
              <button
                key={`${role}-${label}`}
                type="button"
                onClick={() => onNavigate(tab)}
                className="group rounded-2xl border border-white/10 bg-white/10 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/15"
              >
                <Icon className="h-5 w-5 text-indigo-200 transition group-hover:text-white" />
                <div className="mt-3 text-sm font-black">{label}</div>
                <div className="mt-1 text-[11px] font-semibold leading-5 text-indigo-100/65">{description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
