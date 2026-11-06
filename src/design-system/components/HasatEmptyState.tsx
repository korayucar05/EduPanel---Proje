import React from "react";
import {Inbox} from "lucide-react";
import {HasatCard} from "./HasatCard";

export function HasatEmptyState({
  title,
  description,
  icon:Icon=Inbox,
}:{
  title:string;
  description:string;
  icon?:React.ElementType;
}){
  return <HasatCard className="p-6 text-center">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
      <Icon className="h-6 w-6"/>
    </div>
    <h3 className="mt-4 text-sm font-black text-slate-900">{title}</h3>
    <p className="mx-auto mt-2 max-w-[320px] text-[11px] leading-5 text-slate-500">{description}</p>
  </HasatCard>;
}
