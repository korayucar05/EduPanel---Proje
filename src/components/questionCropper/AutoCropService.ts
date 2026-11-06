
export async function runQuestionAutoCrop(image:string){
  const result = await fetch("/api/question-detect",{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({image})
  });

  if(!result.ok){
    throw new Error("Soru analiz servisi çalışmadı.");
  }

  return result.json();
}
