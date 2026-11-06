import React from "react";
import {ChevronLeft} from "lucide-react";

type Props={
  title:string;
  subtitle?:string;
  onBack?:()=>void;
  actions?:React.ReactNode;
};

export function HasatPageHeader({title,subtitle,onBack,actions}:Props){
  return(
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/88 px-4 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[560px] items-center justify-between gap-3">
        <button
          onClick={onBack}
          aria-label="Geri"
          className={[
            "flex h-10 w-10 items-center justify-center rounded-full text-slate-800",
            onBack?"hasat-pressable hover:bg-slate-100":"invisible",
          ].join(" ")}
        >
          <ChevronLeft className="h-5 w-5"/>
        </button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-[15px] font-black text-slate-900">{title}</h1>
          {subtitle&&<p className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex min-h-10 min-w-10 items-center justify-end">{actions}</div>
      </div>
    </header>
  );
}
