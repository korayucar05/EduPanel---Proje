import React from "react";
import type {HasatTone} from "../tokens";
import {hasatToneClasses} from "../tokens";

type Props={
  children:React.ReactNode;
  className?:string;
  onClick?:()=>void;
  tone?:HasatTone;
  elevated?:boolean;
  interactive?:boolean;
};

export function HasatCard({
  children,
  className="",
  onClick,
  tone,
  elevated=false,
  interactive,
}:Props){
  const toneClass=tone
    ?`${hasatToneClasses[tone].surface} ${hasatToneClasses[tone].border}`
    :"border-slate-200/80 bg-white";
  const clickable=interactive??Boolean(onClick);

  return(
    <section
      onClick={onClick}
      className={[
        "hasat-enter rounded-[var(--hasat-radius-card)] border",
        toneClass,
        elevated
          ?"shadow-[var(--hasat-shadow-elevated)]"
          :"shadow-[var(--hasat-shadow-card)]",
        clickable?"hasat-pressable cursor-pointer":"",
        className,
      ].filter(Boolean).join(" ")}
    >
      {children}
    </section>
  );
}
