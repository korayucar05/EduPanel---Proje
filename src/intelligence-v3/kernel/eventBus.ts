import type {KernelEvent,KernelEventType} from "./types";

type Listener=(event:KernelEvent)=>void;

class IntelligenceEventBus{
  private listeners=new Set<Listener>();
  private events:KernelEvent[]=[];

  subscribe(listener:Listener){
    this.listeners.add(listener);
    return()=>this.listeners.delete(listener);
  }

  emit(
    type:KernelEventType,
    title:string,
    detail?:string,
    payload?:Record<string,unknown>,
    durationMs?:number,
  ){
    const event:KernelEvent={
      id:`${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
      type,
      timestamp:new Date().toISOString(),
      title,
      detail,
      payload,
      durationMs,
    };
    this.events.push(event);
    if(this.events.length>200)this.events=this.events.slice(-200);
    for(const listener of this.listeners)listener(event);
    return event;
  }

  snapshot(){
    return[...this.events];
  }

  clear(){
    this.events=[];
  }
}

export const intelligenceEventBus=new IntelligenceEventBus();
