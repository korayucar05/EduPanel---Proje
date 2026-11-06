export function cleanPhone(phone: string) {
  if (!phone) return "";
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) clean = "90" + clean.substring(1);
  if (!clean.startsWith("90") && clean.length === 10) clean = "90" + clean;
  return clean;
}

export const generateStudentSpeechText = (student: any, allStudents: any[]) => {
  if (!student) return "";
  const name = student.studentName || "Değerli Öğrencimiz";
  const num = student.studentNumber ? `${student.studentNumber} numaralı` : "";
  const cls = student.classroom ? `${student.classroom} sınıfı öğrencisi` : "öğrencimiz";
  
  const correct = student.totals?.correct ?? 0;
  const wrong = student.totals?.wrong ?? 0;
  const empty = student.totals?.empty ?? 0;
  const net = student.totals?.net ?? 0;
  
  // Calculate overall exam success percentage
  const totalQuestionsInExam = (student.subjects || []).reduce((sum: number, sh: any) => sum + sh.totalQuestions, 0);
  const overallSuccessRate = totalQuestionsInExam > 0 ? Number(((correct / totalQuestionsInExam) * 100).toFixed(1)) : 0;

  // Calculate rankings for the active student overall
  const classStudents = allStudents ? allStudents.filter(s => s.classroom === student.classroom) : [student];
  const classRank = classStudents.findIndex(s => s.recordId === student.recordId) + 1;
  const classMevcut = classStudents.length;

  const globalRank = allStudents ? allStudents.findIndex(s => s.recordId === student.recordId) + 1 : 1;
  const globalMevcut = allStudents ? allStudents.length : 1;

  let text = `Merhaba ${name}. `;
  if (num) {
    text += `${num} numaralı `;
  }
  text += `${cls} olarak katıldığın deneme sınavı sonuçların detaylı olarak analiz edildi. `;
  text += `Sınav genelinde, toplam ${totalQuestionsInExam} sorudan ${correct} doğru, ${wrong} yanlış ve ${empty} boş bırakarak ${net.toFixed(2)} net elde ettin. Sınav genelindeki başarı yüzden %${overallSuccessRate.toFixed(1)} olarak gerçekleşti. `;
  text += `Bu sonuçla, sınıfındaki ${classMevcut} öğrenci arasından ${classRank || "1"}. sırada; okul genelinde ise ${globalMevcut} öğrenci arasından ${globalRank || "1"}. sırada yer almaktasın.\n\n`;
  
  const subjects = student.subjects || [];
  if (subjects.length > 0) {
    text += `Her bir ders bazındaki detaylı başarı, net ve sıralama analizlerin şu şekildedir:\n\n`;
    
    subjects.forEach((sh: any) => {
      const subjectName = sh.subjectName;
      const successRate = sh.totalQuestions > 0 ? Number(((sh.correct / sh.totalQuestions) * 100).toFixed(1)) : 0;
      const sNet = sh.net || 0;
      
      // Class Rank for this subject
      const sortedBySubjectClass = [...classStudents].sort((a, b) => {
        const subA = a.subjects?.find((sk: any) => sk.subjectName === subjectName)?.net || 0;
        const subB = b.subjects?.find((sk: any) => sk.subjectName === subjectName)?.net || 0;
        return subB - subA;
      });
      const classRankSubject = sortedBySubjectClass.findIndex(s => s.recordId === student.recordId) + 1;
      const classMevcutSubject = sortedBySubjectClass.length;

      // Kurum Rank for this subject
      const sortedBySubjectKurum = allStudents ? [...allStudents].sort((a, b) => {
        const subA = a.subjects?.find((sk: any) => sk.subjectName === subjectName)?.net || 0;
        const subB = b.subjects?.find((sk: any) => sk.subjectName === subjectName)?.net || 0;
        return subB - subA;
      }) : [student];
      const kurumRankSubject = sortedBySubjectKurum.findIndex(s => s.recordId === student.recordId) + 1;
      const kurumMevcutSubject = sortedBySubjectKurum.length;

      // Class average net
      let classSumNet = 0;
      let classCount = 0;
      classStudents.forEach((cs) => {
        const subCS = cs.subjects?.find((sk: any) => sk.subjectName === subjectName);
        if (subCS) {
          classSumNet += subCS.net;
          classCount++;
        }
      });
      const classAvgNet = classCount > 0 ? Number((classSumNet / classCount).toFixed(2)) : 0;
      const statusText = sNet > classAvgNet ? "sınıf ortalamasının üzerinde" : sNet < classAvgNet ? "sınıf ortalamasının altında" : "sınıf ortalamasıyla aynı seviyede";

      text += `👉 ${subjectName} dersinde:\n`;
      text += `• Soru Dağılımı: ${sh.correct} doğru, ${sh.wrong} yanlış, ${sh.empty} boş\n`;
      text += `• Net ve Başarı: ${sNet.toFixed(2)} net ile %${successRate.toFixed(1)} başarı oranı\n`;
      text += `• Sınıf Derecesi: ${classMevcutSubject} öğrenci arasından ${classRankSubject || "1"}. sırada (${statusText})\n`;
      text += `• Okul Derecesi: ${kurumMevcutSubject} öğrenci arasından ${kurumRankSubject || "1"}. sırada\n\n`;
    });
  }
  
  text += `Analizler doğrultusunda eksik kaldığın konu kazanımlarına yoğunlaşarak ve düzenli tekrarlar yaparak başarılarını daha da ileriye taşıyacağına inanıyorum. Çalışmalarında üstün başarılar dilerim!`;
  return text;
};

export const generateLessonSpeechText = (subjectName: string, questions: any[], averages: any[]) => {
  if (!subjectName) return "";
  const avgData = averages.find(s => s.name === subjectName);
  const netAvg = avgData ? avgData.OrtalamaNet : 0;
  const correctAvg = avgData ? avgData.Doğru : 0;
  const wrongAvg = avgData ? avgData.Yanlış : 0;
  
  let text = `${subjectName} dersi ve sınav analiz dökümüne hoş geldiniz. `;
  text += `Yapılan genel değerlendirmeye göre, sınav kapsamında ${subjectName} testi genel ortalaması tam olarak ${netAvg} net, `;
  text += `ortalama doğru sayısı ${correctAvg} ve ortalama yanlış sayısı ${wrongAvg} olarak hesaplanmıştır. `;
  
  // Find hardest and easiest question/topic
  if (questions && questions.length > 0) {
    const sortedQuestions = [...questions].sort((a: any, b: any) => b.BaşarıYüzdesi - a.BaşarıYüzdesi);
    const easiestQ = sortedQuestions[0];
    const hardestQ = sortedQuestions[sortedQuestions.length - 1];
    
    if (easiestQ) {
      text += `Öğrencilerin en çok doğru yaptığı ve en yüksek başarı oranı gösterdiği konu, yüzde ${easiestQ.BaşarıYüzdesi.toFixed(0)} başarı ile "${easiestQ.topic}" konusudur. `;
    }
    if (hardestQ && hardestQ.BaşarıYüzdesi < 50) {
      text += `Buna karşın, sınıf genelinde en çok zorlanılan ve pekiştirilmesi gereken konu ise yüzde ${hardestQ.BaşarıYüzdesi.toFixed(0)} başarı oranıyla "${hardestQ.topic}" olmuştur. `;
      text += `Özellikle bu kazanıma yönelik konu tekrarları ve soru çözüm seansları yapılması sınıf başarısını ciddi oranda artıracaktır. `;
    }
  }
  
  text += `Analiz raporunu dinlediğiniz için teşekkürler. Verimli dersler dilerim!`;
  return text;
};
