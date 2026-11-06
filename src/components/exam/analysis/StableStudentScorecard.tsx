import React, { useEffect, useState } from "react";
import { Camera } from "lucide-react";

interface StableStudentScorecardProps {
  selectedStudent: any | null;
  sortedCalculatedResults: any[];
  selectedExamId: string | null;
  studentImages: Record<string, string>;
  onUploadImage: (studentNo: string, file: File) => void;
  onSelectStudent: (student: any) => void;
}

export function StableStudentScorecard({
  selectedStudent,
  sortedCalculatedResults,
  selectedExamId,
  studentImages,
  onUploadImage,
  onSelectStudent,
}: StableStudentScorecardProps) {
  const [selectedSubjectName, setSelectedSubjectName] = useState("");
  const [openStudentAnalysisModal, setOpenStudentAnalysisModal] = useState<
    "outcomes" | "lesson" | null
  >(null);
  const [studentSearchText, setStudentSearchText] = useState("");
  const [showStudentSearchResults, setShowStudentSearchResults] = useState(false);

  useEffect(() => {
    setSelectedSubjectName("");
    setOpenStudentAnalysisModal(null);
    setStudentSearchText("");
    setShowStudentSearchResults(false);
  }, [
    selectedStudent?.recordId,
    selectedStudent?.id,
    selectedStudent?.studentNumber,
  ]);

  try {
    const selectedId = String(selectedStudent?.recordId || selectedStudent?.id || "");
    const selectedNo = String(
      selectedStudent?.studentNumber ||
        selectedStudent?.schoolNumber ||
        selectedStudent?.studentNo ||
        "",
    ).trim();

    const student =
      sortedCalculatedResults.find((item: any) => {
        const itemId = String(item?.recordId || item?.id || "");
        const itemNo = String(
          item?.studentNumber || item?.schoolNumber || item?.studentNo || "",
        ).trim();

        return (
          (selectedId && itemId === selectedId) ||
          (selectedNo && itemNo === selectedNo)
        );
      }) ||
      selectedStudent ||
      sortedCalculatedResults[0] ||
      null;

    if (!student) {
      return (
        <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center font-black text-slate-500">
          Gösterilecek öğrenci kaydı bulunamadı.
        </div>
      );
    }

    const subjects = Array.isArray(student?.subjects) ? student.subjects : [];
    const identity = (item: any) =>
      String(
        item?.recordId ||
          item?.id ||
          item?.studentNumber ||
          item?.schoolNumber ||
          item?.studentNo ||
          "",
      );

    const classStudents = sortedCalculatedResults.filter(
      (item: any) =>
        String(item?.classroom || "") === String(student?.classroom || ""),
    );

    const normalizedStudentNumber = (item: any) => {
      const raw = String(
        item?.studentNumber ||
          item?.schoolNumber ||
          item?.studentNo ||
          "",
      ).trim();
      const numeric = Number(raw.replace(/\D/g, ""));
      return Number.isFinite(numeric) && raw !== "" ? numeric : Number.MAX_SAFE_INTEGER;
    };

    const navigationStudents = [...sortedCalculatedResults].sort(
      (a: any, b: any) => {
        const classCompare = String(a?.classroom || "").localeCompare(
          String(b?.classroom || ""),
          "tr-TR",
          { numeric: true, sensitivity: "base" },
        );
        if (classCompare !== 0) return classCompare;

        const numberCompare =
          normalizedStudentNumber(a) - normalizedStudentNumber(b);
        if (numberCompare !== 0) return numberCompare;

        return String(a?.studentName || "").localeCompare(
          String(b?.studentName || ""),
          "tr-TR",
          { sensitivity: "base" },
        );
      },
    );

    const currentNavigationIndex = navigationStudents.findIndex(
      (item: any) => identity(item) === identity(student),
    );

    const previousStudent =
      currentNavigationIndex > 0
        ? navigationStudents[currentNavigationIndex - 1]
        : null;

    const nextStudent =
      currentNavigationIndex >= 0 &&
      currentNavigationIndex < navigationStudents.length - 1
        ? navigationStudents[currentNavigationIndex + 1]
        : null;

    const normalizedSearchText = studentSearchText
      .trim()
      .toLocaleLowerCase("tr-TR");

    const studentSearchResults =
      normalizedSearchText.length > 0
        ? navigationStudents
            .filter((item: any) => {
              const number = String(
                item?.studentNumber ||
                  item?.schoolNumber ||
                  item?.studentNo ||
                  "",
              ).toLocaleLowerCase("tr-TR");
              const name = String(
                item?.studentName ||
                  item?.fullName ||
                  `${item?.name || ""} ${item?.surname || ""}`,
              )
                .replace(/\s+/g, " ")
                .trim()
                .toLocaleLowerCase("tr-TR");
              const classroom = String(item?.classroom || "")
                .toLocaleLowerCase("tr-TR");

              return (
                number.includes(normalizedSearchText) ||
                name.includes(normalizedSearchText) ||
                classroom.includes(normalizedSearchText)
              );
            })
            .slice(0, 12)
        : [];


    const getSubject = (item: any, subjectName: string) =>
      (Array.isArray(item?.subjects) ? item.subjects : []).find(
        (subject: any) =>
          String(subject?.subjectName || "") === String(subjectName || ""),
      );

    const getSubjectRank = (
      subjectName: string,
      scope: "class" | "school" | "general",
    ): string | number => {
      const pool = scope === "class" ? classStudents : sortedCalculatedResults;

      const ranking = pool
        .map((item: any) => ({
          id: identity(item),
          net: Number(getSubject(item, subjectName)?.net || 0),
        }))
        .sort((a: any, b: any) => b.net - a.net);

      const position = ranking.findIndex(
        (entry: any) => entry.id === identity(student),
      );

      return position >= 0 ? position + 1 : "-";
    };

    const selectedSubject =
      subjects.find(
        (subject: any) =>
          String(subject?.subjectName || "") === selectedSubjectName,
      ) ||
      subjects[0] ||
      null;

    const selectedQuestions = Array.isArray(selectedSubject?.questions)
      ? selectedSubject.questions
      : [];

    const questionKey = (question: any, index: number) =>
      String(question?.qNum || question?.questionNumber || index + 1);

    const participantQuestionRate = (
      subjectName: string,
      question: any,
      questionIndex: number,
    ) => {
      const targetKey = questionKey(question, questionIndex);
      let participantCount = 0;
      let correctCount = 0;

      sortedCalculatedResults.forEach((participant: any) => {
        const participantSubject = getSubject(participant, subjectName);
        const participantQuestions = Array.isArray(participantSubject?.questions)
          ? participantSubject.questions
          : [];

        const participantQuestion =
          participantQuestions.find(
            (entry: any, index: number) =>
              questionKey(entry, index) === targetKey,
          ) || participantQuestions[questionIndex];

        if (!participantQuestion) return;

        participantCount += 1;
        if (participantQuestion?.isCorrect === true) correctCount += 1;
      });

      return {
        participantCount,
        correctCount,
        correctRate:
          participantCount > 0
            ? Number(((correctCount / participantCount) * 100).toFixed(1))
            : 0,
      };
    };

    const selectedSubjectNameValue = String(
      selectedSubject?.subjectName || "Ders",
    );
    const selectedSubjectNet = Number(selectedSubject?.net || 0);
    const selectedSubjectQuestionCount = Number(
      selectedSubject?.totalQuestions || selectedQuestions.length || 0,
    );
    const selectedSubjectCorrect = Number(selectedSubject?.correct || 0);
    const selectedSubjectSuccess =
      selectedSubjectQuestionCount > 0
        ? Number(
            (
              (selectedSubjectCorrect / selectedSubjectQuestionCount) *
              100
            ).toFixed(1),
          )
        : 0;

    const participantSubjectNets = sortedCalculatedResults
      .map((participant: any) =>
        Number(getSubject(participant, selectedSubjectNameValue)?.net),
      )
      .filter((value: number) => Number.isFinite(value));

    const participantAverageNet =
      participantSubjectNets.length > 0
        ? Number(
            (
              participantSubjectNets.reduce(
                (sum: number, value: number) => sum + value,
                0,
              ) / participantSubjectNets.length
            ).toFixed(2),
          )
        : 0;

    const participantSubjectSuccessRates = sortedCalculatedResults
      .map((participant: any) => {
        const participantSubject = getSubject(
          participant,
          selectedSubjectNameValue,
        );
        const total = Number(
          participantSubject?.totalQuestions ||
            participantSubject?.questions?.length ||
            0,
        );
        const correct = Number(participantSubject?.correct || 0);
        return total > 0 ? (correct / total) * 100 : Number.NaN;
      })
      .filter((value: number) => Number.isFinite(value));

    const participantAverageSuccess =
      participantSubjectSuccessRates.length > 0
        ? Number(
            (
              participantSubjectSuccessRates.reduce(
                (sum: number, value: number) => sum + value,
                0,
              ) / participantSubjectSuccessRates.length
            ).toFixed(1),
          )
        : 0;

    const exceptionalCorrectQuestions = selectedQuestions
      .map((question: any, index: number) => {
        const stats = participantQuestionRate(
          selectedSubjectNameValue,
          question,
          index,
        );
        return {
          number: questionKey(question, index),
          isCorrect: question?.isCorrect === true,
          correctRate: stats.correctRate,
        };
      })
      .filter(
        (item: any) => item.isCorrect && item.correctRate <= 50,
      )
      .map((item: any) => item.number);

    const missedCommonQuestions = selectedQuestions
      .map((question: any, index: number) => {
        const stats = participantQuestionRate(
          selectedSubjectNameValue,
          question,
          index,
        );
        return {
          number: questionKey(question, index),
          isWrong:
            question?.isCorrect !== true && question?.isEmpty !== true,
          correctRate: stats.correctRate,
        };
      })
      .filter(
        (item: any) => item.isWrong && item.correctRate >= 50,
      )
      .map((item: any) => item.number);

    const comparisonText =
      selectedSubjectNet > participantAverageNet
        ? "ortalamanın üzerinde"
        : selectedSubjectNet < participantAverageNet
          ? "ortalamanın altında"
          : "ortalama ile aynı düzeyde";


    const questionFeedback = (
      question: any,
      questionIndex: number,
    ) => {
      const stats = participantQuestionRate(
        selectedSubjectNameValue,
        question,
        questionIndex,
      );

      const rate = stats.correctRate;
      const isCorrect = question?.isCorrect === true;
      const isEmpty = question?.isEmpty === true || !question?.studentAns;

      if (isEmpty) {
        if (rate >= 50) {
          return {
            result: "Tekrar İncelenmeli",
            explanation:
              "Bu sorunun çözüm yolunu yeniden incelemek, benzer sorularda daha güvenli ilerlemeyi destekleyebilir.",
          };
        }

        return {
          result: "Deneme Stratejisi Geliştirilmeli",
          explanation:
            "Genel olarak zorlayıcı olan bu soruda süre ve çözüm önceliği stratejisi üzerinde çalışmak yararlı olabilir.",
        };
      }

      if (rate >= 85) {
        return isCorrect
          ? {
              result: "Beklenen Başarı",
              explanation:
                "Bu soruda beklenen düzeyde bir başarı gösterilmiştir.",
            }
          : {
              result: "Dikkat Gerektiriyor",
              explanation:
                "Çoğu öğrencinin doğru yaptığı bu soru için konunun kısa bir tekrarının yapılması yararlı olabilir.",
            };
      }

      if (rate >= 70) {
        return isCorrect
          ? {
              result: "Başarılı",
              explanation:
                "Bu soruda başarılı bir performans sergilenmiştir.",
            }
          : {
              result: "Geliştirilmeli",
              explanation:
                "Bu soruyla ilgili kazanımın ek alıştırmalarla geliştirilmesi öğrenmeyi destekleyebilir.",
            };
      }

      if (rate >= 50) {
        return isCorrect
          ? {
              result: "İyi Performans",
              explanation:
                "Bu soruda iyi bir performans ortaya konmuştur.",
            }
          : {
              result: "Eksik Kazanım",
              explanation:
                "Bu sorunun bağlı olduğu kazanımın temel noktalarının yeniden ele alınması faydalı olabilir.",
            };
      }

      if (rate >= 30) {
        return isCorrect
          ? {
              result: "Önemli Başarı",
              explanation:
                "Birçok öğrencinin zorlandığı bu sorunun doğru cevaplanması önemli bir başarıdır.",
            }
          : {
              result: "Kritik Kazanım",
              explanation:
                "Genel olarak zorlayıcı olan bu sorunun rehberli tekrar ve aşamalı soru çözümüyle ele alınması yararlı olabilir.",
            };
      }

      if (rate >= 15) {
        return isCorrect
          ? {
              result: "Üst Düzey Başarı",
              explanation:
                "Az sayıda öğrencinin doğru yaptığı bu soruda güçlü bir performans sergilenmiştir.",
            }
          : {
              result: "Zorlayıcı Kazanım",
              explanation:
                "Bu soru genel olarak zorlayıcı olduğundan, kazanımın küçük adımlarla yeniden çalışılması destekleyici olabilir.",
            };
      }

      return isCorrect
        ? {
            result: "Seçkin Başarı",
            explanation:
              "Çok az öğrencinin doğru yaptığı bu sorunun doğru cevaplanması dikkat çekici bir başarıdır.",
          }
        : {
            result: "İleri Destek Önerilir",
            explanation:
              "Bu soru genel olarak oldukça zorlayıcı olduğundan, bireyselleştirilmiş destek ve ek çalışma yararlı olabilir.",
          };
    };


    const lessonFeedbackGroups = [
      {
        key: "Seçkin Başarı",
        title: "Güçlü Performans",
        explanation:
          "Az sayıda öğrencinin doğru yaptığı sorularda güçlü bir performans sergilenmiştir.",
        order: 1,
      },
      {
        key: "Üst Düzey Başarı",
        title: "Güçlü Performans",
        explanation:
          "Az sayıda öğrencinin doğru yaptığı sorularda güçlü bir performans sergilenmiştir.",
        order: 1,
      },
      {
        key: "Önemli Başarı",
        title: "Anlamlı Performans",
        explanation:
          "Birçok öğrencinin zorlandığı sorularda anlamlı bir başarı gösterilmiştir.",
        order: 2,
      },
      {
        key: "İyi Performans",
        title: "Başarılı Performans",
        explanation:
          "Bu sorularda genel olarak başarılı bir performans sergilenmiştir.",
        order: 3,
      },
      {
        key: "Başarılı",
        title: "Başarılı Performans",
        explanation:
          "Bu sorularda genel olarak başarılı bir performans sergilenmiştir.",
        order: 3,
      },
      {
        key: "Beklenen Başarı",
        title: "Beklenen Performans",
        explanation:
          "Çoğu öğrencinin doğru yaptığı sorularda beklenen düzeyde başarı gösterilmiştir.",
        order: 4,
      },
      {
        key: "Tekrar İncelenmeli",
        title: "Kritik Düzey",
        explanation:
          "Bu soruların bağlı olduğu kazanımların temel noktalarının yeniden ele alınması faydalı olabilir.",
        order: 5,
      },
      {
        key: "Eksik Kazanım",
        title: "Kritik Düzey",
        explanation:
          "Bu soruların bağlı olduğu kazanımların temel noktalarının yeniden ele alınması faydalı olabilir.",
        order: 5,
      },
      {
        key: "Dikkat Gerektiriyor",
        title: "Kritik Düzey",
        explanation:
          "Bu soruların bağlı olduğu kazanımların temel noktalarının yeniden ele alınması faydalı olabilir.",
        order: 5,
      },
      {
        key: "Geliştirilmeli",
        title: "Geliştirilmeli",
        explanation:
          "Genel olarak zorlayıcı bu soruların rehberli tekrar ve aşamalı çözümle ele alınması yararlı olabilir.",
        order: 6,
      },
      {
        key: "Kritik Kazanım",
        title: "Geliştirilmeli",
        explanation:
          "Genel olarak zorlayıcı bu soruların rehberli tekrar ve aşamalı çözümle ele alınması yararlı olabilir.",
        order: 6,
      },
      {
        key: "Zorlayıcı Kazanım",
        title: "Geliştirilmeli",
        explanation:
          "Genel olarak zorlayıcı bu soruların rehberli tekrar ve aşamalı çözümle ele alınması yararlı olabilir.",
        order: 6,
      },
      {
        key: "İleri Destek Önerilir",
        title: "Geliştirilmeli",
        explanation:
          "Genel olarak zorlayıcı bu soruların rehberli tekrar ve aşamalı çözümle ele alınması yararlı olabilir.",
        order: 6,
      },
      {
        key: "Deneme Stratejisi Geliştirilmeli",
        title: "Geliştirilmeli",
        explanation:
          "Genel olarak zorlayıcı bu soruların rehberli tekrar ve aşamalı çözümle ele alınması yararlı olabilir.",
        order: 6,
      },
    ]
      .map((group) => {
        const questions = selectedQuestions
          .map((question: any, questionIndex: number) => {
            const stats = participantQuestionRate(
              selectedSubjectNameValue,
              question,
              questionIndex,
            );
            const feedback = questionFeedback(question, questionIndex);

            return {
              number: questionKey(question, questionIndex),
              rate: stats.correctRate,
              result: feedback.result,
            };
          })
          .filter((item: any) => item.result === group.key);

        return {
          ...group,
          questions,
        };
      })
      .filter((group) => group.questions.length > 0)
      .reduce((groups: any[], current) => {
        const existing = groups.find(
          (group) => group.title === current.title,
        );

        if (existing) {
          existing.questions = [
            ...existing.questions,
            ...current.questions,
          ].sort(
            (a: any, b: any) =>
              Number(a.number) - Number(b.number),
          );
          return groups;
        }

        groups.push({
          title: current.title,
          explanation: current.explanation,
          order: current.order,
          questions: [...current.questions].sort(
            (a: any, b: any) =>
              Number(a.number) - Number(b.number),
          ),
        });

        return groups;
      }, [])
      .sort((a: any, b: any) => a.order - b.order);


    const outcomeAnalysisGroups = (() => {
      const outcomeMap = new Map<string, Array<{
        questionNumber: string;
        rate: number;
        isCorrect: boolean;
        isEmpty: boolean;
      }>>();

      selectedQuestions.forEach((question: any, questionIndex: number) => {
        const stats = participantQuestionRate(
          selectedSubjectNameValue,
          question,
          questionIndex,
        );

        const outcomeName = String(
          question?.outcome ||
            question?.learningOutcome ||
            question?.acquisition ||
            question?.kazanim ||
            question?.topic ||
            question?.subjectOutcome ||
            "Kazanım bilgisi bulunamadı",
        ).trim();

        const current = outcomeMap.get(outcomeName) || [];
        current.push({
          questionNumber: questionKey(question, questionIndex),
          rate: stats.correctRate,
          isCorrect: question?.isCorrect === true,
          isEmpty: question?.isEmpty === true || !question?.studentAns,
        });
        outcomeMap.set(outcomeName, current);
      });

      const classifyOutcome = (
        averageRate: number,
        correctCount: number,
        wrongCount: number,
        emptyCount: number,
      ) => {
        const answeredCount = correctCount + wrongCount;
        const isMostlyCorrect =
          answeredCount > 0 && correctCount >= wrongCount;
        const isMostlyEmpty =
          emptyCount > correctCount && emptyCount > wrongCount;

        if (isMostlyEmpty) {
          return averageRate >= 50
            ? {
                title: "Kritik Düzey",
                explanation:
                  "Bu kazanıma ait soruların çözüm yollarının yeniden incelenmesi yararlı olabilir.",
              }
            : {
                title: "Geliştirilmeli",
                explanation:
                  "Bu kazanıma ait sorular genel olarak zorlayıcı olduğundan süre ve çözüm önceliği stratejisi üzerinde çalışılması yararlı olabilir.",
              };
        }

        if (averageRate < 15) {
          return isMostlyCorrect
            ? {
                title: "Güçlü Performans",
                explanation:
                  "Az sayıda öğrencinin doğru yaptığı bu kazanım sorularında güçlü bir performans sergilenmiştir.",
              }
            : {
                title: "Geliştirilmeli",
                explanation:
                  "Bu kazanıma ait sorular genel olarak oldukça zorlayıcı olduğundan bireyselleştirilmiş destek ve ek çalışma yararlı olabilir.",
              };
        }

        if (averageRate < 30) {
          return isMostlyCorrect
            ? {
                title: "Güçlü Performans",
                explanation:
                  "Az sayıda öğrencinin doğru yaptığı bu kazanım sorularında güçlü bir performans sergilenmiştir.",
              }
            : {
                title: "Geliştirilmeli",
                explanation:
                  "Bu kazanıma ait sorular genel olarak zorlayıcı olduğundan küçük adımlarla yeniden çalışılması destekleyici olabilir.",
              };
        }

        if (averageRate < 50) {
          return isMostlyCorrect
            ? {
                title: "Anlamlı Performans",
                explanation:
                  "Birçok öğrencinin zorlandığı bu kazanım sorularında anlamlı bir başarı gösterilmiştir.",
              }
            : {
                title: "Geliştirilmeli",
                explanation:
                  "Bu kazanıma ait soruların rehberli tekrar ve aşamalı çözümle ele alınması yararlı olabilir.",
              };
        }

        if (averageRate < 70) {
          return isMostlyCorrect
            ? {
                title: "Başarılı Performans",
                explanation:
                  "Bu kazanıma ait sorularda genel olarak başarılı bir performans sergilenmiştir.",
              }
            : {
                title: "Kritik Düzey",
                explanation:
                  "Bu kazanımın temel noktalarının yeniden ele alınması faydalı olabilir.",
              };
        }

        if (averageRate < 85) {
          return isMostlyCorrect
            ? {
                title: "Başarılı Performans",
                explanation:
                  "Bu kazanıma ait sorularda genel olarak başarılı bir performans sergilenmiştir.",
              }
            : {
                title: "Kritik Düzey",
                explanation:
                  "Bu kazanımın ek alıştırmalarla geliştirilmesi öğrenmeyi destekleyebilir.",
              };
        }

        return isMostlyCorrect
          ? {
              title: "Beklenen Performans",
              explanation:
                "Çoğu öğrencinin doğru yaptığı bu kazanım sorularında beklenen düzeyde başarı gösterilmiştir.",
            }
          : {
              title: "Kritik Düzey",
              explanation:
                "Çoğu öğrencinin doğru yaptığı bu kazanım soruları için kısa bir tekrar yapılması yararlı olabilir.",
            };
      };

      const order: Record<string, number> = {
        "Güçlü Performans": 1,
        "Anlamlı Performans": 2,
        "Başarılı Performans": 3,
        "Beklenen Performans": 4,
        "Kritik Düzey": 5,
        "Geliştirilmeli": 6,
      };

      return Array.from(outcomeMap.entries())
        .map(([outcomeName, questions]) => {
          const averageRate =
            questions.length > 0
              ? Number(
                  (
                    questions.reduce(
                      (sum: number, item: any) =>
                        sum + Number(item.rate || 0),
                      0,
                    ) / questions.length
                  ).toFixed(1),
                )
              : 0;

          const correctCount = questions.filter(
            (item) => item.isCorrect,
          ).length;
          const emptyCount = questions.filter(
            (item) => item.isEmpty,
          ).length;
          const wrongCount =
            questions.length - correctCount - emptyCount;

          const evaluation = classifyOutcome(
            averageRate,
            correctCount,
            wrongCount,
            emptyCount,
          );

          return {
            outcomeName,
            questions,
            averageRate,
            correctCount,
            wrongCount,
            emptyCount,
            title: evaluation.title,
            explanation: evaluation.explanation,
          };
        })
        .sort((a, b) => {
          const titleOrder =
            (order[a.title] || 99) - (order[b.title] || 99);
          return titleOrder !== 0
            ? titleOrder
            : b.averageRate - a.averageRate;
        });
    })();

    const imageKey = `${selectedExamId || ""}_${student?.studentNumber || ""}`;
    const image = studentImages[imageKey];

    return (
      <div className="space-y-5">
        <div className="order-2 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="relative rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm">
            <button
              type="button"
              onClick={() => previousStudent && onSelectStudent(previousStudent)}
              disabled={!previousStudent}
              className="absolute left-2 top-1/2 flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-slate-200 bg-white/85 text-2xl font-black text-slate-400 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-20"
              title={
                previousStudent
                  ? `Önceki öğrenci: ${previousStudent?.studentNumber || ""} ${previousStudent?.studentName || ""}`
                  : "İlk öğrenci"
              }
            >
              ‹
            </button>

            <button
              type="button"
              onClick={() => nextStudent && onSelectStudent(nextStudent)}
              disabled={!nextStudent}
              className="absolute right-2 top-1/2 flex h-10 w-8 -translate-y-1/2 items-center justify-center rounded-xl border border-slate-200 bg-white/85 text-2xl font-black text-slate-400 shadow-sm transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-20"
              title={
                nextStudent
                  ? `Sonraki öğrenci: ${nextStudent?.studentNumber || ""} ${nextStudent?.studentName || ""}`
                  : "Son öğrenci"
              }
            >
              ›
            </button>

            <div className="px-7">
              <div className="relative mx-auto mb-3 h-24 w-24">
                {image ? (
                  <img
                    src={image}
                    alt={student?.studentName || "Öğrenci"}
                    className="h-24 w-24 rounded-full border-4 border-slate-100 object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-slate-100 bg-orange-100 text-3xl font-black text-orange-700">
                    {String(student?.studentName || "Ö")
                      .charAt(0)
                      .toLocaleUpperCase("tr-TR")}
                  </div>
                )}

                <label className="absolute bottom-0 right-0 flex cursor-pointer items-center justify-center rounded-full border-2 border-white bg-slate-800 p-1.5 text-white shadow-md">
                  <Camera className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        onUploadImage(
                          String(student?.studentNumber || ""),
                          file,
                        );
                      }
                    }}
                  />
                </label>
              </div>

              <h3 className="text-base font-black text-slate-900">
                {student?.studentName || "İsimsiz Öğrenci"}
              </h3>
              <p className="mt-1 text-xs font-bold text-slate-500">
                No: {student?.studentNumber || "-"} •{" "}
                {student?.classroom || "Sınıf yok"}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                Kitapçık: {student?.bookletType || "-"}
              </p>

              <div className="relative mx-auto mt-4 max-w-[280px]">
                <input
                  type="text"
                  value={studentSearchText}
                  onChange={(event) => {
                    setStudentSearchText(event.target.value);
                    setShowStudentSearchResults(true);
                  }}
                  onFocus={() => setShowStudentSearchResults(true)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      studentSearchResults.length > 0
                    ) {
                      onSelectStudent(studentSearchResults[0]);
                    }
                  }}
                  placeholder="Numara veya ad soyad ara..."
                  className="w-full rounded-xl border-2 border-orange-300 bg-white px-4 py-3 pr-9 text-sm font-black text-slate-900 shadow-md outline-none transition placeholder:font-bold placeholder:text-slate-500 hover:border-orange-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100"
                />

                {studentSearchText && (
                  <button
                    type="button"
                    onClick={() => {
                      setStudentSearchText("");
                      setShowStudentSearchResults(false);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 hover:text-slate-700"
                    title="Aramayı temizle"
                  >
                    ✕
                  </button>
                )}

                {showStudentSearchResults &&
                  studentSearchText.trim().length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1.5 text-left shadow-xl">
                      {studentSearchResults.map((result: any) => (
                        <button
                          key={identity(result)}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => onSelectStudent(result)}
                          className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition last:border-b-0 hover:bg-orange-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-black text-slate-900">
                              {result?.studentNumber || "-"} ·{" "}
                              {result?.studentName || "İsimsiz Öğrenci"}
                            </span>
                            <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">
                              {result?.classroom || "Sınıf yok"}
                            </span>
                          </span>
                        </button>
                      ))}

                      {studentSearchResults.length === 0 && (
                        <div className="px-3 py-4 text-center text-xs font-bold text-slate-400">
                          Öğrenci bulunamadı.
                        </div>
                      )}
                    </div>
                  )}
              </div>

              <p className="mt-2 text-[9px] font-semibold text-slate-400">
                {currentNavigationIndex >= 0
                  ? `${currentNavigationIndex + 1} / ${navigationStudents.length}`
                  : `${navigationStudents.length} öğrenci`}
              </p>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
            <div className="border-b border-slate-200 px-5 py-4 text-center">
              <h3 className="w-full text-center text-sm font-black text-slate-900">
                Ders Bazlı Öğrenci Karnesi
              </h3>
            </div>

            <div className="overflow-hidden">
              <table className="w-full table-fixed border-collapse text-[11px]">
                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2 text-left w-[18%]">Ders</th>
                    <th className="px-1.5 py-2 text-center w-[7%]">Soru</th>
                    <th className="px-1.5 py-2 text-center w-[7%]">Doğru</th>
                    <th className="px-1.5 py-2 text-center w-[7%]">Yanlış</th>
                    <th className="px-1.5 py-2 text-center w-[6%]">Boş</th>
                    <th className="px-1.5 py-2 text-center w-[7%]">Net</th>
                    <th className="px-1.5 py-2 text-center w-[8%]">Başarı</th>
                    <th className="px-1.5 py-2 text-center w-[8%]">
                      Sınıf
                    </th>
                    <th className="px-1.5 py-2 text-center w-[8%]">
                      Okul
                    </th>
                    <th className="px-1.5 py-2 text-center w-[8%]">
                      Genel
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {subjects.map((subject: any, index: number) => {
                    const subjectName = String(
                      subject?.subjectName || "Ders",
                    );
                    const questionCount = Number(
                      subject?.totalQuestions ||
                        subject?.questions?.length ||
                        0,
                    );
                    const correct = Number(subject?.correct || 0);
                    const rate =
                      questionCount > 0
                        ? Number(
                            ((correct / questionCount) * 100).toFixed(1),
                          )
                        : 0;
                    const isSelected =
                      subjectName === selectedSubjectNameValue;

                    const generalRank =
                      Number(
                        subject?.generalRank ||
                          subject?.countryRank ||
                          0,
                      ) > 0
                        ? Number(
                            subject?.generalRank ||
                              subject?.countryRank,
                          )
                        : getSubjectRank(subjectName, "general");

                    return (
                      <tr
                        key={`${subjectName}-${index}`}
                        onClick={() => {
                          setSelectedSubjectName(subjectName);
                          setOpenStudentAnalysisModal(null);
                        }}
                        className={`cursor-pointer transition ${
                          isSelected
                            ? "bg-orange-50 ring-1 ring-inset ring-orange-200"
                            : "hover:bg-slate-50"
                        }`}
                        title={`${subjectName} soru bazlı analizini göster`}
                      >
                        <td className="px-2 py-2 font-black text-slate-800">
                          <span className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isSelected
                                  ? "bg-orange-600"
                                  : "bg-slate-300"
                              }`}
                            />
                            {subjectName}
                          </span>
                        </td>
                        <td className="px-1.5 py-2 text-center">
                          {questionCount}
                        </td>
                        <td className="px-1.5 py-2 text-center font-bold text-emerald-700">
                          {correct}
                        </td>
                        <td className="px-1.5 py-2 text-center font-bold text-rose-700">
                          {Number(subject?.wrong || 0)}
                        </td>
                        <td className="px-1.5 py-2 text-center">
                          {Number(subject?.empty || 0)}
                        </td>
                        <td className="px-1.5 py-2 text-center font-black text-orange-700">
                          {Number(subject?.net || 0)}
                        </td>
                        <td className="px-1.5 py-2 text-center font-black">
                          %{rate}
                        </td>
                        <td className="px-1.5 py-2 text-center font-black text-red-700">
                          {getSubjectRank(subjectName, "class")}
                        </td>
                        <td className="px-1.5 py-2 text-center font-black text-red-700">
                          {getSubjectRank(subjectName, "school")}
                        </td>
                        <td className="px-1.5 py-2 text-center font-black text-red-700">
                          {generalRank}
                        </td>
                      </tr>
                    );
                  })}

                  {subjects.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-8 text-center font-bold text-slate-400"
                      >
                        Ders analizi bulunamadı.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {selectedSubject && (
          <>
            <section className="order-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <h3 className="text-sm font-black text-slate-900">
                  {selectedSubjectNameValue} - Öğrencinin Cevapları
                </h3>
                <span className="text-[10px] font-bold text-slate-500">
                  {selectedQuestions.length} soru
                </span>
              </div>

              <div className="overflow-x-auto pb-2">
                <div className="grid min-w-[860px] grid-cols-[repeat(20,minmax(38px,1fr))] gap-1.5">
                  {selectedQuestions.map(
                    (question: any, questionIndex: number) => {
                      const stats = participantQuestionRate(
                        selectedSubjectNameValue,
                        question,
                        questionIndex,
                      );

                      return (
                        <div
                          key={`${questionKey(
                            question,
                            questionIndex,
                          )}-${questionIndex}`}
                          className={`flex h-12 min-w-[38px] flex-col items-center justify-center rounded-lg border px-1 ${
                            question?.isEmpty
                              ? "border-slate-300 bg-white text-black"
                              : question?.isCorrect
                                ? "border-emerald-600 bg-emerald-500"
                                : "border-rose-600 bg-rose-500"
                          }`}
                          title={`Öğrenci: ${
                            question?.studentAns || "Boş"
                          } | Doğru: ${
                            question?.correctAns || "-"
                          } | Katılımcı doğru oranı: %${
                            stats.correctRate
                          }`}
                        >
                          <span
                            className={`text-[8px] font-black ${
                              question?.isEmpty ? "text-black" : "text-white"
                            }`}
                          >
                            {questionKey(question, questionIndex)}
                          </span>
                          <div className="flex items-center justify-center gap-1 leading-none">
                            <span
                              className={`text-[11px] font-black ${
                                question?.isEmpty ? "text-black" : "text-white"
                              }`}
                              title="Cevap anahtarı"
                            >
                              {question?.correctAns || "-"}
                            </span>
                            <span
                              className="text-[14px] font-black text-black"
                              title="Öğrenci cevabı"
                            >
                              {question?.studentAns || "-"}
                            </span>
                          </div>
                          <span
                            className={`text-[7px] font-bold opacity-80 ${
                              question?.isEmpty ? "text-black" : "text-white"
                            }`}
                          >
                            %{stats.correctRate}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </section>

            <div className="order-4 grid w-full grid-cols-1 gap-3 lg:grid-cols-2">
              <button
                type="button"
                onClick={() => setOpenStudentAnalysisModal("lesson")}
                className="w-full rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-black text-blue-800 transition hover:bg-blue-100 hover:shadow-md"
              >
                {selectedSubjectNameValue} - Soru Bazlı Cevap Analizi
              </button>

              <button
                type="button"
                onClick={() => setOpenStudentAnalysisModal("outcomes")}
                className="w-full rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-center text-sm font-black text-violet-800 transition hover:bg-violet-100 hover:shadow-md"
              >
                {selectedSubjectNameValue} - Kazanım Bazlı Cevap Analizi
              </button>
            </div>

            {openStudentAnalysisModal && (
              <div
                className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
                onClick={() => setOpenStudentAnalysisModal(null)}
              >
                <div
                  className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
                  onClick={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setOpenStudentAnalysisModal(null)}
                    className={`flex w-full items-center justify-between gap-3 border-b px-5 py-4 text-left transition ${
                      openStudentAnalysisModal === "outcomes"
                        ? "bg-violet-50 text-violet-900 hover:bg-violet-100"
                        : "bg-blue-50 text-blue-900 hover:bg-blue-100"
                    }`}
                  >
                    <span className="text-sm font-black">
                      {openStudentAnalysisModal === "outcomes"
                        ? `${selectedSubjectNameValue} - Kazanım Bazlı Cevap Analizi`
                        : `${selectedSubjectNameValue} - Soru Bazlı Cevap Analizi`}
                    </span>
                    <span className="text-lg font-black">✕</span>
                  </button>

                  <div className="min-h-0 overflow-y-auto p-5">
                    {openStudentAnalysisModal === "outcomes" ? (
                      <div className="space-y-4">
                        {outcomeAnalysisGroups.map((group, index) => (
                          <section
                            key={`${group.outcomeName}-${index}`}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <h4 className="text-sm font-black text-slate-900">
                                  {group.outcomeName}
                                </h4>
                                <p className="mt-1 text-xs font-black text-violet-700">
                                  {group.title}
                                </p>
                                <p className="mt-1 text-xs font-semibold italic leading-5 text-slate-500">
                                  ({group.explanation})
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-black">
                                  <span className="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-700">
                                    Doğru: {group.correctCount}
                                  </span>
                                  <span className="rounded-lg bg-rose-100 px-2 py-1 text-rose-700">
                                    Yanlış: {group.wrongCount}
                                  </span>
                                  <span className="rounded-lg bg-slate-200 px-2 py-1 text-slate-700">
                                    Boş: {group.emptyCount}
                                  </span>
                                </div>
                              </div>

                              <span className="rounded-xl bg-white px-3 py-2 text-xs font-black text-violet-700 shadow-sm">
                                Ortalama başarı: %{group.averageRate}
                              </span>
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {group.questions.map((question, qIndex) => (
                                <span
                                  key={`${group.outcomeName}-${question.questionNumber}-${qIndex}`}
                                  className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm"
                                >
                                  <strong className="mr-1 text-slate-900">
                                    {question.questionNumber}
                                  </strong>
                                  <span>(%{question.rate})</span>
                                </span>
                              ))}
                            </div>
                          </section>
                        ))}

                        {outcomeAnalysisGroups.length === 0 && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs font-bold text-slate-500">
                            Bu ders için kazanım bilgisi bulunamadı.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {lessonFeedbackGroups.map((group) => (
                          <section
                            key={group.key}
                            className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                          >
                            <h5 className="text-sm font-black text-slate-900">
                              {group.title}
                            </h5>
                            <p className="mt-1 text-xs font-semibold italic text-slate-500">
                              ({group.explanation})
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {group.questions.map(
                                (question: any, index: number) => (
                                  <span
                                    key={`${group.key}-${question.number}-${index}`}
                                    className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm"
                                  >
                                    <strong className="mr-1 text-slate-900">
                                      {question.number}
                                    </strong>
                                    <span>(%{question.rate})</span>
                                  </span>
                                ),
                              )}
                            </div>
                          </section>
                        ))}

                        {lessonFeedbackGroups.length === 0 && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-xs font-bold text-slate-500">
                            Bu ders için soru bazlı değerlendirme verisi bulunamadı.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  } catch (error) {
    console.error("Öğrenci Karnesi render hatası:", error);

    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <h3 className="font-black">
          Öğrenci Karnesi görüntülenemedi
        </h3>
        <p className="mt-2 text-xs font-semibold">
          Öğrenci verilerinde beklenmeyen bir eksiklik bulundu. Sınav
          Analiz ekranı açık kalmaya devam edecektir.
        </p>
      </div>
    );
  }
}
