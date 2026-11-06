import React, { useEffect, useMemo, useState } from "react";
import {
  Users,
  Trash2,
  Edit3,
  UserCheck,
  ClipboardList,
  Sparkles,
  Award,
  BookOpen,
  X,
  Search,
} from "lucide-react";
import { Classroom, Student, Teacher } from "../types";

import { sqliteStorage } from "../core/state/SyncStateStore";
const getPrincipalName = () => "Okul Müdürü";

type OrganizationType = "Kurul" | "Komisyon" | "Ekip" | "Kulüp";

export interface CommitteeMember {
  teacherId: string;
  teacherName: string;
  role: string;
}



type SocialActivityStudent = {
  id: string;
  name: string;
  number: string;
  classroom: string;
};

type SocialActivityBoard = {
  presidentId: string;
  presidentName: string;
  teacherIds: string[];
  teacherNames: string[];
  students: SocialActivityStudent[];
  parentAssociationMember: string;
};

type GuidanceClassAdvisor = {
  teacherId: string;
  teacherName: string;
  classroomNames: string[];
};

type GuidanceExecutionCommission = {
  presidentId: string;
  presidentName: string;
  administratorIds: string[];
  administratorNames: string[];
  counselorTeacherIds: string[];
  counselorTeacherNames: string[];
  classAdvisorsByLevel: Record<string, GuidanceClassAdvisor>;
  disciplineMemberId: string;
  disciplineMemberName: string;
  honorBoardRepresentativeId: string;
  honorBoardRepresentativeName: string;
  parentAssociationMemberId: string;
  parentAssociationMemberName: string;
};

type PersonOption = {
  id: string;
  name: string;
  role?: string;
};

type ParentAssociationMember = {
  id: string;
  name: string;
};

type ClubDetails = {
  advisorTeacherIds: string[];
  advisorTeacherNames: string[];
  students: SocialActivityStudent[];
  parentAssociationMemberId: string;
  parentAssociationMemberName: string;
};

type HonorBoardSetup = {
  presidentTeacherId: string;
  presidentTeacherName: string;
  studentsByLevel: Record<string, SocialActivityStudent | null>;
  alternateVicePresident: SocialActivityStudent | null;
};

type DisciplineBoardSetup = {
  presidentId: string;
  presidentName: string;
  teacherIds: string[];
  teacherNames: string[];
  honorVicePresident: SocialActivityStudent | null;
  parentAssociationMemberId: string;
  parentAssociationMemberName: string;
};

type ParentAssociationManagementSetup = {
  principalMembers: string[];
  alternateMembers: string[];
  presidentName: string;
  vicePresidentName: string;
};

type ParentAssociationAuditSetup = {
  principalTeacherIds: string[];
  principalTeacherNames: string[];
  alternateTeacherIds: string[];
  alternateTeacherNames: string[];
  principalParentName: string;
  alternateParentName: string;
};

type WorkReviewSelectionSetup = {
  vicePrincipalId: string;
  vicePrincipalName: string;
  teacherIds: string[];
  teacherNames: string[];
  clubId: string;
  clubName: string;
  clubAdvisorIds: string[];
  clubAdvisorNames: string[];
};

type DepartmentChairsSetup = {
  chairsByBranch: Record<string, { teacherId: string; teacherName: string }>;
};

export interface SchoolCommittee {
  id: string;
  name: string;
  type: OrganizationType;
  description: string;
  presidentId: string;
  presidentName: string;
  members: CommitteeMember[];
  establishmentDate: string;
  isActive: boolean;
  socialActivityBoard?: SocialActivityBoard;
  guidanceExecutionCommission?: GuidanceExecutionCommission;
  clubDetails?: ClubDetails;
  honorBoard?: HonorBoardSetup;
  disciplineBoard?: DisciplineBoardSetup;
  parentAssociationManagement?: ParentAssociationManagementSetup;
  parentAssociationAudit?: ParentAssociationAuditSetup;
  workReviewSelection?: WorkReviewSelectionSetup;
  departmentChairs?: DepartmentChairsSetup;
}

interface CommitteesProps {
  teachers: Teacher[];
  students: Student[];
  classrooms: Classroom[];
  schoolId?: string;
}

const getTeacherName = (teacher: any) => teacher?.name || teacher?.fullName || "İsimsiz Öğretmen";
const getTeacherBranch = (teacher: any) => teacher?.branch || teacher?.subject || "Branş belirtilmedi";
const SOCIAL_ACTIVITY_COMMITTEE_ID = "COM-SOCIAL-ACTIVITIES";
const GUIDANCE_EXECUTION_COMMISSION_ID = "COM-GUIDANCE-PSYCHOLOGICAL-COUNSELING";
const GUIDANCE_EXECUTION_COMMISSION_NAME = "Rehberlik ve Psikolojik Danışma Hizmetleri Yürütme Komisyonu";
const HONOR_BOARD_ID = "BOARD-HONOR";
const HONOR_BOARD_NAME = "Onur Kurulu";
const DISCIPLINE_BOARD_ID = "BOARD-STUDENT-AWARD-DISCIPLINE";
const DISCIPLINE_BOARD_NAME = "Okul Öğrenci Ödül ve Disiplin Kurulu";
const PARENT_ASSOCIATION_MANAGEMENT_ID = "BOARD-PARENT-ASSOCIATION-MANAGEMENT";
const PARENT_ASSOCIATION_MANAGEMENT_NAME = "Okul Aile Birliği Yönetim Kurulu";
const PARENT_ASSOCIATION_AUDIT_ID = "BOARD-PARENT-ASSOCIATION-AUDIT";
const PARENT_ASSOCIATION_AUDIT_NAME = "Okul Aile Birliği Denetleme Kurulu";
const WORK_REVIEW_SELECTION_ID = "BOARD-WORK-REVIEW-SELECTION";
const WORK_REVIEW_SELECTION_NAME = "Eser İnceleme ve Seçme Kurulu";
const DEPARTMENT_CHAIRS_ID = "BOARD-DEPARTMENT-CHAIRS";
const DEPARTMENT_CHAIRS_NAME = "Eğitim Kurumu Zümre Başkanları Kurulu";
const MOVABLE_COUNT_BOARD_ID = "BOARD-MOVABLE-COUNT";
const MOVABLE_COUNT_BOARD_NAME = "Taşınır Sayım Kurulu";

const PREVENTION_INTERVENTION_COMMISSION_ID = "COM-PREVENTION-INTERVENTION-REFERRAL";
const RESPONSIBILITY_EXAM_COMMISSION_ID = "COM-RESPONSIBILITY-EXAM";
const QUOTA_DETERMINATION_COMMISSION_ID = "COM-QUOTA-DETERMINATION";
const BEP_DEVELOPMENT_UNIT_ID = "COM-BEP-DEVELOPMENT-UNIT";
const BOARDING_SCHOLARSHIP_COMMISSION_ID = "COM-BOARDING-SCHOLARSHIP";
const CANTEEN_CAFETERIA_AUDIT_COMMISSION_ID = "COM-CANTEEN-CAFETERIA-AUDIT";
const CARRIER_DETERMINATION_COMMISSION_ID = "COM-CARRIER-DETERMINATION";
const TENDER_COMMISSION_ID = "COM-TENDER";
const INSPECTION_ACCEPTANCE_COMMISSION_ID = "COM-INSPECTION-ACCEPTANCE";
const MOVABLE_VALUE_DETERMINATION_COMMISSION_ID = "COM-MOVABLE-VALUE-DETERMINATION";

const OHS_BOARD_TEAM_ID = "TEAM-OHS-BOARD";
const ISG_TEAM_ID = "TEAM-ISG";
const RISK_ASSESSMENT_TEAM_ID = "TEAM-RISK-ASSESSMENT";

const CLASS_LEVELS = ["9", "10", "11", "12"] as const;
const FIXED_BOARD_IDS = new Set([
  SOCIAL_ACTIVITY_COMMITTEE_ID,
  HONOR_BOARD_ID,
  DISCIPLINE_BOARD_ID,
  PARENT_ASSOCIATION_MANAGEMENT_ID,
  PARENT_ASSOCIATION_AUDIT_ID,
  WORK_REVIEW_SELECTION_ID,
  DEPARTMENT_CHAIRS_ID,
  MOVABLE_COUNT_BOARD_ID,
  GUIDANCE_EXECUTION_COMMISSION_ID,
  PREVENTION_INTERVENTION_COMMISSION_ID,
  RESPONSIBILITY_EXAM_COMMISSION_ID,
  QUOTA_DETERMINATION_COMMISSION_ID,
  BEP_DEVELOPMENT_UNIT_ID,
  BOARDING_SCHOLARSHIP_COMMISSION_ID,
  CANTEEN_CAFETERIA_AUDIT_COMMISSION_ID,
  CARRIER_DETERMINATION_COMMISSION_ID,
  TENDER_COMMISSION_ID,
  INSPECTION_ACCEPTANCE_COMMISSION_ID,
  MOVABLE_VALUE_DETERMINATION_COMMISSION_ID,
  OHS_BOARD_TEAM_ID,
  ISG_TEAM_ID,
  RISK_ASSESSMENT_TEAM_ID,
]);

const PLACEHOLDER_FIXED_IDS = new Set([
  MOVABLE_COUNT_BOARD_ID,
  PREVENTION_INTERVENTION_COMMISSION_ID,
  RESPONSIBILITY_EXAM_COMMISSION_ID,
  QUOTA_DETERMINATION_COMMISSION_ID,
  BEP_DEVELOPMENT_UNIT_ID,
  BOARDING_SCHOLARSHIP_COMMISSION_ID,
  CANTEEN_CAFETERIA_AUDIT_COMMISSION_ID,
  CARRIER_DETERMINATION_COMMISSION_ID,
  TENDER_COMMISSION_ID,
  INSPECTION_ACCEPTANCE_COMMISSION_ID,
  MOVABLE_VALUE_DETERMINATION_COMMISSION_ID,
  OHS_BOARD_TEAM_ID,
  ISG_TEAM_ID,
  RISK_ASSESSMENT_TEAM_ID,
]);

type ClubCatalogItem = {
  id: string;
  name: string;
  theme?: string;
  mandatory: boolean;
};

const MANDATORY_CLUBS: ClubCatalogItem[] = [
  { id: "CLUB-MAND-01", name: "Tarih ve Kültürel Miras Kulübü", mandatory: true },
  { id: "CLUB-MAND-02", name: "Yaşam Becerileri Kulübü", mandatory: true },
  { id: "CLUB-MAND-03", name: "Sağlıklı Yaşam ve Fiziksel Aktivite Kulübü", mandatory: true },
  { id: "CLUB-MAND-04", name: "Siberay Kulübü (Güvenli Dijital Yaşam)", mandatory: true },
  { id: "CLUB-MAND-05", name: "Tabiat ve Yaşanabilir Çevre Kulübü", mandatory: true },
  { id: "CLUB-MAND-06", name: "Kızılay Kulübü", mandatory: true },
  { id: "CLUB-MAND-07", name: "Yeşilay Kulübü", mandatory: true },
  { id: "CLUB-MAND-08", name: "Beyazay Kulübü", mandatory: true },
];

const OPTIONAL_CLUB_THEMES: Array<{ theme: string; clubs: ClubCatalogItem[] }> = [
  {
    theme: "Kültür Dünyamız",
    clubs: [
      "Kültür ve Yayıncılık Kulübü",
      "Medeniyet ve Düşünce Kulübü",
      "Felsefe ve Münazara Kulübü",
      "Dil, Hitabet ve İletişim Kulübü",
      "Gezi ve Turizm Kulübü",
      "Kapsayıcı Yaşam Kulübü",
      "Ahilik ve Fütüvvet Kulübü",
    ].map((name, index) => ({ id: `CLUB-OPT-CULTURE-${index + 1}`, name, theme: "Kültür Dünyamız", mandatory: false })),
  },
  {
    theme: "Sanat",
    clubs: [
      "Görsel Sanatlar Kulübü",
      "Müzik Kulübü",
      "Sahne Sanatları (Tiyatro) Kulübü",
      "Fotoğrafçılık ve Film Kulübü",
      "Dijital Sanatlar Kulübü",
      "Geleneksel Sanatlar Kulübü",
      "Edebiyat ve Yazarlık Kulübü",
    ].map((name, index) => ({ id: `CLUB-OPT-ART-${index + 1}`, name, theme: "Sanat", mandatory: false })),
  },
  {
    theme: "Spor",
    clubs: [
      "Spor Kulübü",
      "Ata Sporları Kulübü",
      "Halk Oyunları Kulübü",
      "İzcilik ve Doğa Sporları Kulübü",
      "Akıl ve Zeka Oyunları Kulübü",
      "Çocuk Oyunları Kulübü",
    ].map((name, index) => ({ id: `CLUB-OPT-SPORT-${index + 1}`, name, theme: "Spor", mandatory: false })),
  },
  {
    theme: "Bilim",
    clubs: [
      "Medya ve Bilgi Okuryazarlığı Kulübü",
      "Dijital Vatandaşlık ve Sosyal Medya Kulübü",
      "Bilim ve Teknoloji Kulübü",
      "Yapay Zeka Kulübü",
      "Dijital Beceriler Kulübü",
      "Proje ve Araştırma Kulübü",
      "Havacılık ve Uzay Kulübü",
      "Tasarım ve Mühendislik Kulübü",
      "Analoji ve Tasarım Kulübü",
      "Matematik Kulübü",
      "Sosyal Bilimler Kulübü",
      "Girişimcilik ve Yaratkenlik Kulübü",
    ].map((name, index) => ({ id: `CLUB-OPT-SCIENCE-${index + 1}`, name, theme: "Bilim", mandatory: false })),
  },
  {
    theme: "Doğa, Çevre, Toplum",
    clubs: [
      "Mesleki Tanıtım ve Gelişim Kulübü",
      "Nezaket Hareketi Kulübü",
      "Demokrasi ve İnsan Hakları Kulübü",
      "Trafik ve İlk Yardım Kulübü",
      "Afet Farkındalığı Kulübü",
    ].map((name, index) => ({ id: `CLUB-OPT-NATURE-${index + 1}`, name, theme: "Doğa, Çevre, Toplum", mandatory: false })),
  },
];

const OPTIONAL_CLUBS = OPTIONAL_CLUB_THEMES.flatMap((group) => group.clubs);
const CLUB_CATALOG = [...MANDATORY_CLUBS, ...OPTIONAL_CLUBS];
const normalizeText = (value: unknown) =>
  String(value || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/\s+/g, " ");
