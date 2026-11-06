import type {LiveSchoolEvent} from "./types";

import { sqliteStorage } from "../../lib/sqliteStorageBridge";
const STORAGE_KEY="hasat_live_events_v1";
type Listener=(event:LiveSchoolEvent)=>void;

const readStored=():LiveSchoolEvent[]=>{
  try{
    const parsed=JSON.parse(sqliteStorage.getItem(STORAGE_KEY)||"[]");
    return Array.isArray(parsed)?parsed:[];
  }catch{
    return[];
  }
};

class HasatLiveEventBus{
  private listeners=new Set<Listener>();
  private events:LiveSchoolEvent[]=typeof window==="undefined"?[]:readStored();

  subscribe(listener:Listener){
    this.listeners.add(listener);
    return()=>{ this.listeners.delete(listener); };
  }

  publish(event:Omit<LiveSchoolEvent,"id"|"occurredAt"> & Partial<Pick<LiveSchoolEvent,"id"|"occurredAt">>){
    const resolved:LiveSchoolEvent={
      ...event,
      id:event.id||`${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
      occurredAt:event.occurredAt||new Date().toISOString(),
    };
    this.events=[resolved,...this.events].slice(0,500);
    try{
      sqliteStorage.setItem(STORAGE_KEY,JSON.stringify(this.events));
    }catch{}
    for(const listener of this.listeners)listener(resolved);
    window.dispatchEvent(new CustomEvent("hasat-live-event",{detail:resolved}));
    return resolved;
  }

  snapshot(){
    return[...this.events];
  }

  clear(){
    this.events=[];
    try{sqliteStorage.removeItem(STORAGE_KEY);}catch{}
    window.dispatchEvent(new CustomEvent("hasat-live-cleared"));
  }
}

export const hasatLiveEventBus=new HasatLiveEventBus();

export const publishHasatLiveEvent=(
  event:Parameters<HasatLiveEventBus["publish"]>[0],
)=>hasatLiveEventBus.publish(event);
