import React, { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Circle,
  FlaskConical,
  Landmark,
  Leaf,
  Loader2,
  Palette,
  Save,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import type { Classroom, Teacher, Student } from "../types";
import type { AccessControlState, PanelUser } from "../lib/accessControl";
import { fetchCollectionFromLocalDatabase, syncCollectionToLocalDatabase } from "../lib/localDatabase";
import { sqliteStorage } from "../core/state/SyncStateStore";

type ThemeId = "culture" | "art" | "sport" | "science" | "nature";
type TabId = "clubs" | "special-days" | "assignments" | "lists";

type ClubDefinition = {
  id: string;
  themeId: ThemeId;
  name: string;
  mandatory: boolean;
};

type ClubAdvisor = {
  id: string;
  name: string;
};

type ClubSelection = {
  clubId: string;
  selected: boolean;
  advisorTeachers: ClubAdvisor[];
  studentIds: string[];
};

type SpecialDayRow = {
  id: string;
  period: string;
  name: string;
  themeId: ThemeId;
  explanation?: string;
  clubId: string;
  secondaryClubId: string;
  displayDate: string;
  selected: boolean;
  assignedStudentIds: string[];
  secondaryStudentIds: string[];
};

type Props = {
  teachers: Teacher[];
  students: Student[];
  classrooms: Classroom[];
  accessState: AccessControlState;
  currentUser: PanelUser;
};

const THEMES: Array<{
  id: ThemeId;
  title: string;
  accent: string;
  soft: string;
  selectedSurface: string;
  border: string;
  icon: React.ComponentType<{ className?: string }>;
  note?: string;
}> = [
  {
    id: "culture",
    title: "Kültür Dünyamız",
    accent: "bg-violet-600",
    soft: "bg-violet-50",
    selectedSurface: "bg-violet-100/80",
    border: "border-violet-200",
    icon: Landmark,
    note: "Her öğrencinin bu temadan en az bir faaliyette aktif görev alması esastır.",
  },
  {
    id: "art",
    title: "Sanat",
    accent: "bg-rose-500",
    soft: "bg-rose-50",
    selectedSurface: "bg-rose-100/80",
    border: "border-rose-200",
    icon: Palette,
    note: "5 tema kuralı için bu temadan en az 1 kulüp açılmalıdır.",
  },
  {
    id: "sport",
    title: "Spor",
    accent: "bg-amber-500",
    soft: "bg-amber-50",
    selectedSurface: "bg-amber-100/80",
    border: "border-amber-200",
    icon: Trophy,
  },
  {
    id: "science",
    title: "Bilim",
    accent: "bg-sky-600",
    soft: "bg-sky-50",
    selectedSurface: "bg-sky-100/80",
    border: "border-sky-200",
    icon: FlaskConical,
  },
  {
    id: "nature",
    title: "Doğa - Çevre - Toplum",
    accent: "bg-emerald-600",
    soft: "bg-emerald-50",
    selectedSurface: "bg-emerald-100/80",
    border: "border-emerald-200",
    icon: Leaf,
  },
];

const CLUBS: ClubDefinition[] = [
  { id: "culture-history", themeId: "culture", name: "Tarih ve Kültürel Miras Kulübü", mandatory: true },
  { id: "culture-life", themeId: "culture", name: "Yaşam Becerileri Kulübü", mandatory: true },
  { id: "culture-publishing", themeId: "culture", name: "Kültür ve Yayıncılık Kulübü", mandatory: false },
  { id: "culture-civilization", themeId: "culture", name: "Medeniyet ve Düşünce Kulübü", mandatory: false },
  { id: "culture-philosophy", themeId: "culture", name: "Felsefe ve Münazara Kulübü", mandatory: false },
  { id: "culture-language", themeId: "culture", name: "Dil, Hitabet ve İletişim Kulübü", mandatory: false },
  { id: "culture-travel", themeId: "culture", name: "Gezi ve Turizm Kulübü", mandatory: false },
  { id: "culture-inclusive", themeId: "culture", name: "Kapsayıcı Yaşam Kulübü", mandatory: false },
  { id: "culture-ahi", themeId: "culture", name: "Ahilik ve Fütüvvet Kulübü", mandatory: false },

  { id: "art-visual", themeId: "art", name: "Görsel Sanatlar Kulübü", mandatory: false },
  { id: "art-music", themeId: "art", name: "Müzik Kulübü", mandatory: false },
  { id: "art-stage", themeId: "art", name: "Sahne Sanatları (Tiyatro) Kulübü", mandatory: false },
  { id: "art-photo", themeId: "art", name: "Fotoğrafçılık ve Film Kulübü", mandatory: false },
  { id: "art-digital", themeId: "art", name: "Dijital Sanatlar Kulübü", mandatory: false },
  { id: "art-traditional", themeId: "art", name: "Gelenekli Sanatlar Kulübü", mandatory: false },
  { id: "art-literature", themeId: "art", name: "Edebiyat ve Yazarlık Kulübü", mandatory: false },

  { id: "sport-health", themeId: "sport", name: "Sağlıklı Yaşam ve Fiziksel Aktivite Kulübü", mandatory: true },
  { id: "sport-main", themeId: "sport", name: "Spor Kulübü (Takım/Bireysel)", mandatory: false },
  { id: "sport-ancestral", themeId: "sport", name: "Ata Sporları Kulübü", mandatory: false },
  { id: "sport-folk", themeId: "sport", name: "Halk Oyunları Kulübü", mandatory: false },
  { id: "sport-scout", themeId: "sport", name: "İzcilik ve Doğa Sporları Kulübü", mandatory: false },
  { id: "sport-mind", themeId: "sport", name: "Akıl ve Zekâ Oyunları Kulübü", mandatory: false },
  { id: "sport-child", themeId: "sport", name: "Çocuk Oyunları Kulübü", mandatory: false },

  { id: "science-cyber", themeId: "science", name: "Siberay Kulübü (Güvenli Dijital Yaşam)", mandatory: true },
  { id: "science-media", themeId: "science", name: "Medya ve Bilgi Okuryazarlığı Kulübü", mandatory: false },
  { id: "science-citizenship", themeId: "science", name: "Dijital Vatandaşlık ve Sosyal Medya Kulübü", mandatory: false },
  { id: "science-tech", themeId: "science", name: "Bilim ve Teknoloji Kulübü", mandatory: false },
  { id: "science-ai", themeId: "science", name: "Yapay Zekâ Kulübü", mandatory: false },
  { id: "science-skills", themeId: "science", name: "Dijital Beceriler Kulübü", mandatory: false },
  { id: "science-project", themeId: "science", name: "Proje ve Araştırma Kulübü", mandatory: false },
  { id: "science-space", themeId: "science", name: "Havacılık ve Uzay Kulübü", mandatory: false },
  { id: "science-design", themeId: "science", name: "Tasarım ve Mühendislik Kulübü", mandatory: false },
  { id: "science-analogy", themeId: "science", name: "Analoji ve Tasarım Kulübü", mandatory: false },
  { id: "science-math", themeId: "science", name: "Matematik Kulübü", mandatory: false },
  { id: "science-social", themeId: "science", name: "Sosyal Bilimler Kulübü", mandatory: false },
  { id: "science-entrepreneur", themeId: "science", name: "Girişimcilik ve Üretkenlik Kulübü", mandatory: false },

  { id: "nature-habitable", themeId: "nature", name: "Tabiat ve Yaşanabilir Çevre Kulübü", mandatory: true },
  { id: "nature-redcrescent", themeId: "nature", name: "Kızılay Kulübü", mandatory: true },
  { id: "nature-green", themeId: "nature", name: "Yeşilay Kulübü", mandatory: true },
  { id: "nature-white", themeId: "nature", name: "Beyazay Kulübü", mandatory: true },
  { id: "nature-career", themeId: "nature", name: "Meslekî Tanıtım ve Gelişim Kulübü", mandatory: false },
  { id: "nature-kindness", themeId: "nature", name: "Nezaket Hareketi Kulübü", mandatory: false },
  { id: "nature-democracy", themeId: "nature", name: "Demokrasi ve İnsan Hakları Kulübü", mandatory: false },
  { id: "nature-traffic", themeId: "nature", name: "Trafik ve İlk Yardım Kulübü", mandatory: false },
  { id: "nature-disaster", themeId: "nature", name: "Afet Farkındalığı Kulübü", mandatory: false },
];

const SPECIAL_DAY_SEEDS: Array<Omit<SpecialDayRow, "clubId" | "secondaryClubId" | "displayDate" | "selected" | "assignedStudentIds" | "secondaryStudentIds">> = [
  { id: "sep-democracy", period: "Ders yılının 2. haftası", name: "15 Temmuz Demokrasi ve Millî Birlik Günü anma çalışması", themeId: "culture" },
  { id: "sep-veterans", period: "19 Eylül", name: "Gaziler Günü", themeId: "culture" },
  { id: "sep-mawlid", period: "Diyanet tarafından belirlenen hafta", name: "Mevlid-i Nebî Haftası", themeId: "culture" },
  { id: "oct-animals", period: "4 Ekim", name: "Hayvanları Koruma Günü", themeId: "nature" },
  { id: "oct-ahi", period: "8-12 Ekim", name: "Ahilik Kültürü Haftası", themeId: "culture" },
  { id: "oct-un", period: "24 Ekim", name: "Birleşmiş Milletler Günü", themeId: "nature" },
  { id: "oct-republic", period: "29 Ekim", name: "Cumhuriyet Bayramı", themeId: "culture" },
  { id: "oct-redcrescent", period: "29 Ekim-4 Kasım", name: "Kızılay Haftası", themeId: "nature" },
  { id: "nov-leukemia", period: "2-8 Kasım", name: "Lösemili Çocuklar Haftası", themeId: "nature" },
  { id: "nov-organ", period: "3-9 Kasım", name: "Organ Bağışı ve Nakli Haftası", themeId: "nature" },
  { id: "nov-ataturk", period: "10-16 Kasım", name: "Atatürk Haftası", themeId: "culture" },
  { id: "nov-disaster", period: "12 Kasım", name: "Afet Eğitimi Hazırlık Günü", themeId: "nature" },
  { id: "nov-philosophy", period: "20 Kasım", name: "Dünya Felsefe Günü", themeId: "culture" },
  { id: "nov-child-rights", period: "20 Kasım", name: "Dünya Çocuk Hakları Günü", themeId: "nature" },
  { id: "nov-teachers", period: "24 Kasım", name: "Öğretmenler Günü", themeId: "culture" },
  { id: "dec-disabled", period: "3 Aralık", name: "Dünya Engelliler Günü", themeId: "nature" },
  { id: "dec-women", period: "5 Aralık", name: "Türk Kadınına Seçme ve Seçilme Hakkının Verilişi", themeId: "culture" },
  { id: "dec-human-rights", period: "10 Aralık gününü içine alan hafta", name: "İnsan Hakları ve Demokrasi Haftası", themeId: "nature" },
  { id: "dec-domestic-goods", period: "12-18 Aralık", name: "Tutum, Yatırım ve Türk Malları Haftası", themeId: "culture" },
  { id: "dec-akif", period: "20-27 Aralık", name: "Mehmet Akif Ersoy’u Anma Haftası", themeId: "culture" },
  { id: "jan-energy", period: "Ocak ayının 2. haftası", name: "Enerji Tasarrufu Haftası", themeId: "nature" },
  { id: "feb-tax", period: "Şubat ayının son haftası", name: "Vergi Haftası", themeId: "science" },
  { id: "feb-civil-defense", period: "28 Şubat", name: "Sivil Savunma Günü", themeId: "nature" },
  { id: "mar-green", period: "1 Mart gününü içine alan hafta", name: "Yeşilay Haftası", themeId: "nature" },
  { id: "mar-entrepreneurship", period: "Mart ayının ilk haftası", name: "Girişimcilik Haftası", themeId: "science" },
  { id: "mar-science-tech", period: "8-14 Mart", name: "Bilim ve Teknoloji Haftası", themeId: "science" },
  { id: "mar-anthem", period: "12 Mart", name: "İstiklâl Marşı’nın Kabulü ve Mehmet Akif Ersoy’u Anma Günü", themeId: "culture" },
  { id: "mar-martyrs", period: "18 Mart", name: "Şehitler Günü", themeId: "culture" },
  { id: "mar-turkic", period: "21 Mart gününü içine alan hafta", name: "Türk Dünyası ve Toplulukları Haftası / Nevruz", themeId: "culture" },
  { id: "mar-forest", period: "21-26 Mart", name: "Orman Haftası", themeId: "nature" },
  { id: "mar-theatre", period: "27 Mart", name: "Dünya Tiyatrolar Günü", themeId: "art" },
  { id: "mar-library", period: "Martın son pazartesisini içine alan hafta", name: "Kütüphaneler Haftası", themeId: "culture" },
  { id: "apr-autism", period: "2 Nisan", name: "Dünya Otizm Farkındalık Günü", themeId: "nature" },
  { id: "apr-kvkk", period: "7 Nisan", name: "Kişisel Verileri Koruma Günü", themeId: "science" },
  { id: "apr-tourism", period: "15-22 Nisan", name: "Turizm Haftası", themeId: "culture" },
  { id: "apr-sovereignty", period: "23 Nisan", name: "Ulusal Egemenlik ve Çocuk Bayramı", themeId: "culture" },
  { id: "apr-ip", period: "26 Nisan", name: "Dünya Fikrî Mülkiyet Günü", themeId: "science" },
  { id: "apr-kut", period: "29 Nisan", name: "Kût’ül Amâre Zaferi", themeId: "culture" },
  { id: "may-it", period: "Mayıs ayının ilk haftası", name: "Bilişim Haftası", themeId: "science" },
  { id: "may-traffic", period: "Mayıs ayının ilk haftası", name: "Trafik ve İlk Yardım Haftası", themeId: "nature" },
  { id: "may-osh", period: "4-10 Mayıs", name: "İş Sağlığı ve Güvenliği Haftası", themeId: "nature" },
  { id: "may-disabled", period: "10-16 Mayıs", name: "Engelliler Haftası", themeId: "nature" },
  { id: "may-museums", period: "18-24 Mayıs", name: "Müzeler Haftası", themeId: "culture" },
  { id: "may-youth", period: "19 Mayıs", name: "Atatürk’ü Anma, Gençlik ve Spor Bayramı", themeId: "sport" },
  { id: "may-ethics", period: "25 Mayıs", name: "Etik Günü", themeId: "culture" },
  { id: "may-conquest", period: "29 Mayıs", name: "İstanbul’un Fethi", themeId: "culture" },
  { id: "jun-environment", period: "Haziran ayının 2. haftası", name: "Çevre Koruma Haftası", themeId: "nature" },
];

const initialClubSelections = (): ClubSelection[] =>
  CLUBS.map((club) => ({
    clubId: club.id,
    selected: club.mandatory,
    advisorTeachers: [],
    studentIds: [],
  }));

const initialSpecialDays = (): SpecialDayRow[] =>
  SPECIAL_DAY_SEEDS.map((item) => ({
    ...item,
    clubId: "",
    secondaryClubId: "",
    displayDate: "",
    selected: false,
    assignedStudentIds: [],
    secondaryStudentIds: [],
  }));

const getTheme = (id: ThemeId) => THEMES.find((theme) => theme.id === id) || THEMES[0];

const storageKey = (schoolId: string, suffix: string) => `enstitu_${schoolId}_${suffix}`;

export default function SocialClubsActivitiesModule({ teachers, students, classrooms, accessState, currentUser }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("clubs");
  const [reportList, setReportList] = useState<"class-distribution" | "club-members" | "">("");
  const [reportScope, setReportScope] = useState<"all" | "class" | "club">("all");
  const [reportClass, setReportClass] = useState("");
  const [classListLayout, setClassListLayout] = useState<"students" | "clubs">("students");
  const [reportClub, setReportClub] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [activeList, setActiveList] = useState<"club-plans" | "school-plan" | "approved-events" | "realization-reports" | "">("");
  const [clubSelections, setClubSelections] = useState<ClubSelection[]>(initialClubSelections);
  const [customClubs, setCustomClubs] = useState<ClubDefinition[]>([]);
  const [clubModalOpen, setClubModalOpen] = useState(false);
  const [newClubName, setNewClubName] = useState("");
  const [newClubType, setNewClubType] = useState<"mandatory" | "optional">("optional");
  const [specialDays, setSpecialDays] = useState<SpecialDayRow[]>(initialSpecialDays);
  const [loading, setLoading] = useState(true);
  const [savingClubs, setSavingClubs] = useState(false);
  const [message, setMessage] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [memberClubId, setMemberClubId] = useState("");
  const [memberNumber, setMemberNumber] = useState("");
  const [selectedClubId, setSelectedClubId] = useState("");
  const [clubSearch, setClubSearch] = useState("");
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [eventName, setEventName] = useState("");
  const [eventExplanation, setEventExplanation] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventMainClubId, setEventMainClubId] = useState("");
  const [eventSecondClubId, setEventSecondClubId] = useState("");
  const [eventThemeId, setEventThemeId] = useState<ThemeId | "">("");

  const schoolId = currentUser.schoolId || accessState.activeSchoolId || "school-main";

  const homeroomTeacherIds = useMemo(() => {
    const normalize = (value: unknown) =>
      String(value || "")
        .trim()
        .toLocaleUpperCase("tr-TR")
        .replace(/\s+/g, " ");

    const ids = new Set<string>();
    classrooms.forEach((classroom) => {
      (classroom.assignedCourses || []).forEach((course) => {
        if (normalize(course?.courseName) !== "REHBERLİK VE YÖNLENDİRME") return;
        if (course?.teacherId) ids.add(String(course.teacherId));
        if (course?.teacherId2) ids.add(String(course.teacherId2));
      });
    });
    return ids;
  }, [classrooms]);

  const showToast = (text: string) => {
    setToastMessage(text);
    window.clearTimeout((window as any).__socialClubToastTimer);
    (window as any).__socialClubToastTimer = window.setTimeout(() => setToastMessage(""), 3000);
  };

  const activeTeachers = useMemo(
    () =>
      teachers
        .filter((teacher) => teacher && teacher.status !== "İzinli")
        .filter((teacher) => !homeroomTeacherIds.has(String(teacher.id)))
        .sort((a, b) => a.name.localeCompare(b.name, "tr")),
    [teachers, homeroomTeacherIds],
  );

  const allClubs = useMemo(() => [...CLUBS, ...customClubs], [customClubs]);

  const selectedClubs = useMemo(() => {
    const byId = new Map<string, ClubSelection>(clubSelections.map((item) => [item.clubId, item]));
    return allClubs.filter((club) => byId.get(club.id)?.selected).map((club) => ({
      ...club,
      selection: byId.get(club.id)!,
    }));
  }, [clubSelections, allClubs]);

  const filteredSelectedClubs = useMemo(() => {
    const query = clubSearch.trim().toLocaleLowerCase("tr-TR");
    return selectedClubs.filter((club) => !query || club.name.toLocaleLowerCase("tr-TR").includes(query));
  }, [selectedClubs, clubSearch]);

  const assignedAdvisorTeacherIds = useMemo(() => {
    const ids = new Set<string>();
    clubSelections.forEach((selection) => {
      if (!selection.selected) return;
      selection.advisorTeachers.forEach((teacher) => ids.add(String(teacher.id)));
    });
    return ids;
  }, [clubSelections]);

  const currentClub = useMemo(
    () => filteredSelectedClubs.find((club) => club.id === selectedClubId) || filteredSelectedClubs[0] || null,
    [filteredSelectedClubs, selectedClubId],
  );

  useEffect(() => {
    if (currentClub && currentClub.id !== selectedClubId) setSelectedClubId(currentClub.id);
    if (!currentClub && selectedClubId) setSelectedClubId("");
  }, [currentClub, selectedClubId]);

  const currentClubEvents = useMemo(() => {
    if (!currentClub) return [] as SpecialDayRow[];
    return specialDays
      .filter((row) => row.selected && (row.clubId === currentClub.id || row.secondaryClubId === currentClub.id))
      .sort((a, b) => (a.displayDate || "9999-12-31").localeCompare(b.displayDate || "9999-12-31") || a.name.localeCompare(b.name, "tr"));
  }, [specialDays, currentClub]);

  const addAdvisorTeacher = (clubId: string, teacherId: string) => {
    if (!teacherId) return;
    const teacher = activeTeachers.find((item) => String(item.id) === String(teacherId));
    if (!teacher) return;
    setClubSelections((prev) =>
      prev.map((item) => {
        if (item.clubId !== clubId) return item;
        if (item.advisorTeachers.some((advisor) => String(advisor.id) === String(teacher.id))) return item;
        return { ...item, advisorTeachers: [...item.advisorTeachers, { id: String(teacher.id), name: teacher.name }] };
      }),
    );
  };

  const removeAdvisorTeacher = (clubId: string, teacherId: string) => {
    setClubSelections((prev) =>
      prev.map((item) =>
        item.clubId === clubId
          ? { ...item, advisorTeachers: item.advisorTeachers.filter((teacher) => String(teacher.id) !== String(teacherId)) }
          : item,
      ),
    );
  };

  const sanitizeAdvisorAssignments = (selections: ClubSelection[]) => {
    const usedTeacherIds = new Set<string>();
    return selections.map((selection) => ({
      ...selection,
      advisorTeachers: selection.advisorTeachers.filter((teacher) => {
        const teacherId = String(teacher.id);
        if (homeroomTeacherIds.has(teacherId) || usedTeacherIds.has(teacherId)) return false;
        usedTeacherIds.add(teacherId);
        return true;
      }),
    }));
  };

  useEffect(() => {
    let alive = true;
    const hydrate = async () => {
      setLoading(true);
      const localClubs = sqliteStorage.getItem(storageKey(schoolId, "social_club_setup"));
      const localDays = sqliteStorage.getItem(storageKey(schoolId, "social_special_days"));
      try {
        const [clubRows, dayRows] = await Promise.all([
          fetchCollectionFromLocalDatabase("socialClubSetup"),
          fetchCollectionFromLocalDatabase("socialSpecialDays"),
        ]);
        if (!alive) return;

        const persistedDefinitions = Array.isArray(clubRows?.[0]?.customClubs)
          ? clubRows[0].customClubs
          : localClubs ? JSON.parse(localClubs)?.customClubs : [];
        const restoredClubs: ClubDefinition[] = Array.isArray(persistedDefinitions)
          ? persistedDefinitions.filter((item: any) => item && typeof item.id === "string" && typeof item.name === "string" && !CLUBS.some((club) => club.id === item.id))
              .map((item: any) => ({ id: item.id, name: item.name, mandatory: Boolean(item.mandatory), themeId: "culture" as ThemeId }))
          : [];
        setCustomClubs(restoredClubs);
        const savedSelections = Array.isArray(clubRows?.[0]?.selections)
          ? clubRows[0].selections
          : localClubs
            ? JSON.parse(localClubs)?.selections
            : null;
        if (Array.isArray(savedSelections)) {
          const savedMap = new Map<string, ClubSelection>((savedSelections as ClubSelection[]).map((item) => [item.clubId, item]));
          setClubSelections(
            sanitizeAdvisorAssignments(
              [...CLUBS, ...restoredClubs].map((club) => ({
                clubId: club.id,
                selected: club.mandatory ? true : Boolean(savedMap.get(club.id)?.selected),
                studentIds: Array.isArray(savedMap.get(club.id)?.studentIds) ? savedMap.get(club.id)!.studentIds.map(String) : [],
                advisorTeachers: (() => {
                  const saved = savedMap.get(club.id) as any;
                  if (Array.isArray(saved?.advisorTeachers)) {
                    return saved.advisorTeachers.filter((teacher: any) => teacher?.id && teacher?.name).map((teacher: any) => ({ id: String(teacher.id), name: String(teacher.name) }));
                  }
                  if (saved?.advisorTeacherId && saved?.advisorTeacherName) return [{ id: String(saved.advisorTeacherId), name: String(saved.advisorTeacherName) }];
                  return [];
                })(),
              })),
            ),
          );
        }

        const savedDays = Array.isArray(dayRows) && dayRows.length ? dayRows : localDays ? JSON.parse(localDays) : [];
        if (Array.isArray(savedDays) && savedDays.length) {
          const savedMap = new Map<string, SpecialDayRow>((savedDays as SpecialDayRow[]).map((item) => [item.id, item]));
          setSpecialDays([
            ...initialSpecialDays().map((seed) => {
              const saved = savedMap.get(seed.id);
              return {
                ...seed,
                clubId: saved?.clubId || "",
                secondaryClubId: saved?.secondaryClubId && saved.secondaryClubId !== saved?.clubId ? saved.secondaryClubId : "",
                displayDate: saved?.displayDate || "",
                selected: saved?.selected === true || (saved?.selected === undefined && Boolean(saved?.clubId)),
                assignedStudentIds: Array.isArray(saved?.assignedStudentIds) ? saved.assignedStudentIds.map(String) : [],
                secondaryStudentIds: Array.isArray(saved?.secondaryStudentIds) ? saved.secondaryStudentIds.map(String) : [],
                themeId: (saved?.themeId as ThemeId) || seed.themeId,
              };
            }),
            ...(savedDays as SpecialDayRow[]).filter((day) => !SPECIAL_DAY_SEEDS.some((seed) => seed.id === day.id)),
          ]);
        }
      } catch {
        if (!alive) return;
        try {
          if (localClubs) {
            const parsed = JSON.parse(localClubs);
            const restoredClubs: ClubDefinition[] = Array.isArray(parsed?.customClubs)
              ? parsed.customClubs.filter((item: any) => item && typeof item.id === "string" && typeof item.name === "string" && !CLUBS.some((club) => club.id === item.id))
                  .map((item: any) => ({ id: item.id, name: item.name, mandatory: Boolean(item.mandatory), themeId: "culture" as ThemeId }))
              : [];
            setCustomClubs(restoredClubs);
            const savedMap = new Map<string, ClubSelection>(((parsed?.selections || []) as ClubSelection[]).map((item) => [item.clubId, item]));
            setClubSelections(
              sanitizeAdvisorAssignments(
                [...CLUBS, ...restoredClubs].map((club) => ({
                  clubId: club.id,
                  selected: club.mandatory ? true : Boolean(savedMap.get(club.id)?.selected),
                  studentIds: Array.isArray(savedMap.get(club.id)?.studentIds) ? savedMap.get(club.id)!.studentIds.map(String) : [],
                  advisorTeachers: (() => {
                    const saved = savedMap.get(club.id) as any;
                    if (Array.isArray(saved?.advisorTeachers)) {
                      return saved.advisorTeachers.filter((teacher: any) => teacher?.id && teacher?.name).map((teacher: any) => ({ id: String(teacher.id), name: String(teacher.name) }));
                    }
                    if (saved?.advisorTeacherId && saved?.advisorTeacherName) return [{ id: String(saved.advisorTeacherId), name: String(saved.advisorTeacherName) }];
                    return [];
                  })(),
                })),
              ),
            );
          }
          if (localDays) {
            const parsed = JSON.parse(localDays);
            const savedMap = new Map<string, SpecialDayRow>(((Array.isArray(parsed) ? parsed : []) as SpecialDayRow[]).map((item) => [item.id, item]));
            setSpecialDays([
              ...initialSpecialDays().map((seed) => {
                const saved = savedMap.get(seed.id);
                return {
                  ...seed,
                  clubId: saved?.clubId || "",
                  secondaryClubId: saved?.secondaryClubId && saved.secondaryClubId !== saved?.clubId ? saved.secondaryClubId : "",
                  displayDate: saved?.displayDate || "",
                  selected: saved?.selected === true || (saved?.selected === undefined && Boolean(saved?.clubId)),
                  assignedStudentIds: Array.isArray(saved?.assignedStudentIds) ? saved.assignedStudentIds.map(String) : [],
                  secondaryStudentIds: Array.isArray(saved?.secondaryStudentIds) ? saved.secondaryStudentIds.map(String) : [],
                  themeId: (saved?.themeId as ThemeId) || seed.themeId,
                };
              }),
              ...(parsed as SpecialDayRow[]).filter((day) => !SPECIAL_DAY_SEEDS.some((seed) => seed.id === day.id)),
            ]);
          }
        } catch {
          // devam
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    void hydrate();
    return () => {
      alive = false;
      window.clearTimeout((window as any).__socialClubToastTimer);
    };
  }, [schoolId, homeroomTeacherIds]);

  const addNewClub = async () => {
    const name = newClubName.trim().replace(/\s+/g, " ");
    if (!name) { setMessage("Kulüp adını yazınız."); return; }
    if (allClubs.some((club) => club.name.trim().toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) {
      setMessage("Bu isimde bir kulüp zaten kayıtlı."); return;
    }
    if (savingClubs) return;
    const club: ClubDefinition = { id: `school-club-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, mandatory: newClubType === "mandatory", themeId: "culture" };
    const nextClubs = [...customClubs, club];
    const nextSelections = [...clubSelections, { clubId: club.id, selected: true, advisorTeachers: [], studentIds: [] }];
    const payload = { id: "school-social-club-setup", schoolId, selections: nextSelections, customClubs: nextClubs, updatedAt: new Date().toISOString() };
    setSavingClubs(true);
    setMessage("");
    try {
      await syncCollectionToLocalDatabase("socialClubSetup", [payload]);
      sqliteStorage.setItem(storageKey(schoolId, "social_club_setup"), JSON.stringify(payload));
      const mirror = [...selectedClubs, { ...club, selection: nextSelections[nextSelections.length - 1] }].map((item) => ({
        id: item.id, name: item.name, clubName: item.name, themeId: item.themeId,
        themeName: getTheme(item.themeId).title, mandatory: item.mandatory,
        advisorTeacherIds: item.selection.advisorTeachers.map((teacher) => teacher.id),
        advisorTeacherNames: item.selection.advisorTeachers.map((teacher) => teacher.name),
        advisorTeacherId: item.selection.advisorTeachers[0]?.id || "",
        advisorTeacherName: item.selection.advisorTeachers[0]?.name || "",
        responsibleTeachers: item.selection.advisorTeachers.map((teacher) => teacher.name),
      }));
      sqliteStorage.setItem("social_clubs", JSON.stringify(mirror));
      setCustomClubs(nextClubs);
      setClubSelections(nextSelections);
      setSelectedClubId(club.id);
      setClubModalOpen(false);
      setNewClubName("");
      setNewClubType("optional");
      showToast("Kulüp kaydedildi.");
    } catch {
      setMessage("Kulüp veritabanına kaydedilemedi. Lütfen tekrar deneyiniz.");
    } finally { setSavingClubs(false); }
  };

  const saveClubSetup = async () => {
    setSavingClubs(true);
    setMessage("");
    const payload = { id: "school-social-club-setup", schoolId, selections: clubSelections, customClubs, updatedAt: new Date().toISOString() };
    const selectedClubMirror = selectedClubs.map((club) => ({
      id: club.id,
      name: club.name,
      clubName: club.name,
      themeId: club.themeId,
      themeName: getTheme(club.themeId).title,
      mandatory: club.mandatory,
      advisorTeacherIds: club.selection.advisorTeachers.map((teacher) => teacher.id),
      advisorTeacherNames: club.selection.advisorTeachers.map((teacher) => teacher.name),
      advisorTeacherId: club.selection.advisorTeachers[0]?.id || "",
      advisorTeacherName: club.selection.advisorTeachers[0]?.name || "",
      responsibleTeachers: club.selection.advisorTeachers.map((teacher) => teacher.name),
    }));
    try {
      sqliteStorage.setItem(storageKey(schoolId, "social_club_setup"), JSON.stringify(payload));
      sqliteStorage.setItem("social_clubs", JSON.stringify(selectedClubMirror));
      await syncCollectionToLocalDatabase("socialClubSetup", [payload]);
      showToast("Kulüp kayıtları kaydedildi.");
    } catch {
      setMessage("Kulüpler yerel olarak kaydedildi; sunucu eşitlemesi daha sonra tekrar denenecek.");
    } finally {
      setSavingClubs(false);
    }
  };

  const updateClubMembers = (clubId: string, studentId: string, shouldAdd: boolean) => {
    const next = clubSelections.map((selection) => {
      if (selection.clubId !== clubId) return selection;
      const ids = shouldAdd ? [...new Set([...(selection.studentIds || []), studentId])] : (selection.studentIds || []).filter((id) => id !== studentId);
      return { ...selection, studentIds: ids };
    });
    setClubSelections(next);
    const payload = { id: "school-social-club-setup", schoolId, selections: next, customClubs, updatedAt: new Date().toISOString() };
    sqliteStorage.setItem(storageKey(schoolId, "social_club_setup"), JSON.stringify(payload));
    void syncCollectionToLocalDatabase("socialClubSetup", [payload]).catch(() => {
      setMessage("Öğrenci değişikliği yerel olarak kaydedildi; sunucu eşitlemesi gerçekleştirilemedi.");
    });
  };

  const persistDays = async (rows: SpecialDayRow[], successText = "Etkinlik kaydedildi.") => {
    sqliteStorage.setItem(storageKey(schoolId, "social_special_days"), JSON.stringify(rows));
    try {
      await syncCollectionToLocalDatabase("socialSpecialDays", rows);
      showToast(successText);
    } catch {
      setMessage("Etkinlik yerel olarak kaydedildi; sunucu eşitlemesi daha sonra tekrar denenecek.");
    }
  };

  const openEventModal = () => {
    const defaultClubId = currentClub?.id || filteredSelectedClubs[0]?.id || "";
    setEventMainClubId(defaultClubId);
    setEventSecondClubId("");
    setEventThemeId("");
    setEventDate("");
    setEventName("");
    setEventExplanation("");
    setEventModalOpen(true);
    setMessage("");
  };

  const addNewEvent = async () => {
    const name = eventName.trim();
    if (!name || !eventDate || !eventMainClubId || !eventThemeId) {
      setMessage("Etkinlik adı, etkinlik tarihi, sorumlu kulüp ve ana tema zorunludur.");
      return;
    }
    if (eventSecondClubId && eventSecondClubId === eventMainClubId) {
      setMessage("Sorumlu kulüp ile yardımcı kulüp aynı olamaz.");
      return;
    }
    if (!selectedClubs.some((club) => club.id === eventMainClubId) || (eventSecondClubId && !selectedClubs.some((club) => club.id === eventSecondClubId))) {
      setMessage("Yalnızca açık kulüpler seçilebilir.");
      return;
    }
    const item: SpecialDayRow = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      explanation: eventExplanation.trim(),
      period: eventDate,
      themeId: eventThemeId,
      displayDate: eventDate,
      clubId: eventMainClubId,
      secondaryClubId: eventSecondClubId,
      selected: true,
      assignedStudentIds: [],
      secondaryStudentIds: [],
    };
    const next = [...specialDays, item];
    setSpecialDays(next);
    setSelectedClubId(eventMainClubId);
    setEventModalOpen(false);
    setEventName("");
    setEventExplanation("");
    setEventDate("");
    setEventThemeId("");
    setEventSecondClubId("");
    setMessage("");
    await persistDays(next, "Etkinlik kaydedildi.");
  };

  const deleteEvent = async (row: SpecialDayRow) => {
    if (!window.confirm(`“${row.name}” etkinliği silinsin mi? Bu işlem onaylandıktan sonra kayıt kaldırılacaktır.`)) return;
    const next = specialDays.filter((item) => item.id !== row.id);
    setSpecialDays(next);
    await persistDays(next, "Etkinlik silindi.");
  };

  const eligibleStudents = useMemo(
    () => students.filter((student) => student.id && student.name && student.status !== "Pasif").sort((a, b) => String(a.classroom).localeCompare(String(b.classroom), "tr", { numeric: true }) || a.name.localeCompare(b.name, "tr")),
    [students],
  );

  const reportClasses = useMemo(() => Array.from(new Set(eligibleStudents.map((student) => String(student.classroom || "").trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, "tr", { numeric: true })), [eligibleStudents]);
  const reportRows = useMemo(() => {
    const memberships = new Map<string, string[]>();
    selectedClubs.forEach((club) => (club.selection.studentIds || []).forEach((id) => {
      const key = String(id);
      memberships.set(key, [...(memberships.get(key) || []), club.name]);
    }));
    return eligibleStudents
      .filter((student) => reportScope !== "class" || !reportClass || String(student.classroom) === reportClass)
      .map((student) => ({
        id: String(student.id),
        classroom: String(student.classroom || ""),
        number: String(student.number ?? student.studentNumber ?? ""),
        name: String(student.name || ""),
        clubs: memberships.get(String(student.id)) || [],
      }))
      .filter((student) => reportScope !== "club" || !reportClub || selectedClubs.some((club) => club.id === reportClub && (club.selection.studentIds || []).some((id) => String(id) === student.id)))
      .sort((a, b) => a.classroom.localeCompare(b.classroom, "tr", { numeric: true }) || (Number(a.number) || 0) - (Number(b.number) || 0) || a.name.localeCompare(b.name, "tr"));
  }, [eligibleStudents, selectedClubs, reportScope, reportClass, reportClub]);

  const downloadReportPdf = async () => {
    if (!reportList) return;
    if (reportScope === "class" && !reportClass) { showToast("Önce sınıf seçiniz."); return; }
    if (reportScope === "club" && !reportClub) { showToast("Önce kulüp seçiniz."); return; }
    setGeneratingPdf(true);
    try {
      const pdfMakeImport = await import("pdfmake/build/pdfmake");
      const fontsImport = await import("pdfmake/build/vfs_fonts");
      const pdfMake = (pdfMakeImport as any).default || pdfMakeImport;
      const fontVfs = (fontsImport as any).default?.pdfMake?.vfs || (fontsImport as any).default || (fontsImport as any).pdfMake?.vfs || fontsImport;
      pdfMake.vfs = fontVfs;
      const reportTitle = reportList === "class-distribution" ? "SINIF KULÜP DAĞILIMI" : "KULÜP ÖĞRENCİ LİSTELERİ";
      const filterTitle = reportScope === "class" ? `Sınıf: ${reportClass}` : reportScope === "club" ? `Kulüp: ${selectedClubs.find((club) => club.id === reportClub)?.name || ""}` : "Genel";
      const sortedStudents = [...reportRows].sort((a, b) =>
        a.classroom.localeCompare(b.classroom, "tr", { numeric: true }) ||
        (Number(a.number) || 0) - (Number(b.number) || 0) || a.name.localeCompare(b.name, "tr"));
      const classNames = Array.from(new Set(sortedStudents.map((student) => student.classroom)));
      const content: any[] = [
        { text: reportTitle, bold: true, fontSize: 15, alignment: "center", margin: [0, 0, 0, 6] },
        { text: `${filterTitle}  |  Kayıt: ${sortedStudents.length}  |  ${new Date().toLocaleDateString("tr-TR")}`, fontSize: 9, alignment: "center", margin: [0, 0, 0, 14] },
      ];
      const addTable = (headers: string[], rows: string[][], widths: any[]) => {
        content.push({
          table: {
            headerRows: 1,
            widths,
            body: [headers.map((value) => ({ text: value, bold: true, fillColor: "#e2e8f0" })),
              ...(rows.length ? rows : [headers.map((_, index) => index === 0 ? "Kayıt bulunamadı" : "")])],
          },
          layout: { fillColor: (row: number) => row > 0 && row % 2 === 0 ? "#f8fafc" : null },
          fontSize: 8,
          margin: [0, 0, 0, 12],
        });
      };
      if (reportList === "class-distribution") {
        classNames.forEach((className) => {
          const studentsInClass = sortedStudents.filter((student) => student.classroom === className);
          content.push({ text: `${className} SINIFI`, fontSize: 11, bold: true, color: "#1e3a8a", margin: [0, 9, 0, 5], keepWithNext: true });
          if (classListLayout === "students") {
            addTable(["Sıra", "Öğrenci No", "Ad Soyad", "Kulüp / Kulüpler"],
              studentsInClass.map((student, index) => [String(index + 1), student.number, student.name, student.clubs.join(", ") || "—"]),
              [29, 66, "*", "*"]);
          } else {
            const classClubs = selectedClubs.filter((club) => studentsInClass.some((student) => student.clubs.includes(club.name)));
            const rows: string[][] = [];
            classClubs.forEach((club) => {
              studentsInClass.filter((student) => student.clubs.includes(club.name)).forEach((student, index) =>
                rows.push([index === 0 ? club.name : "", student.number, student.name]));
            });
            addTable(["Kulüp", "Öğrenci No", "Ad Soyad"], rows, ["*", 72, "*"]);
          }
        });
      } else {
        selectedClubs.filter((club) => reportScope !== "club" || !reportClub || club.id === reportClub).forEach((club) => {
          const clubStudents = sortedStudents.filter((student) => student.clubs.includes(club.name));
          if (!clubStudents.length) return;
          content.push({ text: club.name.toLocaleUpperCase("tr-TR"), bold: true, fontSize: 11, color: "#1e3a8a", margin: [0, 10, 0, 5], keepWithNext: true });
          Array.from(new Set(clubStudents.map((student) => student.classroom))).forEach((className) => {
            const members = clubStudents.filter((student) => student.classroom === className);
            content.push({ text: `${className} SINIFI`, bold: true, fontSize: 9, margin: [0, 6, 0, 3], keepWithNext: true });
            addTable(["Sıra", "Öğrenci No", "Ad Soyad"], members.map((student, index) => [String(index + 1), student.number, student.name]), [36, 82, "*"]);
          });
        });
      }
      if (content.length === 2) content.push({ text: "Kayıt bulunamadı.", fontSize: 10, alignment: "center" });
      const docDefinition: any = {
        pageSize: "A4", pageOrientation: "portrait", pageMargins: [42.52, 36, 42.52, 34],
        content,
        footer: (page: number, total: number) => ({ text: `${page} / ${total}`, alignment: "right", margin: [0, 0, 42.52, 0], fontSize: 8 }),
        defaultStyle: { font: "Roboto" },
      };
      pdfMake.createPdf(docDefinition).download(`${reportList === "class-distribution" ? "Sinif_Kulup_Dagilimi" : "Kulup_Ogrenci_Listeleri"}_${reportScope}.pdf`);
    } catch (err) {
      console.error("Kulüp listesi PDF oluşturulamadı", err);
      showToast("PDF oluşturulamadı. Lütfen yeniden deneyiniz.");
    } finally { setGeneratingPdf(false); }
  };

  const advisorCount = selectedClubs.filter((club) => club.selection.advisorTeachers.length > 0).length;

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 text-sm font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
          <Loader2 className="h-5 w-5 animate-spin text-cyan-600" />
          Sosyal etkinlik verileri hazırlanıyor...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
          <button type="button" onClick={() => setActiveTab("clubs")} className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition ${activeTab === "clubs" ? "bg-blue-700 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`}>
            <BookOpenCheck className="h-4 w-4" /> Sosyal Kulüpler
          </button>
          <button type="button" onClick={() => setActiveTab("assignments")} className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition ${activeTab === "assignments" ? "bg-emerald-600 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`}>
            <BookOpenCheck className="h-4 w-4" /> Etkinlik Planlama
          </button>
          <button type="button" onClick={() => setActiveTab("lists")} className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-black transition ${activeTab === "lists" ? "bg-slate-700 text-white shadow" : "text-slate-600 hover:bg-slate-100"}`}>
            <BookOpenCheck className="h-4 w-4" /> Planlar / Raporlar / Listeler
          </button>
          {activeTab === "lists" && (
            <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
              <select
                aria-label="Listeler"
                value={reportList}
                onChange={(event) => { setReportList(event.target.value as typeof reportList); setActiveList(""); setReportScope("all"); setReportClass(""); setReportClub(""); }}
                className="min-h-[44px] w-full rounded-xl border border-indigo-700 bg-indigo-700 px-4 py-2.5 text-sm font-black text-white shadow-sm outline-none sm:w-[240px]"
              >
                <option value="">Listeler</option>
                <option value="class-distribution">Sınıf Kulüp Dağılımı</option>
                <option value="club-members">Kulüp Öğrenci Listeleri</option>
              </select>
              <select
              aria-label="Plan ve Raporlar"
              value={activeList}
              onChange={(event) => { setActiveList(event.target.value as typeof activeList); setReportList(""); }}
              className="min-h-[44px] w-full rounded-xl border border-red-700 bg-red-600 px-4 py-2.5 text-sm font-black text-white shadow-sm outline-none sm:w-[260px]"
            >
              <option value="">Plan ve Raporlar</option>
              <option value="club-plans">Kulüp Yıllık Planları</option>
              <option value="school-plan">Okul Eylem Planı</option>
              <option value="approved-events">Onaylı Etkinlikler</option>
              <option value="realization-reports">Gerçekleşme Raporları</option>
              </select>
            </div>
          )}
        </div>

        {message && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            {message}
          </div>
        )}

        {toastMessage && (
          <div className="fixed right-6 top-6 z-50 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-2xl shadow-emerald-900/20">
            {toastMessage}
          </div>
        )}

        {activeTab === "clubs" ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(320px,34%)_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">Kulüpler</h3>
                  <p className="text-xs font-bold text-slate-500">{selectedClubs.length} seçili / {allClubs.length} tanımlı</p>
                </div>
                <button type="button" onClick={() => { setNewClubName(""); setNewClubType("optional"); setMessage(""); setClubModalOpen(true); }} className="rounded-xl bg-blue-700 px-3 py-2 text-xs font-black text-white hover:bg-blue-800">+ Kulüp Ekle</button>
              </div>
              <div className="max-h-[76vh] space-y-1 overflow-y-auto px-3 pb-3 pt-2">
                {filteredSelectedClubs.map((club) => {
                  const selected = club.id === currentClub?.id;
                  return (
                    <button key={club.id} type="button" onClick={() => setSelectedClubId(club.id)} className={`flex w-full min-h-[36px] items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${selected ? "border-blue-900 bg-blue-900 text-white shadow-sm" : "border-slate-200 bg-white text-slate-900 hover:bg-slate-50"}`}>
                      <span className="min-w-0 flex-1 text-[13px] font-bold leading-4">{club.name}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${selected ? "bg-white/15 text-white" : club.mandatory ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700"}`}>{club.mandatory ? "Zorunlu" : "Seçmeli"}</span>
                        <span className={selected ? "text-white/70" : "text-slate-300"}>›</span>
                      </div>
                    </button>
                  );
                })}
                {!filteredSelectedClubs.length && <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Eşleşen kulüp bulunamadı.</div>}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              {currentClub ? (
                <div className="p-4 md:p-5">
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
                    <div className="mb-4 rounded-xl bg-sky-100 px-4 py-3"><h3 className="text-lg font-black text-sky-900">Kulüp Öğrencileri</h3></div>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(300px,43%)_minmax(0,1fr)]">
            <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
              {currentClub.id && selectedClubs.some((club) => club.id === currentClub.id) && (() => {
                const activeClubId = currentClub.id;
                const registered = clubSelections.find((item) => item.clubId === activeClubId)?.studentIds || [];
                const query = memberNumber.trim().toLocaleLowerCase("tr-TR");
                const matches = query ? eligibleStudents.filter((student) => /^\d+$/.test(query) ? String(student.number ?? student.studentNumber ?? "").trim() === query : student.name.toLocaleLowerCase("tr-TR").includes(query)) : [];
                const availableMatches = matches.filter((student) => !registered.includes(String(student.id)));
                const sortedAll = [...eligibleStudents].sort((a, b) => String(a.classroom ?? "").localeCompare(String(b.classroom ?? ""), "tr", { numeric: true }) || (Number(a.number ?? a.studentNumber) || 0) - (Number(b.number ?? b.studentNumber) || 0) || a.name.localeCompare(b.name, "tr"));
                return <div className="space-y-3">
                  <input id="club-member-search" value={memberNumber} onChange={(e) => setMemberNumber(e.target.value)} onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (availableMatches.length === 1) {
                        updateClubMembers(activeClubId, String(availableMatches[0].id), true);
                        setMemberNumber("");
                      }
                    }
                  }} placeholder="Öğrenci no veya ad-soyad" className="block w-full rounded-lg border border-amber-400 bg-yellow-200 p-3 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
                  {query && <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">{matches.map((student) => <div key={student.id} className="p-2 text-xs text-slate-700">{student.number ?? student.studentNumber} · {student.name} · {student.classroom}<span className={`ml-2 font-bold ${registered.includes(String(student.id)) ? "text-emerald-700" : "text-slate-500"}`}>{registered.includes(String(student.id)) ? "Kulüpte kayıtlı" : "Kulüpte değil"}</span></div>)}{!matches.length && <p className="p-3 text-xs text-slate-500">Eşleşen öğrenci bulunamadı.</p>}{availableMatches.length === 1 && <p className="bg-yellow-50 p-2 text-xs font-bold text-amber-800">Tek öğrenci bulundu. Kulübe eklemek için Enter'a basınız.</p>}</div>}
                  <div>
                    <h4 className="mb-2 text-sm font-bold text-slate-800">Tüm Öğrenciler ({sortedAll.length})</h4>
                    <div className="max-h-[45vh] overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">{sortedAll.map((student) => {
                      const enrolled = registered.includes(String(student.id));
                      return <button type="button" key={student.id} disabled={enrolled} title={enrolled ? "Bu öğrenci kulüpte kayıtlı" : "Öğrenciyi kulübe ekle"} onClick={() => { updateClubMembers(activeClubId, String(student.id), true); setMemberNumber(""); }} className={`flex w-full items-start justify-between gap-2 p-2 text-left text-xs ${enrolled ? "cursor-default bg-emerald-50/40" : "hover:bg-yellow-100 focus-visible:bg-yellow-100"}`}><span className="text-slate-700">{student.number ?? student.studentNumber} · {student.name} · {student.classroom}</span><span className={`shrink-0 font-semibold ${enrolled ? "text-emerald-700" : "text-slate-400"}`}>{enrolled ? "Kayıtlı" : "Atanmadı"}</span></button>;
                    })}</div>
                  </div>
                </div>;
              })()}
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              {currentClub.id && selectedClubs.some((club) => club.id === currentClub.id) ? (() => {
                const activeClubId = currentClub.id;
                const registered = clubSelections.find((item) => item.clubId === activeClubId)?.studentIds || [];
                const rows = registered.map((id) => ({ id, student: eligibleStudents.find((item) => String(item.id) === id) })).sort((a, b) => String(a.student?.classroom ?? "").localeCompare(String(b.student?.classroom ?? ""), "tr", { numeric: true }) || (Number(a.student?.number ?? a.student?.studentNumber) || 0) - (Number(b.student?.number ?? b.student?.studentNumber) || 0));
                return <><h3 className="mb-3 font-black text-slate-800">Kulübe Kayıtlı Öğrenciler ({rows.length})</h3><div className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">{rows.map(({ id, student }) => <div key={id} className="flex min-w-0 items-start justify-between gap-2 border-b border-slate-100 py-2 text-xs text-slate-700"><span className="min-w-0">{student ? `${student.classroom} · ${student.number ?? student.studentNumber ?? ""} · ${student.name}` : `Öğrenci ID: ${id}`}</span><button type="button" title="Öğrenciyi kulüpten çıkar" aria-label={`${student?.name || id} öğrencisini kulüpten çıkar`} onClick={() => updateClubMembers(activeClubId, id, false)} className="shrink-0 rounded px-1 text-base font-bold text-rose-600 hover:bg-rose-50">×</button></div>)}</div>{!registered.length && <p className="text-sm text-slate-500">Bu kulübe henüz öğrenci eklenmedi.</p>}</>;
              })() : <p className="text-sm text-slate-500">Öğrencileri görmek için soldan bir kulüp seçiniz.</p>}
            </section>
          </div>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-sm text-slate-500">Gösterilecek kulüp bulunamadı.</div>
              )}
            </section>
          </div>
        ) : activeTab === "lists" ? (
          <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
            {reportList && <div className="space-y-4">
              <h3 className="text-lg font-black text-slate-900">{reportList === "class-distribution" ? "Sınıf Kulüp Dağılımı" : "Kulüp Öğrenci Listeleri"}</h3>
              <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:flex-nowrap">
                {reportList === "class-distribution" && (
                  <label className="min-w-[205px] flex-[1.25] space-y-1 text-xs font-black text-slate-700">Liste Düzeni
                    <select value={classListLayout} onChange={(event) => setClassListLayout(event.target.value as "students" | "clubs")}
                      className="block h-11 w-full rounded-lg border border-amber-400 bg-yellow-100 px-3 text-sm font-bold text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-yellow-200">
                      <option value="students">Öğrenciler → Kulüpleri</option>
                      <option value="clubs">Kulüpler → Öğrencileri</option>
                    </select>
                  </label>
                )}
                <label className="min-w-[175px] flex-1 space-y-1 text-xs font-black text-slate-700">PDF Kapsamı
                  <select value={reportScope} onChange={(event) => { setReportScope(event.target.value as typeof reportScope); setReportClass(""); setReportClub(""); }} className="block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                    <option value="all">Genel (Tüm Okul)</option><option value="class">Sınıfa Göre</option>{reportList === "club-members" && <option value="club">Kulübe Göre</option>}
                  </select>
                </label>
                {reportScope === "class" && <label className="min-w-[170px] flex-1 space-y-1 text-xs font-black text-slate-700">Sınıf
                  <select value={reportClass} onChange={(e) => setReportClass(e.target.value)} className="block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Sınıf seçiniz</option>{reportClasses.map((name) => <option key={name} value={name}>{name}</option>)}</select>
                </label>}
                {reportScope === "club" && <label className="min-w-[185px] flex-1 space-y-1 text-xs font-black text-slate-700">Kulüp
                  <select value={reportClub} onChange={(e) => setReportClub(e.target.value)} className="block h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"><option value="">Kulüp seçiniz</option>{selectedClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select>
                </label>}
                <button type="button" disabled={generatingPdf || (reportScope === "class" && !reportClass) || (reportScope === "club" && !reportClub)} onClick={() => void downloadReportPdf()} className="h-11 shrink-0 rounded-xl bg-rose-700 px-5 text-sm font-black text-white hover:bg-rose-800 disabled:opacity-40">{generatingPdf ? "PDF hazırlanıyor..." : "PDF İndir"}</button>
              </div>
              <p className="text-xs text-slate-500">{reportRows.length} öğrenci listeleniyor. PDF, seçilen kapsamdaki mevcut kulüp kayıtlarından hazırlanır.</p>
              <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200 p-3">
                {reportList === "class-distribution" ? (
                  reportClasses.filter((className) => reportRows.some((student) => student.classroom === className)).map((className) => {
                    const studentsInClass = reportRows.filter((student) => student.classroom === className);
                    return <div key={className} className="mb-4">
                      <h4 className="mb-2 text-sm font-black text-blue-900">{className} SINIFI</h4>
                      <table className="w-full text-left text-xs"><thead className="bg-slate-100"><tr>
                        {(classListLayout === "students" ? ["Öğrenci No", "Ad Soyad", "Kulüp / Kulüpler"] : ["Kulüp", "Öğrenci No", "Ad Soyad"]).map((heading) => <th key={heading} className="p-2">{heading}</th>)}
                      </tr></thead><tbody className="divide-y divide-slate-100">
                        {classListLayout === "students" ? studentsInClass.map((student) => <tr key={student.id}><td className="p-2">{student.number}</td><td className="p-2">{student.name}</td><td className="p-2">{student.clubs.join(", ") || "—"}</td></tr>) :
                          selectedClubs.flatMap((club) => studentsInClass.filter((student) => student.clubs.includes(club.name)).map((student, index) => <tr key={`${club.id}-${student.id}`}><td className="p-2">{index === 0 ? club.name : ""}</td><td className="p-2">{student.number}</td><td className="p-2">{student.name}</td></tr>))}
                      </tbody></table>
                    </div>;
                  })
                ) : selectedClubs.filter((club) => reportScope !== "club" || !reportClub || club.id === reportClub).map((club) => {
                  const members = reportRows.filter((student) => student.clubs.includes(club.name));
                  if (!members.length) return null;
                  const classNames = Array.from(new Set(members.map((student) => student.classroom)));
                  return <div key={club.id} className="mb-4">
                    <h4 className="mb-2 text-sm font-black text-blue-900">{club.name}</h4>
                    {classNames.map((className) => <div key={className} className="mb-2">
                      <h5 className="py-1 text-xs font-black text-slate-700">{className} SINIFI</h5>
                      <table className="w-full text-left text-xs"><thead className="bg-slate-100"><tr><th className="p-2">Öğrenci No</th><th className="p-2">Ad Soyad</th></tr></thead><tbody className="divide-y divide-slate-100">
                        {members.filter((student) => student.classroom === className).map((student) => <tr key={student.id}><td className="p-2">{student.number}</td><td className="p-2">{student.name}</td></tr>)}
                      </tbody></table>
                    </div>)}
                  </div>;
                })}
              </div>
            </div>}
            {activeList && <div className="rounded-xl border border-slate-200 bg-slate-50 p-5" aria-live="polite">
              <h4 className="font-black text-slate-900">{{ "club-plans": "Kulüp Yıllık Planları", "school-plan": "Okul Eylem Planı", "approved-events": "Onaylı Etkinlikler", "realization-reports": "Gerçekleşme Raporları" }[activeList]}</h4>
              <p className="mt-2 text-sm text-slate-500">Bu listenin içerik ve çıktı işlemleri henüz tanımlanmadı. Mevcut kayıtlar değiştirilmedi.</p>
            </div>}
          </section>
        ) : (
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <div />
              <label className="w-full min-w-[260px] max-w-sm rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white">Kulüp Seçiniz
                <select value={selectedClubId || ""} onChange={(e) => setSelectedClubId(e.target.value)} className="mt-1 block w-full rounded-lg border border-red-400 bg-red-700 px-3 py-2.5 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-red-200">
                  <option value="" style={{ backgroundColor: "#ffffff", color: "#111827" }}>Kulüp seçiniz</option>
                  {selectedClubs.map((club) => <option key={club.id} value={club.id} style={{ backgroundColor: "#ffffff", color: "#111827" }}>{club.name}</option>)}
                </select>
              </label>
              <button type="button" disabled={!currentClub} onClick={openEventModal} className="justify-self-end rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">+ Etkinlik Ekle</button>
            </div>
            {currentClub ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-100 text-slate-700">
                            <tr>
                              <th className="px-4 py-3 text-left font-black">Tarih</th>
                              <th className="px-4 py-3 text-left font-black">Etkinlik</th>
                              <th className="px-4 py-3 text-left font-black">Tema</th>
                              <th className="px-4 py-3 text-left font-black">İşlemler</th>
                            </tr>
                          </thead>
                          <tbody>
                            {currentClubEvents.map((row) => {
                              const theme = getTheme(row.themeId);
                              return (
                                <tr key={row.id} className="border-t border-slate-100">
                                  <td className="px-4 py-3 font-semibold text-slate-700">{row.displayDate || "—"}</td>
                                  <td className="px-4 py-3 font-bold text-slate-900">{row.name}</td>
                                  <td className="px-4 py-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">{theme.title}</span></td>
                                  <td className="px-4 py-3"><button type="button" onClick={() => void deleteEvent(row)} className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100">Sil</button></td>
                                </tr>
                              );
                            })}
                            {!currentClubEvents.length && (
                              <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-500">Bu kulübe ait planlanmış etkinlik bulunmuyor.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
            ) : <div className="rounded-xl bg-slate-50 p-8 text-center text-sm text-slate-500">Etkinlikleri yönetmek için bir kulüp seçiniz.</div>}
          </div>
        )}

        {clubModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-label="Yeni kulüp ekle">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h3 className="text-xl font-black text-slate-900">Yeni Kulüp Ekle</h3>
                <button type="button" onClick={() => setClubModalOpen(false)} className="text-sm font-semibold text-slate-500">Kapat</button>
              </div>
              <div className="space-y-4 p-6">
                <label className="block text-sm font-bold text-slate-700">Kulüp Adı
                  <input autoFocus value={newClubName} onChange={(event) => setNewClubName(event.target.value)} placeholder="Kulüp adını yazınız" maxLength={160} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
                </label>
                <label className="block text-sm font-bold text-slate-700">Kulüp Türü
                  <select value={newClubType} onChange={(event) => setNewClubType(event.target.value as "mandatory" | "optional")} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-sm">
                    <option value="optional">Seçmeli</option>
                    <option value="mandatory">Zorunlu</option>
                  </select>
                </label>
                <p className="text-xs text-slate-500">Yeni kulüp seçili kulüpler listesine eklenir. Etkinlik teması, etkinlik planlanırken belirlenir.</p>
                {message && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs font-bold text-rose-700">{message}</p>}
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button type="button" onClick={() => setClubModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold">Vazgeç</button>
                <button type="button" disabled={savingClubs} onClick={() => void addNewClub()} className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-black text-white disabled:opacity-50">{savingClubs ? "Kaydediliyor..." : "Kaydet"}</button>
              </div>
            </div>
          </div>
        )}

        {advisorModalOpen && currentClub && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Danışman Öğretmen Atama</h3>
                  <p className="text-sm text-slate-500">{currentClub.name} için danışman öğretmenleri seçiniz.</p>
                </div>
                <button type="button" onClick={() => setAdvisorModalOpen(false)} className="rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-100">Kapat</button>
              </div>
              <div className="space-y-4 p-6">
                <div className="rounded-2xl bg-blue-900 p-4">
                  <div className="flex flex-wrap gap-2">
                    {currentClub.selection.advisorTeachers.length ? currentClub.selection.advisorTeachers.map((advisor) => (
                      <span key={advisor.id} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-xs font-black text-white">
                        {advisor.name}
                        <button type="button" onClick={() => removeAdvisorTeacher(currentClub.id, advisor.id)} className="rounded-full bg-white/20 px-1.5 text-white hover:bg-white/30">×</button>
                      </span>
                    )) : <span className="text-sm font-bold text-blue-100">Henüz danışman öğretmen eklenmedi.</span>}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-bold text-slate-700">Öğretmen Seçiniz</label>
                  <select value="" onChange={(event) => { addAdvisorTeacher(currentClub.id, event.target.value); event.currentTarget.value = ""; }} className="mt-1 block h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500">
                    <option value="">Danışman öğretmen seçiniz</option>
                    {activeTeachers.filter((teacher) => !assignedAdvisorTeacherIds.has(String(teacher.id)) || currentClub.selection.advisorTeachers.some((advisor) => String(advisor.id) === String(teacher.id))).map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>{teacher.name} {teacher.branch ? `· ${teacher.branch}` : ""}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button type="button" onClick={() => setAdvisorModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Vazgeç</button>
                <button type="button" disabled={savingClubs} onClick={() => { void saveClubSetup(); setAdvisorModalOpen(false); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-800 disabled:opacity-60">
                  {savingClubs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {eventModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Etkinlik Planla</h3>
                  <p className="text-sm text-slate-500">Etkinlik bilgilerini girip aynı pencereden ekleyin.</p>
                </div>
                <button type="button" onClick={() => setEventModalOpen(false)} className="rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-100">Kapat</button>
              </div>
              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">Etkinlik Adı
                  <input value={eventName} onChange={(e) => setEventName(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" placeholder="Etkinlik adını yazınız" />
                </label>
                <label className="text-sm font-bold text-slate-700">Etkinlik Tarihi
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-sm" />
                </label>
                <label className="text-sm font-bold text-slate-700">Sorumlu Kulüp
                  <select value={eventMainClubId} onChange={(e) => setEventMainClubId(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-sm">
                    <option value="">Kulüp seçiniz</option>
                    {selectedClubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
                  </select>
                </label>
                <label className="text-sm font-bold text-slate-700">Yardımcı Kulüp
                  <select value={eventSecondClubId} onChange={(e) => setEventSecondClubId(e.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-sm">
                    <option value="">Yardımcı kulüp seçiniz</option>
                    {selectedClubs.filter((club) => club.id !== eventMainClubId).map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
                  </select>
                </label>
                <label className="md:col-span-2 text-sm font-bold text-slate-700">Ana Tema
                  <select value={eventThemeId} onChange={(e) => setEventThemeId(e.target.value as ThemeId | "")} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-3 text-sm">
                    <option value="">Ana tema seçiniz</option>
                    {THEMES.map((theme) => <option key={theme.id} value={theme.id}>{theme.title}</option>)}
                  </select>
                </label>
                <label className="md:col-span-2 text-sm font-bold text-slate-700">Açıklama <span className="font-medium text-slate-400">(İsteğe bağlı)</span>
                  <textarea value={eventExplanation} onChange={(e) => setEventExplanation(e.target.value)} rows={3} placeholder="Etkinliğe ilişkin açıklama yazabilirsiniz (zorunlu değil)." className="mt-1 block w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal outline-none focus:border-blue-500" />
                </label>
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
                <button type="button" onClick={() => setEventModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Vazgeç</button>
                <button type="button" onClick={() => void addNewEvent()} className="rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-black text-white hover:bg-blue-800">Ekle</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