const getStudentNumber = (student: any) => String(student?.studentNumber ?? student?.number ?? student?.oob ?? "").trim();
const getStudentName = (student: any) => String(student?.name || student?.fullName || "").trim();
const getStudentClassroom = (student: any) => String(student?.classroom || student?.className || student?.classroomName || "").trim();
const getStudentLevel = (student: any) => {
  const raw = String(student?.level || student?.grade || student?.classLevel || getStudentClassroom(student) || "");
  const match = raw.match(/(?:^|\D)(9|10|11|12)(?:\D|$)/);
  return match?.[1] || "";
};
const getTeacherAdministrativeRole = (teacher: any) => String(teacher?.adminRole || teacher?.role || teacher?.title || "").trim();
const getClassLevel = (classroom: any) => {
  const raw = String(classroom?.level || classroom?.grade || classroom?.classLevel || classroom?.name || "");
  const match = raw.match(/(?:^|\D)(9|10|11|12)(?:\D|$)/);
  return match?.[1] || "";
};
const uniquePersonOptions = (options: PersonOption[]) => {
  const seen = new Set<string>();
  return options.filter((item) => {
    const key = String(item.id || item.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildClubRecord = (definition: ClubCatalogItem, existing?: SchoolCommittee): SchoolCommittee => ({
  ...(existing || {}),
  id: definition.id,
  name: definition.name,
  type: "Kulüp",
  description: definition.theme || (definition.mandatory ? "Zorunlu Kulüp" : "Seçmeli Kulüp"),
  presidentId: "",
  presidentName: "",
  members: (existing?.members || []).map((member) => ({ ...member, role: "Danışman Öğretmen" })),
  establishmentDate: existing?.establishmentDate || new Date().toISOString().substring(0, 10),
  isActive: definition.mandatory ? true : existing?.isActive ?? true,
  clubDetails: {
    advisorTeacherIds: existing?.clubDetails?.advisorTeacherIds?.length
      ? [...existing.clubDetails.advisorTeacherIds]
      : (existing?.members || []).map((member) => String(member.teacherId)),
    advisorTeacherNames: existing?.clubDetails?.advisorTeacherNames?.length
      ? [...existing.clubDetails.advisorTeacherNames]
      : (existing?.members || []).map((member) => member.teacherName),
    students: [...(existing?.clubDetails?.students || [])],
    parentAssociationMemberId: "",
    parentAssociationMemberName: "",
  },
});

const normalizeClubCatalog = (items: SchoolCommittee[]): SchoolCommittee[] => {
  const nonClubItems = items.filter((item) => item.type !== "Kulüp");
  const oldClubs = items.filter((item) => item.type === "Kulüp");
  const normalizedClubs: SchoolCommittee[] = [];

  MANDATORY_CLUBS.forEach((definition) => {
    const existing = oldClubs.find((item) => normalizeText(item.name) === normalizeText(definition.name));
    normalizedClubs.push(buildClubRecord(definition, existing));
  });

  OPTIONAL_CLUBS.forEach((definition) => {
    const existing = oldClubs.find((item) => normalizeText(item.name) === normalizeText(definition.name));
    if (existing) normalizedClubs.push(buildClubRecord(definition, existing));
  });

  return [...nonClubItems, ...normalizedClubs];
};

const TYPE_CONFIG: Record<OrganizationType, {
  title: string;
  icon: React.ElementType;
  wrapper: string;
  header: string;
  button: string;
  empty: string;
  reminderTitle: string;
  reminders: string[];
}> = {
  Kurul: {
    title: "Kurullar",
    icon: ClipboardList,
    wrapper: "bg-sky-50 border-sky-100",
    header: "text-sky-900 bg-sky-100 border-sky-200",
    button: "bg-sky-700 hover:bg-sky-800",
    empty: "text-sky-500",
    reminderTitle: "Kurul Hatırlatmaları",
    reminders: ["Öğretmenler Kurulu", "Şube Kurulu", "Zümre Toplantısı"],
  },
  Komisyon: {
    title: "Komisyonlar",
    icon: Award,
    wrapper: "bg-orange-50 border-orange-100",
    header: "text-orange-900 bg-orange-100 border-orange-200",
    button: "bg-orange-600 hover:bg-orange-700",
    empty: "text-orange-500",
    reminderTitle: "Komisyon Hatırlatmaları",
    reminders: ["Görev paylaşımı", "Rapor hazırlığı", "Karar takibi"],
  },
  Ekip: {
    title: "Ekipler",
    icon: Sparkles,
    wrapper: "bg-emerald-50 border-emerald-100",
    header: "text-emerald-900 bg-emerald-100 border-emerald-200",
    button: "bg-emerald-700 hover:bg-emerald-800",
    empty: "text-emerald-500",
    reminderTitle: "Ekip Hatırlatmaları",
    reminders: ["Çalışma planı", "Proje takibi", "Değerlendirme"],
  },
  Kulüp: {
    title: "Kulüpler",
    icon: BookOpen,
    wrapper: "bg-purple-50 border-purple-100",
    header: "text-purple-900 bg-purple-100 border-purple-200",
    button: "bg-purple-800 hover:bg-purple-900",
    empty: "text-purple-500",
    reminderTitle: "Kulüp Hatırlatmaları",
    reminders: ["Kulüp toplantısı", "Etkinlik planı", "Gezi / yarışma"],
  },
};

export default function CommitteesModule({ teachers, students, classrooms, schoolId = "school-main" }: CommitteesProps) {
  const defaultCommittees = (): SchoolCommittee[] => [
    {
      id: "COM-SOCIAL-ACTIVITIES",
      name: "Sosyal Etkinlikler Kurulu",
      type: "Kurul",
      description: "",
      presidentId: "",
      presidentName: "",
      members: [],
      establishmentDate: new Date().toISOString().substring(0, 10),
      isActive: true,
      socialActivityBoard: {
        presidentId: "",
        presidentName: "",
        teacherIds: [],
        teacherNames: [],
        students: [],
        parentAssociationMember: "",
      },
    },
    {
      id: GUIDANCE_EXECUTION_COMMISSION_ID,
      name: GUIDANCE_EXECUTION_COMMISSION_NAME,
      type: "Komisyon",
      description: "",
      presidentId: "",
      presidentName: "",
      members: [],
      establishmentDate: new Date().toISOString().substring(0, 10),
      isActive: true,
      guidanceExecutionCommission: {
        presidentId: "",
        presidentName: "",
        administratorIds: [],
        administratorNames: [],
        counselorTeacherIds: [],
        counselorTeacherNames: [],
        classAdvisorsByLevel: {},
        disciplineMemberId: "",
        disciplineMemberName: "",
        honorBoardRepresentativeId: "",
        honorBoardRepresentativeName: "",
        parentAssociationMemberId: "",
        parentAssociationMemberName: "",
      },
    },
    {
      id: HONOR_BOARD_ID,
      name: HONOR_BOARD_NAME,
      type: "Kurul",
      description: "Her sınıf düzeyinden bir öğrenci üye; 12. sınıf üyesi ikinci başkan ve ayrıca yedek ikinci başkan.",
      presidentId: "",
      presidentName: "",
      members: [],
      establishmentDate: new Date().toISOString().substring(0, 10),
      isActive: true,
      honorBoard: { presidentTeacherId: "", presidentTeacherName: "", studentsByLevel: {}, alternateVicePresident: null },
    },
    {
      id: DISCIPLINE_BOARD_ID,
      name: DISCIPLINE_BOARD_NAME,
      type: "Kurul",
      description: "Başkan müdür yardımcısı; iki öğretmen, Onur Kurulu ikinci başkanı ve Okul Aile Birliğinden bir veli.",
      presidentId: "",
      presidentName: "",
      members: [],
      establishmentDate: new Date().toISOString().substring(0, 10),
      isActive: true,
      disciplineBoard: { presidentId: "", presidentName: "", teacherIds: [], teacherNames: [], honorVicePresident: null, parentAssociationMemberId: "", parentAssociationMemberName: "" },
    },
    {
      id: PARENT_ASSOCIATION_MANAGEMENT_ID,
      name: PARENT_ASSOCIATION_MANAGEMENT_NAME,
      type: "Kurul",
      description: "5 asil ve 5 yedek veli üye; başkan ve ikinci başkan asil üyeler arasından seçilir.",
      presidentId: "",
      presidentName: "",
      members: [],
      establishmentDate: new Date().toISOString().substring(0, 10),
      isActive: true,
      parentAssociationManagement: { principalMembers: ["", "", "", "", ""], alternateMembers: ["", "", "", "", ""], presidentName: "", vicePresidentName: "" },
    },
    {
      id: PARENT_ASSOCIATION_AUDIT_ID,
      name: PARENT_ASSOCIATION_AUDIT_NAME,
      type: "Kurul",
      description: "2 asil ve 2 yedek öğretmen; 1 asil ve 1 yedek veli.",
      presidentId: "",
      presidentName: "",
      members: [],
      establishmentDate: new Date().toISOString().substring(0, 10),
      isActive: true,
      parentAssociationAudit: { principalTeacherIds: [], principalTeacherNames: [], alternateTeacherIds: [], alternateTeacherNames: [], principalParentName: "", alternateParentName: "" },
    },
    {
      id: WORK_REVIEW_SELECTION_ID,
      name: WORK_REVIEW_SELECTION_NAME,
      type: "Kurul",
      description: "Bir müdür yardımcısı, iki öğretmen ve seçilen sosyal kulübün danışman öğretmenleri.",
      presidentId: "",
      presidentName: "",
      members: [],
      establishmentDate: new Date().toISOString().substring(0, 10),
      isActive: true,
      workReviewSelection: { vicePrincipalId: "", vicePrincipalName: "", teacherIds: [], teacherNames: [], clubId: "", clubName: "", clubAdvisorIds: [], clubAdvisorNames: [] },
    },
    {
      id: DEPARTMENT_CHAIRS_ID,
      name: DEPARTMENT_CHAIRS_NAME,
      type: "Kurul",
      description: "Her branştan bir öğretmen zümre başkanı olarak seçilir.",
      presidentId: "",
      presidentName: "",
      members: [],
      establishmentDate: new Date().toISOString().substring(0, 10),
      isActive: true,
      departmentChairs: { chairsByBranch: {} },
    },
    { id: MOVABLE_COUNT_BOARD_ID, name: MOVABLE_COUNT_BOARD_NAME, type: "Kurul", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: PREVENTION_INTERVENTION_COMMISSION_ID, name: "Önleme, Müdahale ve Yönlendirme Komisyonu", type: "Komisyon", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: RESPONSIBILITY_EXAM_COMMISSION_ID, name: "Sorumluluk Sınavı Komisyonu", type: "Komisyon", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: QUOTA_DETERMINATION_COMMISSION_ID, name: "Kontenjan Belirleme Komisyonu", type: "Komisyon", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: BEP_DEVELOPMENT_UNIT_ID, name: "BEP Geliştirme Birimi", type: "Komisyon", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: BOARDING_SCHOLARSHIP_COMMISSION_ID, name: "Okul Yatılılık ve Bursluluk Komisyonu", type: "Komisyon", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: CANTEEN_CAFETERIA_AUDIT_COMMISSION_ID, name: "Kantin Yemekhane Denetim Komisyonu", type: "Komisyon", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: CARRIER_DETERMINATION_COMMISSION_ID, name: "Taşıyıcı Tespit Komisyonu", type: "Komisyon", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: TENDER_COMMISSION_ID, name: "İhale Komisyonu", type: "Komisyon", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: INSPECTION_ACCEPTANCE_COMMISSION_ID, name: "Muayene ve Kabul Komisyonu", type: "Komisyon", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: MOVABLE_VALUE_DETERMINATION_COMMISSION_ID, name: "Taşınır Değer Tespit Komisyonu", type: "Komisyon", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: OHS_BOARD_TEAM_ID, name: "İş Sağlığı ve Güvenliği Kurulu", type: "Ekip", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: ISG_TEAM_ID, name: "İSG Ekibi", type: "Ekip", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
    { id: RISK_ASSESSMENT_TEAM_ID, name: "Risk Değerlendirme Ekibi", type: "Ekip", description: "", presidentId: "", presidentName: "", members: [], establishmentDate: new Date().toISOString().substring(0, 10), isActive: true },
  ];

  const [committees, setCommittees] = useState<SchoolCommittee[]>(() => {
    try {
      const saved = sqliteStorage.getItem("school_committees");
      const parsed = saved ? JSON.parse(saved) : defaultCommittees();
      if (!Array.isArray(parsed)) return defaultCommittees();

      const legacySeedNames = new Set([
        "Öğretmenler Kurulu",
        "Rehberlik Hizmetleri Yürütme Komisyonu",
        "Okul Gelişim Yönetim Ekibi",
        "Kültür ve Edebiyat Kulübü",
      ]);
      const normalized = parsed
        .filter((item: any) => !(String(item?.id || "").match(/^COM-00[1245]$/) && legacySeedNames.has(String(item?.name || ""))))
        .map((item: any) => ({
          ...item,
          type: item.type === "Kulüp" ? "Kulüp" : item.type === "Ekip" ? "Ekip" : item.type === "Komisyon" ? "Komisyon" : "Kurul",
          description: item.description || "",
          establishmentDate: item.establishmentDate || new Date().toISOString().substring(0, 10),
          isActive: item.isActive ?? true,
        })) as SchoolCommittee[];

      const defaults = defaultCommittees();
      const blankSocial = defaults[0];
      const blankGuidanceCommission = defaults[1];

      const socialIndex = normalized.findIndex((item) => normalizeText(item.name) === normalizeText("Sosyal Etkinlikler Kurulu"));
      if (socialIndex < 0) {
        normalized.unshift(blankSocial);
      } else {
        const social = normalized[socialIndex];
        const isUntouchedLegacySocial =
          social.id === "COM-003" &&
          social.presidentName === "Ahmet Şahin" &&
          (social.members || []).some((member) => member.teacherName === "Elif Öztürk") &&
          (social.members || []).some((member) => member.teacherName === "Mehmet Arslan");

        normalized[socialIndex] = isUntouchedLegacySocial
          ? blankSocial
          : {
              ...social,
              id: SOCIAL_ACTIVITY_COMMITTEE_ID,
              name: "Sosyal Etkinlikler Kurulu",
              type: "Kurul",
              socialActivityBoard: social.socialActivityBoard || {
                presidentId: social.presidentId || "",
                presidentName: social.presidentName || "",
                teacherIds: [],
                teacherNames: [],
                students: [],
                parentAssociationMember: "",
              },
            };
      }

      const guidanceIndex = normalized.findIndex((item) => {
        const name = normalizeText(item.name);
        return item.id === GUIDANCE_EXECUTION_COMMISSION_ID ||
          name === normalizeText(GUIDANCE_EXECUTION_COMMISSION_NAME) ||
          name === normalizeText("Rehberlik Hizmetleri Yürütme Komisyonu");
      });
      if (guidanceIndex < 0) {
        normalized.splice(Math.min(1, normalized.length), 0, blankGuidanceCommission);
      } else {
        const current = normalized[guidanceIndex];
        normalized[guidanceIndex] = {
          ...current,
          id: GUIDANCE_EXECUTION_COMMISSION_ID,
          name: GUIDANCE_EXECUTION_COMMISSION_NAME,
          type: "Komisyon",
          guidanceExecutionCommission: current.guidanceExecutionCommission || blankGuidanceCommission.guidanceExecutionCommission,
        };
      }

      defaults.slice(2).forEach((definition) => {
        const index = normalized.findIndex((item) => item.id === definition.id || normalizeText(item.name) === normalizeText(definition.name));
        if (index < 0) {
          normalized.push(definition);
          return;
        }
        const current = normalized[index];
        normalized[index] = {
          ...definition,
          ...current,
          id: definition.id,
          name: definition.name,
          type: definition.type,
          isActive: true,
          honorBoard: current.honorBoard || definition.honorBoard,
          disciplineBoard: current.disciplineBoard || definition.disciplineBoard,
          parentAssociationManagement: current.parentAssociationManagement || definition.parentAssociationManagement,
          parentAssociationAudit: current.parentAssociationAudit || definition.parentAssociationAudit,
          workReviewSelection: current.workReviewSelection || definition.workReviewSelection,
          departmentChairs: current.departmentChairs || definition.departmentChairs,
        };
      });
      return normalizeClubCatalog(normalized);
    } catch {
      return normalizeClubCatalog(defaultCommittees());
    }
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isClubCatalogOpen, setIsClubCatalogOpen] = useState(false);
  const [clubSelectionDraft, setClubSelectionDraft] = useState<string[]>([]);

  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<OrganizationType>("Kurul");
  const [formPresidentId, setFormPresidentId] = useState("");
  const [formMembers, setFormMembers] = useState<CommitteeMember[]>([]);
  const [newMemberId, setNewMemberId] = useState("");
  const [clubStudents, setClubStudents] = useState<SocialActivityStudent[]>([]);
  const [clubStudentSearch, setClubStudentSearch] = useState("");
  const [parentAssociationMembers, setParentAssociationMembers] = useState<ParentAssociationMember[]>(() => {
    try {
      const raw = sqliteStorage.getItem(`enstitu_${schoolId}_school_parent_association_members`);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed
            .filter((item: any) => item && (item.name || typeof item === "string"))
            .map((item: any, index: number) =>
              typeof item === "string"
                ? { id: `PARENT-${index}-${String(item).trim()}`, name: String(item).trim() }
                : { id: String(item.id || `PARENT-${index}-${String(item.name).trim()}`), name: String(item.name).trim() },
            )
            .filter((item: ParentAssociationMember) => item.name)
        : [];
    } catch {
      return [];
    }
  });

  const [socialPresidentId, setSocialPresidentId] = useState("");
  const [socialTeacherIds, setSocialTeacherIds] = useState<string[]>([]);
  const [socialTeacherCandidateId, setSocialTeacherCandidateId] = useState("");
  const [socialStudents, setSocialStudents] = useState<SocialActivityStudent[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [socialParentAssociationMember, setSocialParentAssociationMember] = useState("");

  const [guidanceAdministratorIds, setGuidanceAdministratorIds] = useState<string[]>([]);
  const [guidanceAdministratorCandidateId, setGuidanceAdministratorCandidateId] = useState("");
  const [guidanceCounselorTeacherIds, setGuidanceCounselorTeacherIds] = useState<string[]>([]);
  const [guidanceCounselorCandidateId, setGuidanceCounselorCandidateId] = useState("");
  const [guidanceClassAdvisorIds, setGuidanceClassAdvisorIds] = useState<Record<string, string>>({ 9: "", 10: "", 11: "", 12: "" });
  const [guidanceDisciplineMemberId, setGuidanceDisciplineMemberId] = useState("");
  const [guidanceHonorRepresentativeId, setGuidanceHonorRepresentativeId] = useState("");
  const [guidanceParentAssociationMemberId, setGuidanceParentAssociationMemberId] = useState("");

  const [honorPresidentTeacherId, setHonorPresidentTeacherId] = useState("");
  const [honorStudentIdsByLevel, setHonorStudentIdsByLevel] = useState<Record<string, string>>({ 9: "", 10: "", 11: "", 12: "" });
  const [honorAlternateVicePresidentId, setHonorAlternateVicePresidentId] = useState("");

  const [disciplinePresidentId, setDisciplinePresidentId] = useState("");
  const [disciplineTeacherIds, setDisciplineTeacherIds] = useState<string[]>([]);
  const [disciplineParentMemberName, setDisciplineParentMemberName] = useState("");

  const [parentManagementPrincipalNames, setParentManagementPrincipalNames] = useState<string[]>(["", "", "", "", ""]);
  const [parentManagementAlternateNames, setParentManagementAlternateNames] = useState<string[]>(["", "", "", "", ""]);
  const [parentManagementPresidentName, setParentManagementPresidentName] = useState("");
  const [parentManagementVicePresidentName, setParentManagementVicePresidentName] = useState("");

  const [parentAuditPrincipalTeacherIds, setParentAuditPrincipalTeacherIds] = useState<string[]>([]);
  const [parentAuditAlternateTeacherIds, setParentAuditAlternateTeacherIds] = useState<string[]>([]);
  const [parentAuditPrincipalParentName, setParentAuditPrincipalParentName] = useState("");
  const [parentAuditAlternateParentName, setParentAuditAlternateParentName] = useState("");

  const [workReviewVicePrincipalId, setWorkReviewVicePrincipalId] = useState("");
  const [workReviewTeacherIds, setWorkReviewTeacherIds] = useState<string[]>([]);
  const [workReviewClubId, setWorkReviewClubId] = useState("");

  const [departmentChairIdsByBranch, setDepartmentChairIdsByBranch] = useState<Record<string, string>>({});

  const isSocialActivityForm = editingId === SOCIAL_ACTIVITY_COMMITTEE_ID;
  const isGuidanceExecutionForm = editingId === GUIDANCE_EXECUTION_COMMISSION_ID;
  const isHonorBoardForm = editingId === HONOR_BOARD_ID;
  const isDisciplineBoardForm = editingId === DISCIPLINE_BOARD_ID;
  const isParentManagementForm = editingId === PARENT_ASSOCIATION_MANAGEMENT_ID;
  const isParentAuditForm = editingId === PARENT_ASSOCIATION_AUDIT_ID;
  const isWorkReviewForm = editingId === WORK_REVIEW_SELECTION_ID;
  const isDepartmentChairsForm = editingId === DEPARTMENT_CHAIRS_ID;
  const isPlaceholderFixedForm = PLACEHOLDER_FIXED_IDS.has(editingId || "");

  const administratorTeachers = useMemo(() =>
    teachers
      .filter((teacher: any) => {
        const role = normalizeText(teacher?.adminRole || teacher?.role || teacher?.title || "");
        return role.includes("mudur");
      })
      .sort((a, b) => getTeacherName(a).localeCompare(getTeacherName(b), "tr")),
    [teachers],
  );

  const principalTeacher = useMemo(() => {
    const exactPrincipal = administratorTeachers.find((teacher: any) => {
      const role = normalizeText(getTeacherAdministrativeRole(teacher));
      return role.includes("okul muduru") || (role === "mudur") || (role.includes("mudur") && !role.includes("yardimci"));
    });
    return exactPrincipal || null;
  }, [administratorTeachers]);

  const commissionAdministratorTeachers = useMemo(
    () => administratorTeachers.filter((teacher: any) => String(teacher.id) !== String(principalTeacher?.id || "")),
    [administratorTeachers, principalTeacher],
  );

  const vicePrincipalTeachers = useMemo(
    () => teachers
      .filter((teacher: any) => {
        const role = normalizeText(getTeacherAdministrativeRole(teacher));
        return role.includes("mudur yardimci") || role.includes("mudur basyardimci") || (role.includes("mudur") && role.includes("yardimci"));
      })
      .sort((a, b) => getTeacherName(a).localeCompare(getTeacherName(b), "tr")),
    [teachers],
  );

  const teachingTeachers = useMemo(
    () => teachers
      .filter((teacher: any) => !normalizeText(getTeacherAdministrativeRole(teacher)).includes("mudur"))
      .sort((a, b) => getTeacherName(a).localeCompare(getTeacherName(b), "tr")),
    [teachers],
  );

  const studentsByLevel = useMemo(() => {
    const result: Record<string, Student[]> = { 9: [], 10: [], 11: [], 12: [] };
    students.forEach((student: any) => {
      let level = getStudentLevel(student);
      if (!level) {
        const classroomId = String(student?.classroomId || student?.classId || "");
        const classroomName = getStudentClassroom(student);
        const classroom = classrooms.find((item: any) => String(item.id) === classroomId || String(item.name) === classroomName);
        if (classroom) level = getClassLevel(classroom);
      }
      if (result[level]) result[level].push(student);
    });
    CLASS_LEVELS.forEach((level) => result[level].sort((a: any, b: any) => getStudentName(a).localeCompare(getStudentName(b), "tr")));
    return result;
  }, [students, classrooms]);

  const departmentTeachersByBranch = useMemo(() => {
    const result: Record<string, Teacher[]> = {};
    teachingTeachers.forEach((teacher: any) => {
      const branch = String(getTeacherBranch(teacher) || "").trim();
      if (!branch || branch === "Branş belirtilmedi") return;
      if (!result[branch]) result[branch] = [];
      result[branch].push(teacher);
    });
    Object.values(result).forEach((rows) => rows.sort((a, b) => getTeacherName(a).localeCompare(getTeacherName(b), "tr")));
    return result;
  }, [teachingTeachers]);

  const departmentBranches = useMemo(() => Object.keys(departmentTeachersByBranch).sort((a, b) => a.localeCompare(b, "tr")), [departmentTeachersByBranch]);

  const counselorTeachers = useMemo(() =>
    teachers
      .filter((teacher: any) => {
        const branch = normalizeText(getTeacherBranch(teacher));
        const role = normalizeText(teacher?.role || teacher?.title || "");
        return branch.includes("rehber") || branch.includes("psikolojik danisman") || branch === "pdr" || role.includes("rehber") || role.includes("psikolojik danisman");
      })
      .sort((a, b) => getTeacherName(a).localeCompare(getTeacherName(b), "tr")),
    [teachers],
  );

  const classAdvisorOptionsByLevel = useMemo(() => {
    const result: Record<string, Array<{ id: string; name: string; classroomNames: string[] }>> = { 9: [], 10: [], 11: [], 12: [] };
    const byLevel = new Map<string, Map<string, { id: string; name: string; classroomNames: string[] }>>();
    CLASS_LEVELS.forEach((level) => byLevel.set(level, new Map()));

    classrooms.forEach((classroom: any) => {
      const level = getClassLevel(classroom);
      if (!CLASS_LEVELS.includes(level as any)) return;
      const teacherId = String(classroom?.advisorTeacherId || classroom?.counselorTeacherId || "").trim();
      if (!teacherId) return;
      const teacher = teachers.find((item: any) => String(item.id) === teacherId);
      if (!teacher) return;
      const levelMap = byLevel.get(level);
      if (!levelMap) return;
      const existing = levelMap.get(teacherId);
      const classroomName = String(classroom?.name || "").trim();
      if (existing) {
        if (classroomName && !existing.classroomNames.includes(classroomName)) existing.classroomNames.push(classroomName);
      } else {
        levelMap.set(teacherId, { id: teacherId, name: getTeacherName(teacher), classroomNames: classroomName ? [classroomName] : [] });
      }
    });

    CLASS_LEVELS.forEach((level) => {
      result[level] = Array.from(byLevel.get(level)?.values() || []).sort((a, b) => a.name.localeCompare(b.name, "tr"));
    });
    return result;
  }, [classrooms, teachers]);

  const getCommitteePeople = (items: SchoolCommittee[]): PersonOption[] => {
    const options: PersonOption[] = [];
    items.forEach((item) => {
      if (item.presidentId || item.presidentName) {
        options.push({ id: String(item.presidentId || `PRESIDENT-${item.id}`), name: item.presidentName || "Başkan", role: "Başkan" });
      }
      (item.members || []).forEach((member) => {
        if (!member.teacherName) return;
        options.push({ id: String(member.teacherId || `${item.id}-${member.teacherName}`), name: member.teacherName, role: member.role || "Üye" });
      });
    });
    return uniquePersonOptions(options).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  };

  const disciplineCommitteeMembers = useMemo(() => {
    const source = committees.filter((item) => {
      const name = normalizeText(item.name);
      return item.id !== GUIDANCE_EXECUTION_COMMISSION_ID && ((name.includes("odul") && name.includes("disiplin")) || name.includes("disiplin kurulu"));
    });
    return getCommitteePeople(source);
  }, [committees]);

  const honorBoardMembers = useMemo(() => {
    const source = committees.filter((item) => item.id !== GUIDANCE_EXECUTION_COMMISSION_ID && normalizeText(item.name).includes("onur kurulu"));
    return getCommitteePeople(source);
  }, [committees]);

  const clubAdvisorTeachers = useMemo(() => {
    const ids = new Set<string>();
    committees
      .filter((item) => item.type === "Kulüp" && item.isActive !== false)
      .forEach((club) => {
        const advisorIds = club.clubDetails?.advisorTeacherIds?.length
          ? club.clubDetails.advisorTeacherIds
          : (club.members || []).map((member) => member.teacherId);
        advisorIds.forEach((id) => id && ids.add(String(id)));
      });
    try {
      const raw = sqliteStorage.getItem(`enstitu_${schoolId}_social_club_setup`);
      const payload = raw ? JSON.parse(raw) : null;
      const selections = Array.isArray(payload?.selections) ? payload.selections : [];
      selections.forEach((selection: any) => {
        if (!selection?.selected) return;
        (selection?.advisorTeachers || []).forEach((advisor: any) => {
          if (advisor?.id) ids.add(String(advisor.id));
        });
      });
    } catch {
      // Eski kayıt biçimine aşağıda bakılır.
    }
    if (ids.size === 0) {
      try {
        const raw = sqliteStorage.getItem("social_clubs");
        const clubs = raw ? JSON.parse(raw) : [];
        if (Array.isArray(clubs)) {
          clubs.forEach((club: any) => {
            (club?.advisorTeacherIds || []).forEach((id: any) => id && ids.add(String(id)));
            if (club?.advisorTeacherId) ids.add(String(club.advisorTeacherId));
          });
        }
      } catch {
        // Kulüp verisi henüz yoksa liste boş kalır.
      }
    }
    return teachers
      .filter((teacher: any) => ids.has(String(teacher.id)))
      .sort((a, b) => getTeacherName(a).localeCompare(getTeacherName(b), "tr"));
  }, [teachers, schoolId, isModalOpen, committees]);

  const parentAssociationOptions = useMemo(() => {
    const management = committees.find((item) => item.id === PARENT_ASSOCIATION_MANAGEMENT_ID)?.parentAssociationManagement;
    const managementNames = [
      ...(management?.principalMembers || []),
      ...(management?.alternateMembers || []),
    ].map((name) => String(name || "").trim()).filter(Boolean);
    const names = managementNames
      .map((name) => String(name || "").trim())
      .filter(Boolean);
    const seen = new Set<string>();
    return names
      .filter((name) => {
        const key = normalizeText(name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((name) => ({ id: `PARENT-${normalizeText(name).replace(/\s+/g, "-")}`, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [committees]);

  const honorVicePresidentStudent = useMemo(() => {
    const honor = committees.find((item) => item.id === HONOR_BOARD_ID)?.honorBoard;
    return honor?.studentsByLevel?.["12"] || null;
  }, [committees]);

  const activeClubOptions = useMemo(() => committees
    .filter((item) => item.type === "Kulüp" && item.isActive !== false)
    .sort((a, b) => a.name.localeCompare(b.name, "tr")), [committees]);

  const selectedWorkReviewClub = useMemo(() => activeClubOptions.find((item) => String(item.id) === String(workReviewClubId)) || null, [activeClubOptions, workReviewClubId]);
  const selectedWorkReviewAdvisorNames = useMemo(() => {
    if (!selectedWorkReviewClub) return [];
    if (selectedWorkReviewClub.clubDetails?.advisorTeacherNames?.length) return selectedWorkReviewClub.clubDetails.advisorTeacherNames;
    return (selectedWorkReviewClub.members || []).map((member) => member.teacherName).filter(Boolean);
  }, [selectedWorkReviewClub]);

  const matchingStudents = useMemo(() => {
    const query = normalizeText(studentSearch);
    if (!query) return [];
    const selectedIds = new Set(socialStudents.map((student) => String(student.id)));
    return students
      .filter((student: any) => !selectedIds.has(String(student.id)))
      .filter((student: any) => {
        const name = normalizeText(getStudentName(student));
        const number = normalizeText(getStudentNumber(student));
        return name.includes(query) || number.includes(query);
      })
      .sort((a: any, b: any) => getStudentName(a).localeCompare(getStudentName(b), "tr"))
      .slice(0, 12);
  }, [students, socialStudents, studentSearch]);

  const matchingClubStudents = useMemo(() => {
    const query = normalizeText(clubStudentSearch);
    if (!query) return [];
    const selectedIds = new Set(clubStudents.map((student) => String(student.id)));
    return students
      .filter((student: any) => !selectedIds.has(String(student.id)))
      .filter((student: any) => {
        const name = normalizeText(getStudentName(student));
        const number = normalizeText(getStudentNumber(student));
        return name.includes(query) || number.includes(query);
      })
      .sort((a: any, b: any) => getStudentName(a).localeCompare(getStudentName(b), "tr"))
      .slice(0, 12);
  }, [students, clubStudents, clubStudentSearch]);

  useEffect(() => {
    sqliteStorage.setItem("school_committees", JSON.stringify(committees));
    window.dispatchEvent(new Event("school_committees_updated"));
  }, [committees]);

  useEffect(() => {
    sqliteStorage.setItem(`enstitu_${schoolId}_school_parent_association_members`, JSON.stringify(parentAssociationMembers));
    window.dispatchEvent(new Event("school_parent_association_members_updated"));
  }, [parentAssociationMembers, schoolId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const resetForm = (type: OrganizationType = "Kurul") => {
    setEditingId(null);
    setFormName("");
    setFormType(type);
    setFormPresidentId("");
    setFormMembers([]);
    setNewMemberId("");
    setClubStudents([]);
    setClubStudentSearch("");
    setSocialPresidentId("");
    setSocialTeacherIds([]);
    setSocialTeacherCandidateId("");
    setSocialStudents([]);
    setStudentSearch("");
    setSocialParentAssociationMember("");
    setGuidanceAdministratorIds([]);
    setGuidanceAdministratorCandidateId("");
    setGuidanceCounselorTeacherIds([]);
    setGuidanceCounselorCandidateId("");
    setGuidanceClassAdvisorIds({ 9: "", 10: "", 11: "", 12: "" });
    setGuidanceDisciplineMemberId("");
    setGuidanceHonorRepresentativeId("");
    setGuidanceParentAssociationMemberId("");
    setHonorPresidentTeacherId("");
    setHonorStudentIdsByLevel({ 9: "", 10: "", 11: "", 12: "" });
    setHonorAlternateVicePresidentId("");
    setDisciplinePresidentId("");
    setDisciplineTeacherIds([]);
    setDisciplineParentMemberName("");
    setParentManagementPrincipalNames(["", "", "", "", ""]);
    setParentManagementAlternateNames(["", "", "", "", ""]);
    setParentManagementPresidentName("");
    setParentManagementVicePresidentName("");
    setParentAuditPrincipalTeacherIds([]);
    setParentAuditAlternateTeacherIds([]);
    setParentAuditPrincipalParentName("");
    setParentAuditAlternateParentName("");
    setWorkReviewVicePrincipalId("");
    setWorkReviewTeacherIds([]);
    setWorkReviewClubId("");
    setDepartmentChairIdsByBranch({});
  };

  const getActiveOptionalClubIds = () =>
    OPTIONAL_CLUBS
      .filter((definition) => committees.some((item) => item.type === "Kulüp" && normalizeText(item.name) === normalizeText(definition.name) && item.isActive !== false))
      .map((definition) => definition.id);

  const handleOpenClubCatalog = () => {
    setClubSelectionDraft(getActiveOptionalClubIds());
    setIsClubCatalogOpen((open) => !open);
  };

  const handleToggleOptionalClub = (definition: ClubCatalogItem) => {
    setClubSelectionDraft((prev) =>
      prev.includes(definition.id) ? prev.filter((id) => id !== definition.id) : [...prev, definition.id],
    );
  };

  const handleSaveClubCatalog = () => {
    const selectedIds = new Set(clubSelectionDraft);
    setCommittees((prev) => {
      let next = [...prev];
      OPTIONAL_CLUBS.forEach((definition) => {
        const existingIndex = next.findIndex((item) => item.type === "Kulüp" && normalizeText(item.name) === normalizeText(definition.name));
        const active = selectedIds.has(definition.id);
        if (existingIndex >= 0) {
          next = next.map((item, index) => index === existingIndex ? { ...item, isActive: active } : item);
        } else if (active) {
          next.push(buildClubRecord(definition));
        }
      });
      return next;
    });
    setIsClubCatalogOpen(false);
    showToast("Kulüp tanımları kaydedildi.");
  };

  const handleOpenAdd = (type: OrganizationType = "Kurul") => {
    if (type === "Kulüp") return;
    resetForm(type);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: SchoolCommittee) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormType(item.type);
    setFormPresidentId(item.presidentId || "");
    setFormMembers([...(item.members || [])]);
    setNewMemberId("");
    if (item.type === "Kulüp") {
      const details = item.clubDetails;
      const advisorIds = details?.advisorTeacherIds?.length
        ? details.advisorTeacherIds
        : (item.members || []).map((member) => String(member.teacherId));
      setFormMembers(
        advisorIds
          .map((id) => teachers.find((teacher: any) => String(teacher.id) === String(id)))
          .filter(Boolean)
          .map((teacher: any) => ({ teacherId: String(teacher.id), teacherName: getTeacherName(teacher), role: "Danışman Öğretmen" })),
      );
      setFormPresidentId("");
      setClubStudents([...(details?.students || [])]);
      setClubStudentSearch("");
    } else {
      setClubStudents([]);
      setClubStudentSearch("");
      }
    if (item.id === SOCIAL_ACTIVITY_COMMITTEE_ID || normalizeText(item.name) === normalizeText("Sosyal Etkinlikler Kurulu")) {
      const setup = item.socialActivityBoard;
      setEditingId(SOCIAL_ACTIVITY_COMMITTEE_ID);
      setSocialPresidentId(setup?.presidentId || item.presidentId || "");
      setSocialTeacherIds([...(setup?.teacherIds || [])].slice(0, 3));
      setSocialStudents([...(setup?.students || [])].slice(0, 2));
      setSocialParentAssociationMember(setup?.parentAssociationMember || "");
      setSocialTeacherCandidateId("");
      setStudentSearch("");
    }
    if (item.id === GUIDANCE_EXECUTION_COMMISSION_ID || normalizeText(item.name) === normalizeText(GUIDANCE_EXECUTION_COMMISSION_NAME)) {
      const setup = item.guidanceExecutionCommission;
      setEditingId(GUIDANCE_EXECUTION_COMMISSION_ID);
      setGuidanceAdministratorIds([...(setup?.administratorIds || [])]);
      setGuidanceAdministratorCandidateId("");
      setGuidanceCounselorTeacherIds([...(setup?.counselorTeacherIds || [])]);
      setGuidanceCounselorCandidateId("");
      setGuidanceClassAdvisorIds({
        9: setup?.classAdvisorsByLevel?.["9"]?.teacherId || "",
        10: setup?.classAdvisorsByLevel?.["10"]?.teacherId || "",
        11: setup?.classAdvisorsByLevel?.["11"]?.teacherId || "",
        12: setup?.classAdvisorsByLevel?.["12"]?.teacherId || "",
      });
      setGuidanceDisciplineMemberId(setup?.disciplineMemberId || "");
      setGuidanceHonorRepresentativeId(setup?.honorBoardRepresentativeId || "");
      setGuidanceParentAssociationMemberId(setup?.parentAssociationMemberId || "");
    }
    if (item.id === HONOR_BOARD_ID) {
      const setup = item.honorBoard;
      setHonorPresidentTeacherId(setup?.presidentTeacherId || item.presidentId || "");
      setHonorStudentIdsByLevel({
        9: setup?.studentsByLevel?.["9"]?.id || "",
        10: setup?.studentsByLevel?.["10"]?.id || "",
        11: setup?.studentsByLevel?.["11"]?.id || "",
        12: setup?.studentsByLevel?.["12"]?.id || "",
      });
      setHonorAlternateVicePresidentId(setup?.alternateVicePresident?.id || "");
    }
    if (item.id === DISCIPLINE_BOARD_ID) {
      const setup = item.disciplineBoard;
      setDisciplinePresidentId(setup?.presidentId || item.presidentId || "");
      setDisciplineTeacherIds([...(setup?.teacherIds || [])].slice(0, 2));
      setDisciplineParentMemberName(setup?.parentAssociationMemberName || "");
    }
    if (item.id === PARENT_ASSOCIATION_MANAGEMENT_ID) {
      const setup = item.parentAssociationManagement;
      setParentManagementPrincipalNames([...(setup?.principalMembers || []), "", "", "", "", ""].slice(0, 5));
      setParentManagementAlternateNames([...(setup?.alternateMembers || []), "", "", "", "", ""].slice(0, 5));
      setParentManagementPresidentName(setup?.presidentName || "");
      setParentManagementVicePresidentName(setup?.vicePresidentName || "");
    }
    if (item.id === PARENT_ASSOCIATION_AUDIT_ID) {
      const setup = item.parentAssociationAudit;
      setParentAuditPrincipalTeacherIds([...(setup?.principalTeacherIds || [])].slice(0, 2));
      setParentAuditAlternateTeacherIds([...(setup?.alternateTeacherIds || [])].slice(0, 2));
      setParentAuditPrincipalParentName(setup?.principalParentName || "");
      setParentAuditAlternateParentName(setup?.alternateParentName || "");
    }
    if (item.id === WORK_REVIEW_SELECTION_ID) {
      const setup = item.workReviewSelection;
      setWorkReviewVicePrincipalId(setup?.vicePrincipalId || item.presidentId || "");
      setWorkReviewTeacherIds([...(setup?.teacherIds || [])].slice(0, 2));
      setWorkReviewClubId(setup?.clubId || "");
    }
    if (item.id === DEPARTMENT_CHAIRS_ID) {
      const setup = item.departmentChairs;
      setDepartmentChairIdsByBranch(Object.fromEntries(Object.entries(setup?.chairsByBranch || {}).map(([branch, chair]) => [branch, chair.teacherId])));
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`'${name}' kaydını silmek istediğinizden emin misiniz?`)) {
      setCommittees((prev) => prev.filter((item) => item.id !== id));
      showToast("Kayıt silindi.");
    }
  };

  const handleAddMember = () => {
    if (!newMemberId) return;
    if (formMembers.some((m) => m.teacherId === newMemberId)) {
      alert("Bu öğretmen zaten listede var.");
      return;
    }
    const matchedTeacher = teachers.find((t: any) => t.id === newMemberId);
    if (!matchedTeacher) return;
    setFormMembers((prev) => [
      ...prev,
      { teacherId: matchedTeacher.id, teacherName: getTeacherName(matchedTeacher), role: "Üye" },
    ]);
    setNewMemberId("");
  };

  const handleRemoveMember = (idx: number) => {
    setFormMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddClubStudent = (student: Student) => {
    if (clubStudents.some((item) => String(item.id) === String(student.id))) return;
    setClubStudents((prev) => [
      ...prev,
      {
        id: String(student.id),
        name: getStudentName(student),
        number: getStudentNumber(student),
        classroom: getStudentClassroom(student),
      },
    ]);
    setClubStudentSearch("");
  };

  const handleClubStudentSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = normalizeText(clubStudentSearch);
    const exact = matchingClubStudents.find((student: any) =>
      normalizeText(getStudentNumber(student)) === query || normalizeText(getStudentName(student)) === query
    );
    const candidate = exact || (matchingClubStudents.length === 1 ? matchingClubStudents[0] : null);
    if (candidate) handleAddClubStudent(candidate as Student);
  };

  const handleAddSocialTeacher = () => {
    if (!socialTeacherCandidateId || socialTeacherIds.length >= 3) return;
    if (socialTeacherIds.includes(socialTeacherCandidateId)) return;
    setSocialTeacherIds((prev) => [...prev, socialTeacherCandidateId].slice(0, 3));
    setSocialTeacherCandidateId("");
  };

  const handleAddSocialStudent = (student: Student) => {
    if (socialStudents.length >= 2) return;
    if (socialStudents.some((item) => String(item.id) === String(student.id))) return;
    setSocialStudents((prev) => [
      ...prev,
      {
        id: String(student.id),
        name: getStudentName(student),
        number: getStudentNumber(student),
        classroom: getStudentClassroom(student),
      },
    ].slice(0, 2));
    setStudentSearch("");
  };

  const handleStudentSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const query = normalizeText(studentSearch);
    const exact = matchingStudents.find((student: any) =>
      normalizeText(getStudentNumber(student)) === query || normalizeText(getStudentName(student)) === query
    );
    const candidate = exact || (matchingStudents.length === 1 ? matchingStudents[0] : null);
    if (candidate) handleAddSocialStudent(candidate as Student);
  };

  const handleAddGuidanceAdministrator = () => {
    if (!guidanceAdministratorCandidateId || guidanceAdministratorIds.includes(guidanceAdministratorCandidateId)) return;
    setGuidanceAdministratorIds((prev) => [...prev, guidanceAdministratorCandidateId]);
    setGuidanceAdministratorCandidateId("");
  };

  const handleAddGuidanceCounselor = () => {
    if (!guidanceCounselorCandidateId || guidanceCounselorTeacherIds.includes(guidanceCounselorCandidateId)) return;
    setGuidanceCounselorTeacherIds((prev) => [...prev, guidanceCounselorCandidateId]);
    setGuidanceCounselorCandidateId("");
  };

  const resolvePresident = () => {
    if (!formPresidentId) return `${getPrincipalName()} (Okul Müdürü)`;
    const t = teachers.find((teacher: any) => teacher.id === formPresidentId);
    return t ? getTeacherName(t) : `${getPrincipalName()} (Okul Müdürü)`;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (isPlaceholderFixedForm) {
      setIsModalOpen(false);
      return;
    }

    if (isHonorBoardForm) {
      const president = teachingTeachers.find((teacher: any) => String(teacher.id) === String(honorPresidentTeacherId));
      const studentsByLevelSetup: Record<string, SocialActivityStudent | null> = {};
      const memberRows: CommitteeMember[] = [];
      CLASS_LEVELS.forEach((level) => {
        const student = students.find((item: any) => String(item.id) === String(honorStudentIdsByLevel[level] || ""));
        const row = student ? { id: String(student.id), name: getStudentName(student), number: getStudentNumber(student), classroom: getStudentClassroom(student) } : null;
        studentsByLevelSetup[level] = row;
        if (row) memberRows.push({ teacherId: row.id, teacherName: row.name, role: level === "12" ? "12. Sınıf Öğrenci Üye · İkinci Başkan" : `${level}. Sınıf Öğrenci Üye` });
      });
      const alternateStudent = students.find((item: any) => String(item.id) === String(honorAlternateVicePresidentId || ""));
      if (honorAlternateVicePresidentId && honorAlternateVicePresidentId === honorStudentIdsByLevel["12"]) {
        alert("Yedek ikinci başkan, ikinci başkan olarak seçilen 12. sınıf öğrencisinden farklı olmalıdır.");
        return;
      }
      const alternateVicePresident = alternateStudent ? { id: String(alternateStudent.id), name: getStudentName(alternateStudent), number: getStudentNumber(alternateStudent), classroom: getStudentClassroom(alternateStudent) } : null;
      if (alternateVicePresident) memberRows.push({ teacherId: alternateVicePresident.id, teacherName: alternateVicePresident.name, role: "Yedek İkinci Başkan" });
      const setup: HonorBoardSetup = {
        presidentTeacherId: president ? String(president.id) : "",
        presidentTeacherName: president ? getTeacherName(president) : "",
        studentsByLevel: studentsByLevelSetup,
        alternateVicePresident,
      };
      setCommittees((prev) => prev.map((item) => item.id === HONOR_BOARD_ID ? { ...item, presidentId: setup.presidentTeacherId, presidentName: setup.presidentTeacherName, members: memberRows, honorBoard: setup } : item));
      showToast("Onur Kurulu üyeleri kaydedildi.");
      setIsModalOpen(false);
      return;
    }

    if (isDisciplineBoardForm) {
      const president = vicePrincipalTeachers.find((teacher: any) => String(teacher.id) === String(disciplinePresidentId));
      const selectedTeachers = disciplineTeacherIds
        .map((id) => teachingTeachers.find((teacher: any) => String(teacher.id) === String(id)))
        .filter(Boolean) as Teacher[];
      const parentOption = parentAssociationOptions.find((item) => item.name === disciplineParentMemberName);
      const setup: DisciplineBoardSetup = {
        presidentId: president ? String(president.id) : "",
        presidentName: president ? getTeacherName(president) : "",
        teacherIds: selectedTeachers.map((teacher) => String(teacher.id)),
        teacherNames: selectedTeachers.map((teacher) => getTeacherName(teacher)),
        honorVicePresident: honorVicePresidentStudent ? { ...honorVicePresidentStudent } : null,
        parentAssociationMemberId: parentOption?.id || "",
        parentAssociationMemberName: disciplineParentMemberName,
      };
      const memberRows: CommitteeMember[] = selectedTeachers.map((teacher) => ({ teacherId: String(teacher.id), teacherName: getTeacherName(teacher), role: "Öğretmen Üye" }));
      if (setup.honorVicePresident) memberRows.push({ teacherId: setup.honorVicePresident.id, teacherName: setup.honorVicePresident.name, role: "Onur Kurulu İkinci Başkanı" });
      if (setup.parentAssociationMemberName) memberRows.push({ teacherId: setup.parentAssociationMemberId || `PARENT-${setup.parentAssociationMemberName}`, teacherName: setup.parentAssociationMemberName, role: "Okul Aile Birliği Veli Üyesi" });
      setCommittees((prev) => prev.map((item) => item.id === DISCIPLINE_BOARD_ID ? { ...item, presidentId: setup.presidentId, presidentName: setup.presidentName, members: memberRows, disciplineBoard: setup } : item));
      showToast("Okul Öğrenci Ödül ve Disiplin Kurulu üyeleri kaydedildi.");
      setIsModalOpen(false);
      return;
    }

    if (isParentManagementForm) {
      const principalMembers = parentManagementPrincipalNames.map((name) => name.trim());
      const alternateMembers = parentManagementAlternateNames.map((name) => name.trim());
      const allEnteredNames = [...principalMembers, ...alternateMembers].filter(Boolean);
      const normalizedEnteredNames = allEnteredNames.map(normalizeText);
      if (new Set(normalizedEnteredNames).size !== normalizedEnteredNames.length) {
        alert("Okul Aile Birliği Yönetim Kurulunda aynı veli birden fazla asil/yedek üyelikte yer alamaz.");
        return;
      }
      const validPrincipalNames = principalMembers.filter(Boolean);
      if (parentManagementPresidentName && !validPrincipalNames.includes(parentManagementPresidentName)) {
        alert("Başkan, 5 asil üyeden biri olmalıdır.");
        return;
      }
      if (parentManagementVicePresidentName && !validPrincipalNames.includes(parentManagementVicePresidentName)) {
        alert("İkinci başkan, 5 asil üyeden biri olmalıdır.");
        return;
      }
      if (parentManagementPresidentName && parentManagementVicePresidentName && parentManagementPresidentName === parentManagementVicePresidentName) {
        alert("Başkan ve ikinci başkan aynı kişi olamaz.");
        return;
      }
      const setup: ParentAssociationManagementSetup = { principalMembers, alternateMembers, presidentName: parentManagementPresidentName, vicePresidentName: parentManagementVicePresidentName };
      const memberRows: CommitteeMember[] = [];
      principalMembers.forEach((name, index) => {
        if (!name) return;
        const role = name === setup.presidentName ? "Başkan · Asil Veli Üye" : name === setup.vicePresidentName ? "İkinci Başkan · Asil Veli Üye" : `Asil Veli Üye ${index + 1}`;
        memberRows.push({ teacherId: `PARENT-MAIN-${index + 1}`, teacherName: name, role });
      });
      alternateMembers.forEach((name, index) => { if (name) memberRows.push({ teacherId: `PARENT-ALT-${index + 1}`, teacherName: name, role: `Yedek Veli Üye ${index + 1}` }); });
      setParentAssociationMembers([...principalMembers, ...alternateMembers].filter(Boolean).map((name, index) => ({ id: `PARENT-${index + 1}-${normalizeText(name).replace(/\s+/g, "-")}`, name })));
      setCommittees((prev) => prev.map((item) => item.id === PARENT_ASSOCIATION_MANAGEMENT_ID ? { ...item, presidentId: setup.presidentName ? `PARENT-${normalizeText(setup.presidentName).replace(/\s+/g, "-")}` : "", presidentName: setup.presidentName, members: memberRows, parentAssociationManagement: setup } : item));
      showToast("Okul Aile Birliği Yönetim Kurulu kaydedildi.");
      setIsModalOpen(false);
      return;
    }

    if (isParentAuditForm) {
      const management = committees.find((item) => item.id === PARENT_ASSOCIATION_MANAGEMENT_ID)?.parentAssociationManagement;
      const managementNames = [...(management?.principalMembers || []), ...(management?.alternateMembers || [])].map(normalizeText).filter(Boolean);
      const principalParent = parentAuditPrincipalParentName.trim();
      const alternateParent = parentAuditAlternateParentName.trim();
      if (principalParent && managementNames.includes(normalizeText(principalParent))) {
        alert("Denetleme Kurulu asil veli üyesi, Okul Aile Birliği Yönetim Kurulu üyelerinden farklı olmalıdır.");
        return;
      }
      if (alternateParent && managementNames.includes(normalizeText(alternateParent))) {
        alert("Denetleme Kurulu yedek veli üyesi, Okul Aile Birliği Yönetim Kurulu üyelerinden farklı olmalıdır.");
        return;
      }
      if (principalParent && alternateParent && normalizeText(principalParent) === normalizeText(alternateParent)) {
        alert("Asil ve yedek veli aynı kişi olamaz.");
        return;
      }
      const principalTeachers = parentAuditPrincipalTeacherIds.map((id) => teachingTeachers.find((teacher: any) => String(teacher.id) === String(id))).filter(Boolean) as Teacher[];
      const alternateTeachers = parentAuditAlternateTeacherIds.map((id) => teachingTeachers.find((teacher: any) => String(teacher.id) === String(id))).filter(Boolean) as Teacher[];
      const setup: ParentAssociationAuditSetup = {
        principalTeacherIds: principalTeachers.map((teacher) => String(teacher.id)),
        principalTeacherNames: principalTeachers.map((teacher) => getTeacherName(teacher)),
        alternateTeacherIds: alternateTeachers.map((teacher) => String(teacher.id)),
        alternateTeacherNames: alternateTeachers.map((teacher) => getTeacherName(teacher)),
        principalParentName: principalParent,
        alternateParentName: alternateParent,
      };
      const memberRows: CommitteeMember[] = [
        ...principalTeachers.map((teacher) => ({ teacherId: String(teacher.id), teacherName: getTeacherName(teacher), role: "Asil Öğretmen Üye" })),
        ...alternateTeachers.map((teacher) => ({ teacherId: String(teacher.id), teacherName: getTeacherName(teacher), role: "Yedek Öğretmen Üye" })),
      ];
      if (principalParent) memberRows.push({ teacherId: "PARENT-AUDIT-MAIN", teacherName: principalParent, role: "Asil Veli Üye" });
      if (alternateParent) memberRows.push({ teacherId: "PARENT-AUDIT-ALT", teacherName: alternateParent, role: "Yedek Veli Üye" });
      setCommittees((prev) => prev.map((item) => item.id === PARENT_ASSOCIATION_AUDIT_ID ? { ...item, presidentId: "", presidentName: "", members: memberRows, parentAssociationAudit: setup } : item));
      showToast("Okul Aile Birliği Denetleme Kurulu kaydedildi.");
      setIsModalOpen(false);
      return;
    }

    if (isWorkReviewForm) {
      const vicePrincipal = vicePrincipalTeachers.find((teacher: any) => String(teacher.id) === String(workReviewVicePrincipalId));
      const selectedTeachers = workReviewTeacherIds.map((id) => teachingTeachers.find((teacher: any) => String(teacher.id) === String(id))).filter(Boolean) as Teacher[];
      const club = activeClubOptions.find((item) => String(item.id) === String(workReviewClubId));
      const advisorIds = club?.clubDetails?.advisorTeacherIds?.length ? club.clubDetails.advisorTeacherIds : (club?.members || []).map((member) => String(member.teacherId));
      const advisors = (advisorIds || []).map((id) => teachers.find((teacher: any) => String(teacher.id) === String(id))).filter(Boolean) as Teacher[];
      const setup: WorkReviewSelectionSetup = {
        vicePrincipalId: vicePrincipal ? String(vicePrincipal.id) : "",
        vicePrincipalName: vicePrincipal ? getTeacherName(vicePrincipal) : "",
        teacherIds: selectedTeachers.map((teacher) => String(teacher.id)),
        teacherNames: selectedTeachers.map((teacher) => getTeacherName(teacher)),
        clubId: club?.id || "",
        clubName: club?.name || "",
        clubAdvisorIds: advisors.map((teacher) => String(teacher.id)),
        clubAdvisorNames: advisors.map((teacher) => getTeacherName(teacher)),
      };
      const memberRows: CommitteeMember[] = selectedTeachers.map((teacher) => ({ teacherId: String(teacher.id), teacherName: getTeacherName(teacher), role: "Öğretmen Üye" }));
      advisors.forEach((teacher) => { if (!memberRows.some((row) => row.teacherId === String(teacher.id))) memberRows.push({ teacherId: String(teacher.id), teacherName: getTeacherName(teacher), role: `${setup.clubName} Danışman Öğretmeni` }); });
      setCommittees((prev) => prev.map((item) => item.id === WORK_REVIEW_SELECTION_ID ? { ...item, presidentId: setup.vicePrincipalId, presidentName: setup.vicePrincipalName, members: memberRows, workReviewSelection: setup } : item));
      showToast("Eser İnceleme ve Seçme Kurulu kaydedildi.");
      setIsModalOpen(false);
      return;
    }

    if (isDepartmentChairsForm) {
      const chairsByBranch: DepartmentChairsSetup["chairsByBranch"] = {};
      const memberRows: CommitteeMember[] = [];
      departmentBranches.forEach((branch) => {
        const teacherId = departmentChairIdsByBranch[branch];
        const teacher = (departmentTeachersByBranch[branch] || []).find((item: any) => String(item.id) === String(teacherId || ""));
        if (!teacher) return;
        chairsByBranch[branch] = { teacherId: String(teacher.id), teacherName: getTeacherName(teacher) };
        memberRows.push({ teacherId: String(teacher.id), teacherName: getTeacherName(teacher), role: `${branch} Zümre Başkanı` });
      });
      setCommittees((prev) => prev.map((item) => item.id === DEPARTMENT_CHAIRS_ID ? { ...item, presidentId: "", presidentName: "", members: memberRows, departmentChairs: { chairsByBranch } } : item));
      showToast("Eğitim Kurumu Zümre Başkanları Kurulu kaydedildi.");
      setIsModalOpen(false);
      return;
    }

    if (isGuidanceExecutionForm) {
      const selectedAdministrators = guidanceAdministratorIds
        .map((id) => commissionAdministratorTeachers.find((teacher: any) => String(teacher.id) === String(id)))
        .filter(Boolean) as Teacher[];
      const selectedCounselors = guidanceCounselorTeacherIds
        .map((id) => counselorTeachers.find((teacher: any) => String(teacher.id) === String(id)))
        .filter(Boolean) as Teacher[];
      const classAdvisorsByLevel: Record<string, GuidanceClassAdvisor> = {};
      CLASS_LEVELS.forEach((level) => {
        const teacherId = guidanceClassAdvisorIds[level] || "";
        if (!teacherId) return;
        const option = classAdvisorOptionsByLevel[level]?.find((item) => String(item.id) === String(teacherId));
        if (!option) return;
        classAdvisorsByLevel[level] = {
          teacherId: option.id,
          teacherName: option.name,
          classroomNames: [...option.classroomNames],
        };
      });

      const disciplineMember = disciplineCommitteeMembers.find((item) => String(item.id) === String(guidanceDisciplineMemberId));
      const honorRepresentative = honorBoardMembers.find((item) => String(item.id) === String(guidanceHonorRepresentativeId));
      const parentMember = parentAssociationMembers.find((item) => String(item.id) === String(guidanceParentAssociationMemberId));
      const setup: GuidanceExecutionCommission = {
        presidentId: principalTeacher ? String(principalTeacher.id) : "",
        presidentName: principalTeacher ? getTeacherName(principalTeacher) : "Okul Müdürü",
        administratorIds: selectedAdministrators.map((teacher) => String(teacher.id)),
        administratorNames: selectedAdministrators.map((teacher) => getTeacherName(teacher)),
        counselorTeacherIds: selectedCounselors.map((teacher) => String(teacher.id)),
        counselorTeacherNames: selectedCounselors.map((teacher) => getTeacherName(teacher)),
        classAdvisorsByLevel,
        disciplineMemberId: disciplineMember?.id || "",
        disciplineMemberName: disciplineMember?.name || "",
        honorBoardRepresentativeId: honorRepresentative?.id || "",
        honorBoardRepresentativeName: honorRepresentative?.name || "",
        parentAssociationMemberId: parentMember?.id || "",
        parentAssociationMemberName: parentMember?.name || "",
      };

      const memberRows: CommitteeMember[] = [];
      selectedAdministrators.forEach((teacher) => memberRows.push({ teacherId: String(teacher.id), teacherName: getTeacherName(teacher), role: "İdareci Üye" }));
      selectedCounselors.forEach((teacher) => memberRows.push({ teacherId: String(teacher.id), teacherName: getTeacherName(teacher), role: "Rehber Öğretmen / Psikolojik Danışman" }));
      CLASS_LEVELS.forEach((level) => {
        const advisor = classAdvisorsByLevel[level];
        if (advisor) memberRows.push({ teacherId: advisor.teacherId, teacherName: advisor.teacherName, role: `${level}. Sınıf Rehber Öğretmeni` });
      });
      if (disciplineMember) memberRows.push({ teacherId: disciplineMember.id, teacherName: disciplineMember.name, role: "Ödül ve Disiplin Kurulu Üyesi" });
      if (honorRepresentative) memberRows.push({ teacherId: honorRepresentative.id, teacherName: honorRepresentative.name, role: "Onur Kurulu Temsilcisi" });

      setCommittees((prev) => prev.map((item) =>
        item.id === GUIDANCE_EXECUTION_COMMISSION_ID || normalizeText(item.name) === normalizeText(GUIDANCE_EXECUTION_COMMISSION_NAME)
          ? {
              ...item,
              id: GUIDANCE_EXECUTION_COMMISSION_ID,
              name: GUIDANCE_EXECUTION_COMMISSION_NAME,
              type: "Komisyon",
              presidentId: setup.presidentId,
              presidentName: setup.presidentName,
              members: memberRows,
              guidanceExecutionCommission: setup,
            }
          : item,
      ));
      showToast("Rehberlik ve Psikolojik Danışma Hizmetleri Yürütme Komisyonu kaydedildi.");
      setIsModalOpen(false);
      return;
    }

    if (isSocialActivityForm) {
      const president = administratorTeachers.find((teacher: any) => String(teacher.id) === String(socialPresidentId));
      const selectedTeacherRows = socialTeacherIds
        .map((id) => clubAdvisorTeachers.find((teacher: any) => String(teacher.id) === String(id)))
        .filter(Boolean) as Teacher[];
      const setup: SocialActivityBoard = {
        presidentId: socialPresidentId,
        presidentName: president ? getTeacherName(president) : "",
        teacherIds: selectedTeacherRows.map((teacher) => String(teacher.id)),
        teacherNames: selectedTeacherRows.map((teacher) => getTeacherName(teacher)),
        students: socialStudents.slice(0, 2),
        parentAssociationMember: socialParentAssociationMember.trim(),
      };
      setCommittees((prev) =>
        prev.map((item) =>
          item.id === SOCIAL_ACTIVITY_COMMITTEE_ID || normalizeText(item.name) === normalizeText("Sosyal Etkinlikler Kurulu")
            ? {
                ...item,
                id: SOCIAL_ACTIVITY_COMMITTEE_ID,
                name: "Sosyal Etkinlikler Kurulu",
                type: "Kurul",
                presidentId: setup.presidentId,
                presidentName: setup.presidentName,
                members: setup.teacherIds.map((teacherId, index) => ({
                  teacherId,
                  teacherName: setup.teacherNames[index] || "",
                  role: "Öğretmen Üye",
                })),
                socialActivityBoard: setup,
              }
            : item,
        ),
      );
      showToast("Sosyal Etkinlikler Kurulu görevlileri kaydedildi.");
      setIsModalOpen(false);
      return;
    }

    const name = formName.trim();
    if (!name) {
      alert("Lütfen ad giriniz.");
      return;
    }

    const isClub = formType === "Kulüp";
    if (isClub && formMembers.length < 1) {
      alert("Kulübe en az bir danışman öğretmen eklemelisiniz.");
      return;
    }
    const presidentName = isClub ? "" : resolvePresident();
    const clubDetails: ClubDetails | undefined = isClub
      ? {
          advisorTeacherIds: formMembers.map((member) => String(member.teacherId)),
          advisorTeacherNames: formMembers.map((member) => member.teacherName),
          students: clubStudents,
          parentAssociationMemberId: "",
          parentAssociationMemberName: "",
        }
      : undefined;
    const baseItem: Omit<SchoolCommittee, "id"> = {
      name,
      type: formType,
      description: "",
      presidentId: isClub ? "" : formPresidentId,
      presidentName,
      members: isClub
        ? formMembers.map((member) => ({ ...member, role: "Danışman Öğretmen" }))
        : formMembers,
      establishmentDate: new Date().toISOString().substring(0, 10),
      isActive: true,
      clubDetails,
    };

    if (editingId) {
      setCommittees((prev) => prev.map((item) => item.id === editingId ? { ...item, ...baseItem } : item));
      showToast("Kayıt güncellendi.");
    } else {
      setCommittees((prev) => [{ ...baseItem, id: `COM-${Date.now()}` }, ...prev]);
      showToast(`${formType} kaydı oluşturuldu.`);
    }

    setIsModalOpen(false);
  };

  const filteredCommittees = useMemo(() => {
    const activeItems = committees.filter((item) => item.type === "Kulüp" ? item.isActive !== false : FIXED_BOARD_IDS.has(item.id));
    const term = searchTerm.toLocaleLowerCase("tr-TR").trim();
    if (!term) return activeItems;
    return activeItems.filter((item) => {
      const social = item.socialActivityBoard;
      const guidance = item.guidanceExecutionCommission;
      return (
        item.name.toLocaleLowerCase("tr-TR").includes(term) ||
        String(item.presidentName || "").toLocaleLowerCase("tr-TR").includes(term) ||
        (item.members || []).some((member) => member.teacherName.toLocaleLowerCase("tr-TR").includes(term)) ||
        Boolean(social?.teacherNames?.some((name) => name.toLocaleLowerCase("tr-TR").includes(term))) ||
        Boolean(social?.students?.some((student) =>
          student.name.toLocaleLowerCase("tr-TR").includes(term) || student.number.toLocaleLowerCase("tr-TR").includes(term)
        )) ||
        String(social?.parentAssociationMember || "").toLocaleLowerCase("tr-TR").includes(term) ||
        Boolean(item.clubDetails?.students?.some((student) =>
          student.name.toLocaleLowerCase("tr-TR").includes(term) || student.number.toLocaleLowerCase("tr-TR").includes(term)
        )) ||
        String(item.clubDetails?.parentAssociationMemberName || "").toLocaleLowerCase("tr-TR").includes(term) ||
        String(guidance?.parentAssociationMemberName || "").toLocaleLowerCase("tr-TR").includes(term) ||
        String(guidance?.disciplineMemberName || "").toLocaleLowerCase("tr-TR").includes(term) ||
        String(guidance?.honorBoardRepresentativeName || "").toLocaleLowerCase("tr-TR").includes(term)
      );
    });
  }, [committees, searchTerm]);

  const grouped = useMemo(() => {
    const result: Record<OrganizationType, SchoolCommittee[]> = {
      Kurul: [],
      Komisyon: [],
      Ekip: [],
      Kulüp: [],
    };
    filteredCommittees.forEach((item) => {
      result[item.type || "Kurul"].push(item);
    });
    const boardOrder = [
      HONOR_BOARD_ID,
      DISCIPLINE_BOARD_ID,
      PARENT_ASSOCIATION_MANAGEMENT_ID,
      PARENT_ASSOCIATION_AUDIT_ID,
      WORK_REVIEW_SELECTION_ID,
      DEPARTMENT_CHAIRS_ID,
      SOCIAL_ACTIVITY_COMMITTEE_ID,
    ];
    result.Kurul.sort((a, b) => {
      const ai = boardOrder.indexOf(a.id);
      const bi = boardOrder.indexOf(b.id);
      return (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) - (bi < 0 ? Number.MAX_SAFE_INTEGER : bi);
    });
    result.Kulüp.sort((a, b) => {
      const aIndex = CLUB_CATALOG.findIndex((club) => normalizeText(club.name) === normalizeText(a.name));
      const bIndex = CLUB_CATALOG.findIndex((club) => normalizeText(club.name) === normalizeText(b.name));
      return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
    });
    return result;
  }, [filteredCommittees]);

  const renderOrganizationCard = (item: SchoolCommittee) => {
    const clubDefinition = item.type === "Kulüp"
      ? CLUB_CATALOG.find((club) => normalizeText(club.name) === normalizeText(item.name))
      : undefined;
    const label = clubDefinition
      ? (clubDefinition.mandatory ? "Zorunlu" : clubDefinition.theme || "Seçmeli")
      : "";

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleOpenEdit(item)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/80 bg-white/95 px-3 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-md"
        title={`${item.name} görevlilerini aç`}
      >
        <span className="text-[10px] font-black uppercase leading-tight tracking-wide text-slate-900">{item.name}</span>
        {label && (
          <span className="shrink-0 rounded-full bg-purple-100 px-2 py-1 text-[8px] font-black text-purple-800">{label}</span>
        )}
      </button>
    );
  };

  const renderColumn = (type: OrganizationType) => {
    const config = TYPE_CONFIG[type];
    const Icon = config.icon;
    const list = grouped[type];

    return (
      <section className={`min-h-[680px] rounded-3xl border p-3 shadow-sm ${config.wrapper}`}>
        <div className={`mb-3 rounded-2xl border px-3 py-2.5 ${config.header}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Icon className="h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <h2 className="truncate text-xs font-black uppercase tracking-wider">{config.title}</h2>
                <p className="text-[9px] font-bold opacity-70">{list.length} kayıt</p>
              </div>
            </div>
          </div>
        </div>

        {type === "Kulüp" && (
          <div className="mb-3 space-y-3">
            <div className="rounded-2xl border border-purple-200 bg-white/95 p-3">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleOpenClubCatalog}
                  className="flex-1 rounded-xl bg-purple-950 px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-wider text-white hover:bg-purple-900"
                >
                  Kulüp Tanımlama
                </button>
                <button
                  type="button"
                  onClick={handleSaveClubCatalog}
                  disabled={!isClubCatalogOpen}
                  className="rounded-xl bg-emerald-600 px-4 py-2.5 text-[10px] font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Kaydet
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-rose-100 px-2 py-1 text-[8px] font-black text-rose-700">8 Zorunlu</span>
                <span className="rounded-full bg-purple-100 px-2 py-1 text-[8px] font-black text-purple-800">{Math.max(0, list.length - MANDATORY_CLUBS.length)} Seçmeli</span>
              </div>

              {isClubCatalogOpen && (
                <div className="mt-3 space-y-3 border-t border-purple-100 pt-3">
                  <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-2.5">
                    <div className="mb-2 text-[9px] font-black uppercase tracking-wider text-rose-700">Zorunlu Kulüpler · 8</div>
                    <div className="space-y-1">
                      {MANDATORY_CLUBS.map((club) => (
                        <div key={club.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-[9px] font-bold text-slate-700">
                          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-rose-600 text-[10px] font-black text-white">✓</span>
                          <span>{club.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[9px] font-black uppercase tracking-wider text-purple-800">Seçmeli Kulüpler · 5 Tema</div>
                    {OPTIONAL_CLUB_THEMES.map((group) => (
                      <div key={group.theme} className="rounded-xl border border-purple-100 bg-purple-50/40 p-2.5">
                        <div className="mb-2 text-[9px] font-black uppercase tracking-wider text-purple-900">{group.theme}</div>
                        <div className="space-y-1">
                          {group.clubs.map((club) => {
                            const checked = clubSelectionDraft.includes(club.id);
                            return (
                              <label key={club.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 transition ${checked ? "border-purple-200 bg-white" : "border-transparent bg-white/55 hover:bg-white"}`}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => handleToggleOptionalClub(club)}
                                  className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-purple-700"
                                />
                                <span className="text-[9px] font-bold leading-snug text-slate-700">{club.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {list.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-white/80 bg-white/50 p-5 text-center">
              <Users className={`mx-auto mb-2 h-6 w-6 ${config.empty}`} />
              <p className={`text-[10px] font-black ${config.empty}`}>Henüz kayıt yok</p>
            </div>
          ) : (
            list.map(renderOrganizationCard)
          )}
        </div>
      </section>
    );
  };

  const renderGuidanceExecutionForm = () => (
    <>
      <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
        <div className="text-xs font-black text-orange-900">Komisyon Yapısı</div>
        <div className="mt-1 text-[10px] font-semibold leading-relaxed text-orange-700">
          Başkan okul müdürüdür. Üyeler: okuldaki idareciler, rehber öğretmen / psikolojik danışmanlar, 9-10-11-12. sınıf düzeylerinin her birinden bir sınıf rehber öğretmeni, Ödül ve Disiplin Kurulundan bir üye, Onur Kurulu temsilcisi ve Okul Aile Birliğinden bir üye.
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Başkan · Okul Müdürü</div>
        <div className="mt-1 text-sm font-black text-slate-900">{principalTeacher ? getTeacherName(principalTeacher) : "Okul Müdürü"}</div>
        {!principalTeacher && <p className="mt-1 text-[10px] font-semibold text-amber-600">Öğretmen / personel kayıtlarında “Okul Müdürü” tanımlı kişi bulunamadı. Başkan unvanı yine Okul Müdürü olarak kaydedilir.</p>}
      </div>

      <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black text-slate-800">İdareci Üyeler</h4>
            <p className="text-[10px] font-semibold text-slate-400">Okul müdürü başkan olduğu için tekrar üye listesine eklenmez. Diğer tüm idareciler eklenebilir.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500">{guidanceAdministratorIds.length} üye</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={guidanceAdministratorCandidateId} onChange={(e) => setGuidanceAdministratorCandidateId(e.target.value)} className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none">
            <option value="">İdareci seçiniz</option>
            {commissionAdministratorTeachers.filter((teacher: any) => !guidanceAdministratorIds.includes(String(teacher.id))).map((teacher: any) => (
              <option key={teacher.id} value={teacher.id}>{getTeacherName(teacher)} ({getTeacherAdministrativeRole(teacher) || "İdareci"})</option>
            ))}
          </select>
          <button type="button" onClick={handleAddGuidanceAdministrator} disabled={!guidanceAdministratorCandidateId} className="h-11 rounded-2xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-40">Ekle</button>
          <button type="button" onClick={() => setGuidanceAdministratorIds(commissionAdministratorTeachers.map((teacher: any) => String(teacher.id)))} disabled={commissionAdministratorTeachers.length === 0} className="h-11 rounded-2xl bg-orange-600 px-4 text-xs font-black text-white disabled:opacity-40">Tümünü Ekle</button>
        </div>
        {commissionAdministratorTeachers.length === 0 && <p className="mt-2 text-[10px] font-semibold text-amber-600">Okul müdürü dışında idareci kaydı bulunamadı.</p>}
        <div className="mt-3 space-y-2">
          {guidanceAdministratorIds.map((id, index) => {
            const teacher = teachers.find((item: any) => String(item.id) === String(id));
            return <div key={id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2"><span className="text-xs font-bold text-slate-700">{index + 1}. {teacher ? getTeacherName(teacher) : id}</span><button type="button" onClick={() => setGuidanceAdministratorIds((prev) => prev.filter((item) => item !== id))} className="rounded-lg bg-rose-50 p-1.5 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></div>;
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-xs font-black text-slate-800">Rehber Öğretmen / Psikolojik Danışman Üyeler</h4>
            <p className="text-[10px] font-semibold text-slate-400">Branşı Rehberlik, Psikolojik Danışmanlık veya PDR olan öğretmenler listelenir.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500">{guidanceCounselorTeacherIds.length} üye</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={guidanceCounselorCandidateId} onChange={(e) => setGuidanceCounselorCandidateId(e.target.value)} className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none">
            <option value="">Rehber öğretmen seçiniz</option>
            {counselorTeachers.filter((teacher: any) => !guidanceCounselorTeacherIds.includes(String(teacher.id))).map((teacher: any) => <option key={teacher.id} value={teacher.id}>{getTeacherName(teacher)} ({getTeacherBranch(teacher)})</option>)}
          </select>
          <button type="button" onClick={handleAddGuidanceCounselor} disabled={!guidanceCounselorCandidateId} className="h-11 rounded-2xl bg-slate-900 px-4 text-xs font-black text-white disabled:opacity-40">Ekle</button>
          <button type="button" onClick={() => setGuidanceCounselorTeacherIds(counselorTeachers.map((teacher: any) => String(teacher.id)))} disabled={counselorTeachers.length === 0} className="h-11 rounded-2xl bg-orange-600 px-4 text-xs font-black text-white disabled:opacity-40">Tümünü Ekle</button>
        </div>
        {counselorTeachers.length === 0 && <p className="mt-2 text-[10px] font-semibold text-amber-600">Rehberlik / Psikolojik Danışmanlık branşında öğretmen kaydı bulunamadı.</p>}
        <div className="mt-3 space-y-2">
          {guidanceCounselorTeacherIds.map((id, index) => {
            const teacher = teachers.find((item: any) => String(item.id) === String(id));
            return <div key={id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2"><span className="text-xs font-bold text-slate-700">{index + 1}. {teacher ? getTeacherName(teacher) : id}</span><button type="button" onClick={() => setGuidanceCounselorTeacherIds((prev) => prev.filter((item) => item !== id))} className="rounded-lg bg-rose-50 p-1.5 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></div>;
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
        <div className="mb-3">
          <h4 className="text-xs font-black text-slate-800">Sınıf Rehber Öğretmenleri</h4>
          <p className="text-[10px] font-semibold text-slate-400">Her sınıf seviyesinden, o seviyede sınıf rehber öğretmenliği görevi bulunan bir öğretmen seçilir.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CLASS_LEVELS.map((level) => (
            <div key={level}>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">{level}. Sınıf</label>
              <select value={guidanceClassAdvisorIds[level] || ""} onChange={(e) => setGuidanceClassAdvisorIds((prev) => ({ ...prev, [level]: e.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none">
                <option value="">Rehber öğretmen seçiniz</option>
                {(classAdvisorOptionsByLevel[level] || []).map((option) => <option key={option.id} value={option.id}>{option.name}{option.classroomNames.length ? ` (${option.classroomNames.join(", ")})` : ""}</option>)}
              </select>
              {(classAdvisorOptionsByLevel[level] || []).length === 0 && <p className="mt-1 text-[9px] font-semibold text-amber-600">{level}. sınıf düzeyinde sınıf rehber öğretmeni tanımı bulunamadı.</p>}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Ödül ve Disiplin Kurulu Üyesi</label>
          <select value={guidanceDisciplineMemberId} onChange={(e) => setGuidanceDisciplineMemberId(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none">
            <option value="">Üye seçiniz</option>
            {disciplineCommitteeMembers.map((member) => <option key={member.id} value={member.id}>{member.name}{member.role ? ` (${member.role})` : ""}</option>)}
          </select>
          {disciplineCommitteeMembers.length === 0 && <p className="mt-1 text-[9px] font-semibold text-amber-600">Önce Ödül ve Disiplin Kurulunu tanımlayınız.</p>}
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Onur Kurulu Temsilcisi</label>
          <select value={guidanceHonorRepresentativeId} onChange={(e) => setGuidanceHonorRepresentativeId(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none">
            <option value="">Temsilci seçiniz</option>
            {honorBoardMembers.map((member) => <option key={member.id} value={member.id}>{member.name}{member.role ? ` (${member.role})` : ""}</option>)}
          </select>
          {honorBoardMembers.length === 0 && <p className="mt-1 text-[9px] font-semibold text-amber-600">Önce Onur Kurulunu tanımlayınız.</p>}
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Okul Aile Birliği Üyesi</label>
          <select value={guidanceParentAssociationMemberId} onChange={(e) => setGuidanceParentAssociationMemberId(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none">
            <option value="">Üye seçiniz</option>
            {parentAssociationOptions.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          {parentAssociationOptions.length === 0 && <p className="mt-1 text-[9px] font-semibold text-amber-600">Önce Okul Aile Birliği Yönetim Kurulu üyelerini kaydediniz.</p>}
        </div>
      </div>
    </>
  );


  const renderHonorBoardForm = () => (
    <>
      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <div className="text-xs font-black text-sky-900">Onur Kurulu Yapısı</div>
        <div className="mt-1 text-[10px] font-semibold leading-relaxed text-sky-700">Başkan bir öğretmendir. 9, 10, 11 ve 12. sınıf düzeylerinin her birinden bir öğrenci üye seçilir. 12. sınıf öğrencisi ikinci başkan olur; ayrıca 12. sınıftan yedek ikinci başkan seçilir.</div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Kurul Başkanı · Öğretmen</label>
        <select value={honorPresidentTeacherId} onChange={(e) => setHonorPresidentTeacherId(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none">
          <option value="">Öğretmen seçiniz</option>
          {teachingTeachers.map((teacher: any) => <option key={teacher.id} value={teacher.id}>{getTeacherName(teacher)} ({getTeacherBranch(teacher)})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CLASS_LEVELS.map((level) => (
          <div key={level}>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">{level}. Sınıf Öğrenci Üye{level === "12" ? " · İkinci Başkan" : ""}</label>
            <select value={honorStudentIdsByLevel[level] || ""} onChange={(e) => setHonorStudentIdsByLevel((prev) => ({ ...prev, [level]: e.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none">
              <option value="">Öğrenci seçiniz</option>
              {(studentsByLevel[level] || []).map((student: any) => <option key={student.id} value={student.id}>{getStudentNumber(student) ? `${getStudentNumber(student)} · ` : ""}{getStudentName(student)}{getStudentClassroom(student) ? ` · ${getStudentClassroom(student)}` : ""}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Yedek İkinci Başkan · 12. Sınıf Öğrencisi</label>
        <select value={honorAlternateVicePresidentId} onChange={(e) => setHonorAlternateVicePresidentId(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none">
          <option value="">Yedek ikinci başkan seçiniz</option>
          {(studentsByLevel["12"] || []).filter((student: any) => String(student.id) !== String(honorStudentIdsByLevel["12"] || "")).map((student: any) => <option key={student.id} value={student.id}>{getStudentNumber(student) ? `${getStudentNumber(student)} · ` : ""}{getStudentName(student)}{getStudentClassroom(student) ? ` · ${getStudentClassroom(student)}` : ""}</option>)}
        </select>
      </div>
    </>
  );

  const renderDisciplineBoardForm = () => (
    <>
      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <div className="text-xs font-black text-sky-900">Okul Öğrenci Ödül ve Disiplin Kurulu Yapısı</div>
        <div className="mt-1 text-[10px] font-semibold leading-relaxed text-sky-700">Başkan bir müdür yardımcısıdır. İki öğretmen üye, Onur Kurulu ikinci başkanı ve Okul Aile Birliğinden bir veli üyedir.</div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Başkan · Müdür Yardımcısı</label>
        <select value={disciplinePresidentId} onChange={(e) => setDisciplinePresidentId(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none">
          <option value="">Müdür yardımcısı seçiniz</option>
          {vicePrincipalTeachers.map((teacher: any) => <option key={teacher.id} value={teacher.id}>{getTeacherName(teacher)} ({getTeacherAdministrativeRole(teacher) || "Müdür Yardımcısı"})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1].map((index) => (
          <div key={index}>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Öğretmen Üye {index + 1}</label>
            <select value={disciplineTeacherIds[index] || ""} onChange={(e) => setDisciplineTeacherIds((prev) => { const next = [...prev]; next[index] = e.target.value; return next.filter((value, idx) => value || idx <= index); })} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none">
              <option value="">Öğretmen seçiniz</option>
              {teachingTeachers.map((teacher: any) => <option key={teacher.id} value={teacher.id} disabled={disciplineTeacherIds.some((id, idx) => idx !== index && String(id) === String(teacher.id))}>{getTeacherName(teacher)} ({getTeacherBranch(teacher)})</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">Onur Kurulu İkinci Başkanı</div>
        <div className="mt-1 text-sm font-black text-slate-900">{honorVicePresidentStudent ? `${honorVicePresidentStudent.number ? `${honorVicePresidentStudent.number} · ` : ""}${honorVicePresidentStudent.name}` : "Onur Kurulunda 12. sınıf ikinci başkanı henüz seçilmedi."}</div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Okul Aile Birliği Veli Üyesi</label>
        <select value={disciplineParentMemberName} onChange={(e) => setDisciplineParentMemberName(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none">
          <option value="">Veli seçiniz</option>
          {parentAssociationOptions.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}
        </select>
        {parentAssociationOptions.length === 0 && <p className="mt-1 text-[9px] font-semibold text-amber-600">Önce Okul Aile Birliği Yönetim Kurulu üyelerini giriniz.</p>}
      </div>
    </>
  );

  const renderParentManagementForm = () => (
    <>
      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <div className="text-xs font-black text-sky-900">Okul Aile Birliği Yönetim Kurulu</div>
        <div className="mt-1 text-[10px] font-semibold leading-relaxed text-sky-700">5 asil ve 5 yedek üyenin tamamı velidir. İsimler elle girilir; başkan ve ikinci başkan asil üyeler arasından seçilir.</div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <h4 className="mb-3 text-xs font-black text-slate-800">5 Asil Veli Üye</h4>
          <div className="space-y-2">
            {parentManagementPrincipalNames.map((name, index) => <input key={index} value={name} onChange={(e) => setParentManagementPrincipalNames((prev) => prev.map((value, idx) => idx === index ? e.target.value : value))} placeholder={`${index + 1}. asil veli adı soyadı`} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none" />)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <h4 className="mb-3 text-xs font-black text-slate-800">5 Yedek Veli Üye</h4>
          <div className="space-y-2">
            {parentManagementAlternateNames.map((name, index) => <input key={index} value={name} onChange={(e) => setParentManagementAlternateNames((prev) => prev.map((value, idx) => idx === index ? e.target.value : value))} placeholder={`${index + 1}. yedek veli adı soyadı`} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none" />)}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Başkan</label>
          <select value={parentManagementPresidentName} onChange={(e) => setParentManagementPresidentName(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none"><option value="">Başkan seçiniz</option>{parentManagementPrincipalNames.filter((name) => name.trim()).map((name, index) => <option key={`${name}-${index}`} value={name.trim()}>{name.trim()}</option>)}</select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">İkinci Başkan</label>
          <select value={parentManagementVicePresidentName} onChange={(e) => setParentManagementVicePresidentName(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none"><option value="">İkinci başkan seçiniz</option>{parentManagementPrincipalNames.filter((name) => name.trim()).map((name, index) => <option key={`${name}-${index}`} value={name.trim()} disabled={name.trim() === parentManagementPresidentName}>{name.trim()}</option>)}</select>
        </div>
      </div>
    </>
  );

  const renderParentAuditForm = () => {
    const allSelectedTeacherIds = [...parentAuditPrincipalTeacherIds, ...parentAuditAlternateTeacherIds];
    return (
      <>
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
          <div className="text-xs font-black text-sky-900">Okul Aile Birliği Denetleme Kurulu</div>
          <div className="mt-1 text-[10px] font-semibold leading-relaxed text-sky-700">2 asil öğretmen, 2 yedek öğretmen, 1 asil veli ve 1 yedek veli bulunur. Veli isimleri elle girilir ve Yönetim Kurulu üyelerinden farklı olmalıdır.</div>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h4 className="mb-3 text-xs font-black text-slate-800">Asil Öğretmenler</h4>
            {[0, 1].map((index) => <select key={index} value={parentAuditPrincipalTeacherIds[index] || ""} onChange={(e) => setParentAuditPrincipalTeacherIds((prev) => { const next = [...prev]; next[index] = e.target.value; return next; })} className="mb-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none"><option value="">{index + 1}. asil öğretmen</option>{teachingTeachers.map((teacher: any) => <option key={teacher.id} value={teacher.id} disabled={allSelectedTeacherIds.some((id) => String(id) === String(teacher.id)) && String(parentAuditPrincipalTeacherIds[index] || "") !== String(teacher.id)}>{getTeacherName(teacher)} ({getTeacherBranch(teacher)})</option>)}</select>)}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <h4 className="mb-3 text-xs font-black text-slate-800">Yedek Öğretmenler</h4>
            {[0, 1].map((index) => <select key={index} value={parentAuditAlternateTeacherIds[index] || ""} onChange={(e) => setParentAuditAlternateTeacherIds((prev) => { const next = [...prev]; next[index] = e.target.value; return next; })} className="mb-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none"><option value="">{index + 1}. yedek öğretmen</option>{teachingTeachers.map((teacher: any) => <option key={teacher.id} value={teacher.id} disabled={allSelectedTeacherIds.some((id) => String(id) === String(teacher.id)) && String(parentAuditAlternateTeacherIds[index] || "") !== String(teacher.id)}>{getTeacherName(teacher)} ({getTeacherBranch(teacher)})</option>)}</select>)}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Asil Veli · Elle Giriniz</label><input value={parentAuditPrincipalParentName} onChange={(e) => setParentAuditPrincipalParentName(e.target.value)} placeholder="Ad soyad" className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none" /></div>
          <div><label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Yedek Veli · Elle Giriniz</label><input value={parentAuditAlternateParentName} onChange={(e) => setParentAuditAlternateParentName(e.target.value)} placeholder="Ad soyad" className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none" /></div>
        </div>
      </>
    );
  };

  const renderWorkReviewForm = () => (
    <>
      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <div className="text-xs font-black text-sky-900">Eser İnceleme ve Seçme Kurulu</div>
        <div className="mt-1 text-[10px] font-semibold leading-relaxed text-sky-700">Bir müdür yardımcısı, iki öğretmen ve ilgili sosyal kulübün tüm danışman öğretmenleri kurul üyesidir.</div>
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Müdür Yardımcısı</label>
        <select value={workReviewVicePrincipalId} onChange={(e) => setWorkReviewVicePrincipalId(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none"><option value="">Müdür yardımcısı seçiniz</option>{vicePrincipalTeachers.map((teacher: any) => <option key={teacher.id} value={teacher.id}>{getTeacherName(teacher)}</option>)}</select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[0, 1].map((index) => <div key={index}><label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Öğretmen Üye {index + 1}</label><select value={workReviewTeacherIds[index] || ""} onChange={(e) => setWorkReviewTeacherIds((prev) => { const next = [...prev]; next[index] = e.target.value; return next; })} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none"><option value="">Öğretmen seçiniz</option>{teachingTeachers.map((teacher: any) => <option key={teacher.id} value={teacher.id} disabled={workReviewTeacherIds.some((id, idx) => idx !== index && String(id) === String(teacher.id))}>{getTeacherName(teacher)} ({getTeacherBranch(teacher)})</option>)}</select></div>)}
      </div>
      <div>
        <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">İlgili Sosyal Kulüp</label>
        <select value={workReviewClubId} onChange={(e) => setWorkReviewClubId(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none"><option value="">Kulüp seçiniz</option>{activeClubOptions.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}</select>
      </div>
      <div className="rounded-2xl border border-purple-100 bg-purple-50 p-4">
        <div className="text-[10px] font-black uppercase tracking-wider text-purple-700">Seçilen Kulübün Danışman Öğretmenleri · Otomatik Üye</div>
        <div className="mt-2 space-y-1">{selectedWorkReviewAdvisorNames.length ? selectedWorkReviewAdvisorNames.map((name, index) => <div key={`${name}-${index}`} className="text-xs font-bold text-slate-700">{index + 1}. {name}</div>) : <div className="text-[10px] font-semibold text-slate-400">Kulüp seçilmedi veya kulüpte danışman öğretmen tanımlı değil.</div>}</div>
      </div>
    </>
  );

  const renderDepartmentChairsForm = () => (
    <>
      <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
        <div className="text-xs font-black text-sky-900">Eğitim Kurumu Zümre Başkanları Kurulu</div>
        <div className="mt-1 text-[10px] font-semibold leading-relaxed text-sky-700">Okuldaki her branş için o branştan bir öğretmen zümre başkanı olarak seçilir.</div>
      </div>
      <div className="space-y-3">
        {departmentBranches.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-xs font-semibold text-slate-400">Branşlı öğretmen kaydı bulunamadı.</div> : departmentBranches.map((branch) => (
          <div key={branch} className="grid grid-cols-1 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_1.5fr] sm:items-center">
            <div className="text-xs font-black text-slate-800">{branch}</div>
            <select value={departmentChairIdsByBranch[branch] || ""} onChange={(e) => setDepartmentChairIdsByBranch((prev) => ({ ...prev, [branch]: e.target.value }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none"><option value="">Zümre başkanı seçiniz</option>{(departmentTeachersByBranch[branch] || []).map((teacher: any) => <option key={teacher.id} value={teacher.id}>{getTeacherName(teacher)}</option>)}</select>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <div id="committees-module-container" className="mx-auto w-full space-y-4 px-4 pb-4 pt-0 lg:px-6 lg:pb-6 lg:pt-0">
      <div className="rounded-3xl border-2 border-dashed border-purple-950 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-black text-slate-900">Organizasyon ve Hatırlatma Merkezi</h1>
            <p className="mt-1 text-xs font-bold text-slate-500">Kurul, komisyon ve ekipler sistemde hazır gelir; yalnız üyeleri seçin. Kulüpleri tanımlayıp görevlileri atayın.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="İsim, başkan veya öğretmen ara..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs font-bold outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
        {renderColumn("Kurul")}
        {renderColumn("Komisyon")}
        {renderColumn("Ekip")}
        {renderColumn("Kulüp")}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  {editingId ? formName : `${formType} Tanımla`}
                </h3>
                <p className="text-[11px] font-semibold text-slate-500">
                  {formType === "Kulüp" ? "Danışman öğretmenleri ve kulüpte görevli öğrencileri burada yönetin." : isPlaceholderFixedForm ? "Bu yapı sistemde hazırdır. Görevli ayrıntıları daha sonra tanımlanacaktır." : FIXED_BOARD_IDS.has(editingId || "") ? "Görevlileri bu pencereden görüntüleyin ve seçin." : "Başkan ve üyeleri seçin."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl bg-white p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="max-h-[calc(92vh-84px)] space-y-5 overflow-y-auto p-6">
              {isPlaceholderFixedForm ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
                  <Users className="mx-auto h-10 w-10 text-slate-300" />
                  <div className="mt-3 text-sm font-black text-slate-800">Görevli yapısı henüz tanımlanmadı</div>
                  <div className="mx-auto mt-2 max-w-xl text-xs font-semibold leading-relaxed text-slate-500">Bu kurul, komisyon veya ekip sistemde hazır olarak oluşturuldu. Başkan ve üye ayrıntılarını daha sonra belirlediğinizde bu pencereye seçim alanları eklenecek.</div>
                </div>
              ) : isGuidanceExecutionForm ? (
                renderGuidanceExecutionForm()
              ) : isHonorBoardForm ? (
                renderHonorBoardForm()
              ) : isDisciplineBoardForm ? (
                renderDisciplineBoardForm()
              ) : isParentManagementForm ? (
                renderParentManagementForm()
              ) : isParentAuditForm ? (
                renderParentAuditForm()
              ) : isWorkReviewForm ? (
                renderWorkReviewForm()
              ) : isDepartmentChairsForm ? (
                renderDepartmentChairsForm()
              ) : isSocialActivityForm ? (
                <>
                  <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4">
                    <div className="text-xs font-black text-sky-900">Kurul Yapısı</div>
                    <div className="mt-1 text-[10px] font-semibold text-sky-700">1 idareci kurul başkanı · kulüp danışmanlarından 3 öğretmen · 2 öğrenci · 1 Okul Aile Birliği üyesi</div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Kurul Başkanı · İdareci</label>
                    <select
                      value={socialPresidentId}
                      onChange={(e) => setSocialPresidentId(e.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    >
                      <option value="">İdareci seçiniz</option>
                      {administratorTeachers.map((teacher: any) => (
                        <option key={teacher.id} value={teacher.id}>
                          {getTeacherName(teacher)} ({teacher.adminRole || "İdareci"})
                        </option>
                      ))}
                    </select>
                    {administratorTeachers.length === 0 && (
                      <p className="mt-1 text-[10px] font-semibold text-amber-600">Öğretmen kayıtlarında “Okul Müdürü” veya “Müdür Yardımcısı” olarak tanımlanmış idareci bulunamadı.</p>
                    )}
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800">Öğretmen Üyeler</h4>
                        <p className="text-[10px] font-semibold text-slate-400">Yalnız Kulüpler / Sosyal Etkinlikler alanında danışman olarak atanmış öğretmenler listelenir.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500">{socialTeacherIds.length}/3</span>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        value={socialTeacherCandidateId}
                        onChange={(e) => setSocialTeacherCandidateId(e.target.value)}
                        disabled={socialTeacherIds.length >= 3}
                        className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="">Kulüp danışmanı öğretmen seçiniz</option>
                        {clubAdvisorTeachers
                          .filter((teacher: any) => !socialTeacherIds.includes(String(teacher.id)))
                          .map((teacher: any) => (
                            <option key={teacher.id} value={teacher.id}>{getTeacherName(teacher)} ({getTeacherBranch(teacher)})</option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddSocialTeacher}
                        disabled={!socialTeacherCandidateId || socialTeacherIds.length >= 3}
                        className="h-11 rounded-2xl bg-slate-900 px-5 text-xs font-black text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Öğretmen Ekle
                      </button>
                    </div>
                    {clubAdvisorTeachers.length === 0 && (
                      <p className="mt-2 text-[10px] font-semibold text-amber-600">Henüz kulüp danışmanı öğretmen kaydı yok. Önce Kulüpler / Sosyal Etkinlikler alanında danışman öğretmenleri kaydediniz.</p>
                    )}
                    <div className="mt-3 space-y-2">
                      {socialTeacherIds.map((teacherId, index) => {
                        const teacher = teachers.find((item: any) => String(item.id) === String(teacherId));
                        return (
                          <div key={teacherId} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                            <span className="text-xs font-bold text-slate-700">{index + 1}. {teacher ? getTeacherName(teacher) : teacherId}</span>
                            <button type="button" onClick={() => setSocialTeacherIds((prev) => prev.filter((id) => id !== teacherId))} className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-800">Öğrenci Üyeler</h4>
                        <p className="text-[10px] font-semibold text-slate-400">Öğrenci numarası veya adıyla arayın ve kurula ekleyin.</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500">{socialStudents.length}/2</span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        onKeyDown={handleStudentSearchKeyDown}
                        disabled={socialStudents.length >= 2}
                        placeholder="Öğrenci numarası veya adı yazınız..."
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-bold outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-100"
                      />
                    </div>
                    {studentSearch.trim() && socialStudents.length < 2 && (
                      <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
                        {matchingStudents.length === 0 ? (
                          <div className="p-3 text-center text-[10px] font-semibold text-slate-400">Eşleşen öğrenci bulunamadı.</div>
                        ) : matchingStudents.map((student: any) => (
                          <button
                            type="button"
                            key={student.id}
                            onClick={() => handleAddSocialStudent(student)}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-sky-50"
                          >
                            <span className="text-xs font-bold text-slate-700">{getStudentName(student)}</span>
                            <span className="text-[10px] font-black text-slate-400">{getStudentNumber(student) || "No yok"}{getStudentClassroom(student) ? ` · ${getStudentClassroom(student)}` : ""}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 space-y-2">
                      {socialStudents.map((student, index) => (
                        <div key={student.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                          <div>
                            <div className="text-xs font-bold text-slate-700">{index + 1}. {student.name}</div>
                            <div className="text-[9px] font-semibold text-slate-400">{student.number ? `No: ${student.number}` : "Numara yok"}{student.classroom ? ` · ${student.classroom}` : ""}</div>
                          </div>
                          <button type="button" onClick={() => setSocialStudents((prev) => prev.filter((item) => item.id !== student.id))} className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Okul Aile Birliği Üyesi</label>
                    <select
                      value={socialParentAssociationMember}
                      onChange={(e) => setSocialParentAssociationMember(e.target.value)}
                      className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                    >
                      <option value="">Üye seçiniz</option>
                      {parentAssociationOptions.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}
                    </select>
                    {parentAssociationOptions.length === 0 && (
                      <p className="mt-1 text-[10px] font-semibold text-amber-600">Önce Okul Aile Birliği Yönetim Kurulu üyelerini kaydediniz.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {formType === "Kulüp" ? (
                    <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
                      <div className="text-[10px] font-black uppercase tracking-wider text-purple-700">Kulüp</div>
                      <div className="mt-1 text-sm font-black text-slate-900">{formName}</div>
                      <div className="mt-1 text-[10px] font-semibold text-slate-500">Kulüp adı sabittir. Zorunlu kulüpler sistemde hazır gelir; seçmeli kulüpler tema listesinden işaretlenir.</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Ad</label>
                        <input value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="Örn: Kurul / Komisyon adı" className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Tür</label>
                        <select value={formType} onChange={(e) => setFormType(e.target.value as OrganizationType)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100">
                          <option value="Kurul">Kurul</option><option value="Komisyon">Komisyon</option><option value="Ekip">Ekip</option>
                        </select>
                      </div>
                    </div>
                  )}
                  {formType !== "Kulüp" && (
                    <div>
                      <label className="mb-1 block text-[10px] font-black uppercase tracking-wider text-slate-500">Başkan</label>
                      <select value={formPresidentId} onChange={(e) => setFormPresidentId(e.target.value)} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100">
                        <option value="">Okul Müdürü ({getPrincipalName()})</option>
                        {teachers.map((teacher: any) => <option key={teacher.id} value={teacher.id}>{getTeacherName(teacher)} ({getTeacherBranch(teacher)})</option>)}
                      </select>
                    </div>
                  )}
                  <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div><h4 className="text-xs font-black text-slate-800">{formType === "Kulüp" ? "Danışman Öğretmenler" : "Üyeler"}</h4><p className="text-[10px] font-semibold text-slate-400">{formType === "Kulüp" ? "Kulüpte görevli öğretmenler danışman öğretmen olarak kaydedilir; birden fazla öğretmen eklenebilir." : "Birden fazla öğretmen eklenebilir."}</p></div>
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500">{formMembers.length} öğretmen</span>
                    </div>
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row">
                      <select value={newMemberId} onChange={(e) => setNewMemberId(e.target.value)} className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none"><option value="">{formType === "Kulüp" ? "Danışman öğretmen seçin" : "Öğretmen seçin"}</option>{teachers.map((teacher: any) => <option key={teacher.id} value={teacher.id}>{getTeacherName(teacher)} ({getTeacherBranch(teacher)})</option>)}</select>
                      <button type="button" onClick={handleAddMember} className="h-11 rounded-2xl bg-slate-900 px-5 text-xs font-black text-white hover:bg-slate-800">Öğretmen Ekle</button>
                    </div>
                    <div className="space-y-2">{formMembers.length === 0 ? <div className="p-4 text-center text-xs font-semibold text-slate-400">Henüz öğretmen eklenmedi.</div> : formMembers.map((member, idx) => <div key={`${member.teacherId}-${idx}`} className="flex items-center justify-between rounded-xl bg-white px-3 py-2"><span className="text-xs font-bold text-slate-700">{member.teacherName}</span><button type="button" onClick={() => handleRemoveMember(idx)} className="rounded-lg bg-rose-50 p-1.5 text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button></div>)}</div>
                  </div>

                  {formType === "Kulüp" && (
                    <>
                      <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-xs font-black text-slate-800">Kulüpte Görevli Öğrenciler</h4>
                            <p className="text-[10px] font-semibold text-slate-400">Öğrenci numarası veya adı soyadıyla arayıp kulübe ekleyin.</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-slate-500">{clubStudents.length} öğrenci</span>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            value={clubStudentSearch}
                            onChange={(event) => setClubStudentSearch(event.target.value)}
                            onKeyDown={handleClubStudentSearchKeyDown}
                            placeholder="Öğrenci numarası veya adı soyadı..."
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-xs font-bold outline-none focus:border-purple-300 focus:ring-4 focus:ring-purple-100"
                          />
                        </div>
                        {clubStudentSearch.trim() && (
                          <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
                            {matchingClubStudents.length === 0 ? (
                              <div className="p-3 text-center text-[10px] font-semibold text-slate-400">Eşleşen öğrenci bulunamadı.</div>
                            ) : matchingClubStudents.map((student: any) => (
                              <button type="button" key={student.id} onClick={() => handleAddClubStudent(student)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-purple-50">
                                <span className="text-xs font-bold text-slate-700">{getStudentName(student)}</span>
                                <span className="text-[10px] font-black text-slate-400">{getStudentNumber(student) || "No yok"}{getStudentClassroom(student) ? ` · ${getStudentClassroom(student)}` : ""}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 space-y-2">
                          {clubStudents.map((student, index) => (
                            <div key={student.id} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                              <div>
                                <div className="text-xs font-bold text-slate-700">{index + 1}. {student.name}</div>
                                <div className="text-[9px] font-semibold text-slate-400">{student.number ? `No: ${student.number}` : "Numara yok"}{student.classroom ? ` · ${student.classroom}` : ""}</div>
                              </div>
                              <button type="button" onClick={() => setClubStudents((prev) => prev.filter((item) => item.id !== student.id))} className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-2xl bg-slate-100 px-5 py-3 text-xs font-black text-slate-600 hover:bg-slate-200">İptal</button>
                {!isPlaceholderFixedForm && (
                  <button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-purple-950 px-5 py-3 text-xs font-black text-white hover:bg-purple-900">
                    <UserCheck className="h-4 w-4" /> Kaydet
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
