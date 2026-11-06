import { cacheManager } from "../../core/cache";
import { eventBus } from "../../core/events";
import { transactionManager } from "../../core/transactions";
import { studentService } from "../student";
import { teacherService } from "../teacher";
import { classroomService } from "../classroom";
import {
  messageDeliveryRepository,
  surveyRepository,
  publishedSurveyRepository,
  surveyInvitationRepository,
  surveySubmissionRepository,
  surveyResponseRepository,
  voiceMessageRepository,
  type CommunicationEntity,
} from "./CommunicationRepository";
import { COMMUNICATION_EVENTS } from "./communicationEvents";

export type SurveyQuestion = {
  id: string;
  text: string;
  answerType: "short" | "paragraph" | "number" | "phone" | "choice" | "multiple" | "dropdown";
  options: string[];
  required: boolean;
};

export type SurveyAudience = "Öğrenci" | "Veli" | "Öğretmen" | "Seçili Kişiler";

export type SurveyDraft = {
  id: string;
  title: string;
  description: string;
  audiences: SurveyAudience[];
  selectedRecipientIds?: string[];
  selectedClassrooms?: string[];
  questions: SurveyQuestion[];
  expiresAt?: string;
  allowMultipleResponses?: boolean;
  lastPublishedToken?: string;
  updatedAt: string;
};

export type SurveyInvitation = {
  id: string;
  surveyToken: string;
  inviteToken: string;
  recipientId: string;
  recipientName: string;
  role: "Öğrenci" | "Veli" | "Öğretmen";
  classroom?: string;
  phone?: string;
  url: string;
  createdAt: string;
};

export type SurveySubmission = {
  id: string;
  token: string;
  answers: Record<string, string | string[]>;
  respondentKey: string;
  invitationToken?: string;
  recipientId?: string;
  recipientName?: string;
  role?: string;
  classroom?: string;
  submittedAt: string;
};

export type SurveyAnalytics = {
  survey: SurveyDraft | null;
  invitations: SurveyInvitation[];
  submissions: SurveySubmission[];
  responses: Record<string, string[]>;
  invitedCount: number;
  responseCount: number;
  responseRate: number;
  byRole: Record<string, { invited: number; responded: number }>;
  byClassroom: Record<string, { invited: number; responded: number }>;
};

export type VoiceMessageRecord = { id: string; title: string; duration: number; timestamp: string; sender: string; status?: "draft" | "ready" | "sent"; };
export type MessageDeliveryRecord = { id: string; createdAt: string; type: string; ok: boolean; status?: string; recipientCount: number; recipients: Array<{ id: string; name: string; normalized: string; role: string }>; messagePreview?: string; fileName?: string | null; };

const cachePrefix = "communication:";
const legacyDraftId = "active-survey-draft";
const workspaceStateId = "survey-workspace-state";
const safeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const readValue = (obj: any, keys: string[]) => { for (const key of keys) { const value = obj?.[key]; if (value !== undefined && value !== null && String(value).trim()) return String(value).trim(); } return ""; };
const studentPhoneKeys = ["phone","studentPhone","telefon","cepTelefonu","mobile","phoneNumber","studentPhoneNumber","ogrenciTelefon","öğrenciTelefon"];
const parentPhoneKeys = ["parentPhone","guardianPhone","veliTelefon","veliTelefonu","parentPhoneNumber","motherPhone","fatherPhone","anneTelefon","babaTelefon","phoneParent","guardian_phone","veliCep","veliCepTelefonu","parent_mobile"];
const teacherPhoneKeys = ["phone","teacherPhone","telefon","cepTelefonu","mobile","phoneNumber","gsm","cellPhone"];
const studentName = (s:any) => String(s?.name || s?.fullName || s?.adSoyad || [s?.firstName,s?.lastName].filter(Boolean).join(" ") || "Öğrenci").trim();
const classroomName = (s:any) => String(s?.classroom || s?.className || s?.sinif || s?.sınıf || s?.class || "").trim();

export class CommunicationService {
  private invalidate() { cacheManager.invalidatePrefix(cachePrefix); }

  async getDirectory() {
    const [students, teachers, classrooms] = await Promise.all([studentService.list(), teacherService.list(), classroomService.list()]);
    return { students, teachers, classrooms };
  }

  private async setActiveSurveyId(activeSurveyId: string): Promise<void> {
    await surveyRepository.save({ id: workspaceStateId, activeSurveyId, updatedAt: new Date().toISOString() } as CommunicationEntity);
  }

