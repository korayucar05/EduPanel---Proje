
export function buildQuestionCards(blocks:any[]){
  return blocks.map((b:any)=>({
    id:b.id,
    crop:{
      x:b.x,
      y:b.y,
      width:b.width,
      height:b.height
    }
  }));
}
