import { SqliteRepository } from "../../core/repository";

export type CommunicationEntity = { id: string; [key: string]: unknown };

export class CommunicationRepository<T extends CommunicationEntity> extends SqliteRepository<T> {}

export const surveyRepository = new CommunicationRepository<CommunicationEntity>("surveys");
export const publishedSurveyRepository = new CommunicationRepository<CommunicationEntity>("publishedSurveys");
export const surveyInvitationRepository = new CommunicationRepository<CommunicationEntity>("surveyInvitations");
export const surveySubmissionRepository = new CommunicationRepository<CommunicationEntity>("surveySubmissions");
export const surveyResponseRepository = new CommunicationRepository<CommunicationEntity>("surveyResponses");
export const voiceMessageRepository = new CommunicationRepository<CommunicationEntity>("voiceMessages");
export const messageDeliveryRepository = new CommunicationRepository<CommunicationEntity>("messageDeliveries");
