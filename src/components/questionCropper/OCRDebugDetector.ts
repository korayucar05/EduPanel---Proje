
export type DebugMarker = {
  x:number;
  y:number;
  width:number;
  height:number;
  color:string;
};

export function debugRedDetection(imageData: ImageData) {
  const {data, width, height} = imageData;
  const markers: DebugMarker[] = [];

  let count = 0;

  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      const i=(y*width+x)*4;
      const r=data[i];
      const g=data[i+1];
      const b=data[i+2];

      if(r>170 && g<140 && b<140){
        count++;
      }
    }
  }

  return {
    redPixelCount: count,
    markers
  };
}
