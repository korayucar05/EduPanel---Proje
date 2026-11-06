import { evaluateExamRecords, type ExamStudentResult } from './ExamPipelineService';
import { examIntegrityService } from './ExamIntegrityService';

export interface RankedExamStudentResult extends ExamStudentResult {
  institutionRank: number;
  classroomRank: number;
  subjectRanks: Record<string, { institutionRank: number; classroomRank: number }>;
}

const identity = (r: any) => String(r?.studentNumber || r?.recordId || r?.studentName || '').trim().toLocaleLowerCase('tr-TR');
const netOf = (r: any) => Number(r?.totals?.net || 0);
const subjectNet = (r: any, subjectName: string) => Number((r?.subjects || []).find((s: any) => s.subjectName === subjectName)?.net || 0);

export class ExamAnalysisService {
  getStoredResults(exam: any): ExamStudentResult[] {
    if (!exam || !Array.isArray(exam.evaluationResults)) return [];
    return exam.evaluationResults;
  }

  requireStoredResults(exam: any): ExamStudentResult[] {
    // Rapor ekranı eski/eksik optik kayıt yüzünden tamamen kapanmamalıdır.
    // Bütünlük raporu tanı amacıyla üretilir; kayıtlı evaluationResults varsa güvenli şekilde gösterilir.
    examIntegrityService.check(exam, 'report');
    const results = this.getStoredResults(exam);
    if (results.length) return results;

    // Eski e-Nstitü sınavlarında evaluationResults alanı olmayabilir. Rapor ekranı,
    // ham optik kayıtları değiştirmeden aynı deterministik değerlendirme motoruyla
    // sonuçları yalnızca bellekte yeniden üretir. Bu bir DB migration/yazma işlemi değildir.
    if (Array.isArray(exam?.studentTxtRecords) && exam.studentTxtRecords.length) {
      return evaluateExamRecords(exam);
    }
    return [];
  }

  filterByAllowedKeys(results: ExamStudentResult[], allowedKeys: Set<string> | null): ExamStudentResult[] {
    if (!allowedKeys) return results;
    return results.filter((record: any) => {
      const candidates = [record?.recordId, record?.studentNumber, record?.studentName]
        .map((v) => String(v ?? '').trim().toLocaleLowerCase('tr-TR'))
        .filter(Boolean);
      return candidates.some((v) => allowedKeys.has(v));
    });
  }

  rank(results: ExamStudentResult[]): RankedExamStudentResult[] {
    const institution = [...results].sort((a, b) => netOf(b) - netOf(a));
    const subjectNames = Array.from(new Set(results.flatMap((r) => (r.subjects || []).map((s) => s.subjectName))));
    const institutionRank = new Map(institution.map((r, i) => [identity(r), i + 1]));
    const classGroups = new Map<string, ExamStudentResult[]>();
    results.forEach((r) => {
      const key = String(r.classroom || 'Sınıfsız');
      classGroups.set(key, [...(classGroups.get(key) || []), r]);
    });
    const classRankMaps = new Map<string, Map<string, number>>();
    classGroups.forEach((items, classroom) => {
      classRankMaps.set(classroom, new Map([...items].sort((a,b)=>netOf(b)-netOf(a)).map((r,i)=>[identity(r),i+1])));
    });

    // Ders sıralamaları eskiden her öğrenci için tekrar tekrar sort/findIndex ile
    // hesaplanıyordu. Aynı sonucu koruyup her ders/sınıf için yalnız bir kez
    // hesaplayarak Sınav Analiz ve Sınav Raporları açılışını ciddi biçimde hızlandır.
    const subjectInstitutionRanks = new Map<string, Map<string, number>>();
    const subjectClassRanks = new Map<string, Map<string, Map<string, number>>>();

    subjectNames.forEach((subjectName) => {
      const institutionRows = [...results].sort((a,b)=>subjectNet(b, subjectName)-subjectNet(a, subjectName));
      const institutionMap = new Map<string, number>();
      institutionRows.forEach((row, index) => {
        const key = identity(row);
        if (!institutionMap.has(key)) institutionMap.set(key, index + 1);
      });
      subjectInstitutionRanks.set(subjectName, institutionMap);

      const classMaps = new Map<string, Map<string, number>>();
      classGroups.forEach((items, classroom) => {
        const sorted = [...items].sort((a,b)=>subjectNet(b, subjectName)-subjectNet(a, subjectName));
        const rankMap = new Map<string, number>();
        sorted.forEach((row, index) => {
          const key = identity(row);
          if (!rankMap.has(key)) rankMap.set(key, index + 1);
        });
        classMaps.set(classroom, rankMap);
      });
      subjectClassRanks.set(subjectName, classMaps);
    });

    return results.map((r) => {
      const classroom = String(r.classroom || 'Sınıfsız');
      const rowIdentity = identity(r);
      const subjectRanks: RankedExamStudentResult['subjectRanks'] = {};
      subjectNames.forEach((subjectName) => {
        subjectRanks[subjectName] = {
          institutionRank: subjectInstitutionRanks.get(subjectName)?.get(rowIdentity) || 0,
          classroomRank: subjectClassRanks.get(subjectName)?.get(classroom)?.get(rowIdentity) || 0,
        };
      });
      return {
        ...r,
        institutionRank: institutionRank.get(rowIdentity) || 0,
        classroomRank: classRankMaps.get(classroom)?.get(rowIdentity) || 0,
        subjectRanks,
      };
    });
  }

  resultsForExam(exam: any, allowedKeys: Set<string> | null = null): RankedExamStudentResult[] {
    return this.rank(this.filterByAllowedKeys(this.requireStoredResults(exam), allowedKeys));
  }
}

export const examAnalysisService = new ExamAnalysisService();
