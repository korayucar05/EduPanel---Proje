
// Otomatik soru bulma paneli bağlantısı.
// QuestionPrepareModule içine bağlanacak yardımcı bileşen.

export async function detectQuestionsFromPage(image: string) {
  const response = await fetch("/api/question-detect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ image })
  });

  return response.json();
}