  async listSurveyDrafts(): Promise<SurveyDraft[]> {
    const rows = await surveyRepository.findAll();
    return rows
      .filter((row:any) => String(row?.id || "") !== workspaceStateId && Array.isArray(row?.questions))
      .map(row => row as unknown as SurveyDraft)
      .sort((a,b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }

  async loadSurveyDraft(): Promise<SurveyDraft | null> {
    const state = await surveyRepository.findById(workspaceStateId) as any;
    const activeSurveyId = String(state?.activeSurveyId || "").trim();
    if (activeSurveyId) {
      const active = await surveyRepository.findById(activeSurveyId);
      if (active) return active as unknown as SurveyDraft;
    }
    const legacy = await surveyRepository.findById(legacyDraftId);
    if (legacy) {
      await this.setActiveSurveyId(legacyDraftId);
      return legacy as unknown as SurveyDraft;
    }
    const rows = await this.listSurveyDrafts();
    if (rows[0]) await this.setActiveSurveyId(rows[0].id);
    return rows[0] || null;
  }

  async activateSurvey(id: string): Promise<SurveyDraft> {
    const row = await surveyRepository.findById(id);
    if (!row || !Array.isArray((row as any).questions)) throw new Error("Anket bulunamadı.");
    await this.setActiveSurveyId(id);
    this.invalidate();
    return row as unknown as SurveyDraft;
  }

  async createSurveyDraft(title?: string): Promise<SurveyDraft> {
    const questionId = safeId("q");
    const now = new Date().toISOString();
    const draft: SurveyDraft = {
      id: safeId("survey-draft"),
      title: String(title || "").trim() || "Adsız anket",
      description: "",
      audiences: [],
      selectedRecipientIds: [],
      selectedClassrooms: [],
      questions: [{ id: questionId, text: "", answerType: "choice", options: ["Seçenek 1", "Seçenek 2"], required: false }],
      expiresAt: "",
      allowMultipleResponses: false,
      updatedAt: now,
    };
    await surveyRepository.save(draft as unknown as CommunicationEntity);
    await this.setActiveSurveyId(draft.id);
    this.invalidate();
    await eventBus.emit(COMMUNICATION_EVENTS.surveySaved, draft);
    return draft;
  }

  async saveSurveyDraft(input: Omit<SurveyDraft, "id" | "updatedAt"> & Partial<Pick<SurveyDraft, "id" | "updatedAt">>): Promise<SurveyDraft> {
    const questions = Array.isArray(input.questions) ? input.questions : [];
    for (const question of questions) {
      if (!String(question.id || "").trim() || !String(question.text || "").trim()) throw new Error("Anket sorusu boş olamaz.");
      if (["choice", "multiple", "dropdown"].includes(question.answerType) && (!Array.isArray(question.options) || question.options.filter(x=>String(x).trim()).length < 2)) throw new Error("Seçimli soruda en az iki seçenek olmalıdır.");
    }
    const saved: SurveyDraft = {
      id: input.id || safeId("survey-draft"),
      title: String(input.title || "").trim(),
      description: String(input.description || ""),
      audiences: Array.isArray(input.audiences) ? input.audiences : [],
      selectedRecipientIds: Array.isArray(input.selectedRecipientIds) ? input.selectedRecipientIds : [],
      selectedClassrooms: Array.isArray(input.selectedClassrooms) ? input.selectedClassrooms : [],
      questions,
      expiresAt: input.expiresAt ? String(input.expiresAt) : "",
      allowMultipleResponses: Boolean(input.allowMultipleResponses),
      lastPublishedToken: input.lastPublishedToken ? String(input.lastPublishedToken) : undefined,
      updatedAt: new Date().toISOString(),
    };
    await surveyRepository.save(saved as unknown as CommunicationEntity);
    await this.setActiveSurveyId(saved.id);
    this.invalidate();
    await eventBus.emit(COMMUNICATION_EVENTS.surveySaved, saved);
    return saved;
  }

  async resolveSurveyRecipients(input: SurveyDraft): Promise<Array<{id:string;name:string;role:"Öğrenci"|"Veli"|"Öğretmen";classroom:string;phone:string}>> {
    const { students, teachers } = await this.getDirectory();
    const classes = new Set((input.selectedClassrooms || []).map(String));
    const classMatches = (classroom:string) => classes.size === 0 || classes.has(classroom);
    const selected = new Set(input.selectedRecipientIds || []);
    const result: Array<{id:string;name:string;role:"Öğrenci"|"Veli"|"Öğretmen";classroom:string;phone:string}> = [];
    const seen = new Set<string>();
    const add = (row:{id:string;name:string;role:"Öğrenci"|"Veli"|"Öğretmen";classroom:string;phone:string}) => { if (!seen.has(row.id)) { seen.add(row.id); result.push(row); } };

    students.filter((s:any)=>s?.status !== "Pasif").forEach((s:any, index:number) => {
      const sid = String(s?.id || s?.studentNo || index);
      const cls = classroomName(s);
      if (input.audiences.includes("Öğrenci") && classMatches(cls)) add({ id:`student:${sid}`, name:studentName(s), role:"Öğrenci", classroom:cls, phone:readValue(s, studentPhoneKeys) });
      if (input.audiences.includes("Veli") && classMatches(cls)) add({ id:`parent:${sid}`, name:String(s?.parentName || s?.guardianName || `${studentName(s)} Velisi`), role:"Veli", classroom:cls, phone:readValue(s, parentPhoneKeys) });
      if (selected.has(`student:${sid}`)) add({ id:`student:${sid}`, name:studentName(s), role:"Öğrenci", classroom:cls, phone:readValue(s, studentPhoneKeys) });
      if (selected.has(`parent:${sid}`)) add({ id:`parent:${sid}`, name:String(s?.parentName || s?.guardianName || `${studentName(s)} Velisi`), role:"Veli", classroom:cls, phone:readValue(s, parentPhoneKeys) });
    });
    teachers.forEach((t:any,index:number) => {
      const tid=String(t?.id || index); const row={id:`teacher:${tid}`,name:String(t?.name||t?.fullName||t?.adSoyad||"Öğretmen"),role:"Öğretmen" as const,classroom:"",phone:readValue(t,teacherPhoneKeys)};
      if (input.audiences.includes("Öğretmen") || selected.has(row.id)) add(row);
    });
    return result;
  }

  async publishSurvey(input: SurveyDraft): Promise<{ token: string; url: string; survey: SurveyDraft; invitations: SurveyInvitation[] }> {
    let saved = await this.saveSurveyDraft(input);
    if (!saved.title.trim()) throw new Error("Anket başlığı boş bırakılamaz.");
    if (saved.questions.length === 0) throw new Error("Yayınlamak için en az bir soru ekleyin.");
    if (saved.audiences.length === 0 && !(saved.selectedRecipientIds || []).length) throw new Error("Anketin gönderileceği grubu seçin.");
    if (saved.expiresAt && new Date(saved.expiresAt).getTime() <= Date.now()) throw new Error("Anket bitiş tarihi gelecekte olmalıdır.");
    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

    // WhatsApp / QR bağlantıları localhost üzerinden üretilemez.
    // Öncelik: yapılandırılmış genel adres -> gerçek HTTPS origin -> projenin genel alan adı.
    const configuredPublicUrl = String(
      import.meta.env.VITE_HASAT_PUBLIC_APP_URL || import.meta.env.VITE_PUBLIC_APP_URL || ""
    ).trim();
    const currentOrigin = String(window.location.origin || "").trim();
    const isLocalOrigin = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(currentOrigin);
    const rawPublicBase = configuredPublicUrl || (!isLocalOrigin ? currentOrigin : "https://dersbende.com.tr");
    const publicBase = (/^https?:\/\//i.test(rawPublicBase) ? rawPublicBase : `https://${rawPublicBase}`)
      .replace(/\/+$/, "");
    const baseUrl = `${publicBase}/anket/${token}`;
    const record = { ...saved, id: token, token, publishedAt: new Date().toISOString(), status: "published" };
    await publishedSurveyRepository.save(record as unknown as CommunicationEntity);

    const recipients = await this.resolveSurveyRecipients(saved);
    const invitations: SurveyInvitation[] = recipients.map((recipient) => {
      const inviteToken = `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      return { id:`${token}:${inviteToken}`, surveyToken:token, inviteToken, recipientId:recipient.id, recipientName:recipient.name, role:recipient.role, classroom:recipient.classroom, phone:recipient.phone, url:`${baseUrl}?i=${encodeURIComponent(inviteToken)}`, createdAt:new Date().toISOString() };
    });
    for (const invitation of invitations) await surveyInvitationRepository.save(invitation as unknown as CommunicationEntity);
    saved = await this.saveSurveyDraft({ ...saved, lastPublishedToken: token });
    return { token, url: baseUrl, survey: saved, invitations };
  }

  async getPublishedSurvey(token: string): Promise<SurveyDraft | null> {
    const row = await publishedSurveyRepository.findById(token);
    if (!row) return null;
    const survey = row as unknown as SurveyDraft;
    if (survey.expiresAt && new Date(survey.expiresAt).getTime() < Date.now()) return survey;
    return survey;
  }

  async getSurveyAccess(token:string, invitationToken?:string, respondentKey?:string): Promise<{survey:SurveyDraft|null; expired:boolean; alreadyResponded:boolean; invitation?:SurveyInvitation}> {
    const survey = await this.getPublishedSurvey(token);
    if (!survey) return { survey:null, expired:false, alreadyResponded:false };
    const expired = Boolean(survey.expiresAt && new Date(survey.expiresAt).getTime() < Date.now());
    let invitation: SurveyInvitation | undefined;
    if (invitationToken) {
      const rows = await surveyInvitationRepository.findAll();
      invitation = rows.find((r:any)=>String(r.surveyToken)===token && String(r.inviteToken)===invitationToken) as unknown as SurveyInvitation | undefined;
    }
    const key = invitation ? `invite:${invitation.inviteToken}` : respondentKey ? `device:${respondentKey}` : "";
    let alreadyResponded = false;
    if (key && !survey.allowMultipleResponses) {
      const rows = await surveySubmissionRepository.findAll();
      alreadyResponded = rows.some((r:any)=>String(r.token)===token && String(r.respondentKey)===key);
    }
    return { survey, expired, alreadyResponded, invitation };
  }

  async submitSurvey(token: string, answers: Record<string, string | string[]>, options?:{invitationToken?:string;respondentKey?:string}): Promise<void> {
    const access = await this.getSurveyAccess(token, options?.invitationToken, options?.respondentKey);
    const survey = access.survey;
    if (!survey) throw new Error("Anket bulunamadı veya bağlantı geçersiz.");
    if (access.expired) throw new Error("Bu anketin yanıt süresi sona ermiştir.");
    if (access.alreadyResponded && !survey.allowMultipleResponses) throw new Error("Bu bağlantı ile ankete daha önce yanıt verilmiş.");
    const normalizedAnswers: Record<string, string | string[]> = { ...answers };
    for (const question of survey.questions) {
      const answer = normalizedAnswers[question.id];
      const empty = Array.isArray(answer) ? answer.length === 0 : !String(answer ?? "").trim();
      if (question.required && empty) throw new Error(`Zorunlu soru cevaplanmadı: ${question.text}`);
      if (!Array.isArray(answer) && answer != null) {
        if (["short", "paragraph"].includes(question.answerType)) normalizedAnswers[question.id] = String(answer).toLocaleUpperCase("tr-TR");
        if (question.answerType === "number") {
          const digits = String(answer).replace(/\D/g, "");
          if (String(answer).trim() && !digits) throw new Error(`Sayısal alan yalnızca rakam içermelidir: ${question.text}`);
          normalizedAnswers[question.id] = digits;
        }
        if (question.answerType === "phone") {
          let digits = String(answer).replace(/\D/g, "");
          if (digits && !digits.startsWith("0")) digits = `0${digits}`;
          normalizedAnswers[question.id] = digits.slice(0, 11);
        }
      }
    }
    const respondentKey = access.invitation ? `invite:${access.invitation.inviteToken}` : `device:${options?.respondentKey || safeId("anon")}`;
    const submission: SurveySubmission = {
      id: safeId(`survey-${token}`), token, answers: normalizedAnswers, respondentKey,
      invitationToken: access.invitation?.inviteToken,
      recipientId: access.invitation?.recipientId,
      recipientName: access.invitation?.recipientName,
      role: access.invitation?.role,
      classroom: access.invitation?.classroom,
      submittedAt: new Date().toISOString(),
    };
    await surveySubmissionRepository.save(submission as unknown as CommunicationEntity);
    await this.rebuildSurveyResponses(token, survey.questions);
  }

  private async rebuildSurveyResponses(token:string, questions:SurveyQuestion[]) {
    const rows = (await surveySubmissionRepository.findAll()).filter((row:any)=>String(row.token)===token);
    const responseMap: Record<string, string[]> = {};
    for (const question of questions) responseMap[question.id] = [];
    for (const row of rows) {
      const rowAnswers = (row.answers || {}) as Record<string, unknown>;
      for (const question of questions) {
        const value = rowAnswers[question.id];
        if (Array.isArray(value)) responseMap[question.id].push(value.map(String).join(", "));
        else if (value != null && String(value).trim()) responseMap[question.id].push(String(value));
      }
    }
    await this.replaceSurveyResponses(responseMap);
  }

  async loadSurveyResponses(): Promise<Record<string, string[]>> {
    const rows = await surveyResponseRepository.findAll(); const map: Record<string,string[]> = {};
    for (const row of rows) { const questionId=String(row.questionId||row.id||""); if(questionId) map[questionId]=Array.isArray(row.answers)?row.answers.map(String):[]; }
    return map;
  }

  async getSurveyAnalytics(token?:string): Promise<SurveyAnalytics> {
    const activeToken = token || (await this.loadSurveyDraft())?.lastPublishedToken || "";
    if (!activeToken) return { survey:null,invitations:[],submissions:[],responses:{},invitedCount:0,responseCount:0,responseRate:0,byRole:{},byClassroom:{} };
    const survey = await this.getPublishedSurvey(activeToken);
    const invitations=(await surveyInvitationRepository.findAll()).filter((r:any)=>String(r.surveyToken)===activeToken) as unknown as SurveyInvitation[];
    const submissions=(await surveySubmissionRepository.findAll()).filter((r:any)=>String(r.token)===activeToken) as unknown as SurveySubmission[];
    const responses:Record<string,string[]> = {};
    for (const q of survey?.questions || []) responses[q.id]=[];
    for (const s of submissions) for (const q of survey?.questions || []) { const value=s.answers?.[q.id]; if(Array.isArray(value)) responses[q.id].push(value.join(", ")); else if(value!=null&&String(value).trim()) responses[q.id].push(String(value)); }
    const byRole:Record<string,{invited:number;responded:number}>={}; const byClassroom:Record<string,{invited:number;responded:number}>={};
    invitations.forEach(i=>{byRole[i.role] ||= {invited:0,responded:0};byRole[i.role].invited++; if(i.classroom){byClassroom[i.classroom] ||= {invited:0,responded:0};byClassroom[i.classroom].invited++;}});
    const respondedInvites=new Set(submissions.map(s=>s.invitationToken).filter(Boolean));
    invitations.filter(i=>respondedInvites.has(i.inviteToken)).forEach(i=>{byRole[i.role].responded++; if(i.classroom) byClassroom[i.classroom].responded++;});
    return { survey,invitations,submissions,responses,invitedCount:invitations.length,responseCount:submissions.length,responseRate:invitations.length?Math.round(submissions.length/invitations.length*100):0,byRole,byClassroom };
  }

  async replaceSurveyResponses(responses: Record<string, string[]>): Promise<void> {
    const rows=Object.entries(responses).map(([questionId,answers])=>({id:questionId,questionId,answers}));
    await surveyResponseRepository.replaceAll(rows as CommunicationEntity[]); this.invalidate(); await eventBus.emit(COMMUNICATION_EVENTS.surveyResponsesChanged,{count:rows.length});
  }

  async listVoiceMessages(): Promise<VoiceMessageRecord[]> { return await voiceMessageRepository.findAll() as unknown as VoiceMessageRecord[]; }
  async saveVoiceMessage(input: Omit<VoiceMessageRecord,"id"|"timestamp"> & Partial<Pick<VoiceMessageRecord,"id"|"timestamp">>): Promise<VoiceMessageRecord> { if(!Number.isFinite(input.duration)||input.duration<0)throw new Error("Sesli mesaj süresi geçersiz."); const record:VoiceMessageRecord={id:input.id||safeId("voice"),title:String(input.title||"Sesli Mesaj").trim()||"Sesli Mesaj",duration:input.duration,timestamp:input.timestamp||new Date().toISOString(),sender:String(input.sender||"Okul Yönetimi"),status:input.status||"ready"}; await voiceMessageRepository.save(record as unknown as CommunicationEntity);this.invalidate();await eventBus.emit(COMMUNICATION_EVENTS.voiceSaved,record);return record; }
  async deleteVoiceMessage(id:string):Promise<void>{await voiceMessageRepository.delete(id);this.invalidate();await eventBus.emit(COMMUNICATION_EVENTS.voiceDeleted,{id});}
  async recordDelivery(input:Omit<MessageDeliveryRecord,"id"|"createdAt">):Promise<MessageDeliveryRecord>{const record:MessageDeliveryRecord={id:safeId("delivery"),createdAt:new Date().toISOString(),...input};await messageDeliveryRepository.save(record as unknown as CommunicationEntity);this.invalidate();await eventBus.emit(COMMUNICATION_EVENTS.deliveryRecorded,record);return record;}
  async clearCommunicationData():Promise<void>{await transactionManager.run({surveys:[],publishedSurveys:[],surveyInvitations:[],surveySubmissions:[],surveyResponses:[],voiceMessages:[],messageDeliveries:[]});this.invalidate();}
}

export const communicationService = new CommunicationService();
