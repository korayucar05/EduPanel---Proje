import React from "react";

export type HasatNavItem<TKey extends string=string>={
  key:TKey;
  label:string;
  icon:React.ElementType;
};

type Props<TKey extends string>={
  active:TKey;
  items:HasatNavItem<TKey>[];
  onChange:(key:TKey)=>void;
  isActive?:(item:HasatNavItem<TKey>,active:TKey)=>boolean;
};

export function HasatBottomNavigation<TKey extends string>({
  active,
  items,
  onChange,
  isActive,
}:Props<TKey>){
  return(
    <nav className="hasat-safe-bottom fixed inset-x-0 bottom-0 z-40 mx-auto flex min-h-[76px] max-w-[560px] items-center justify-around border-t border-white/80 bg-white/92 px-2 pt-2 shadow-[0_-10px_32px_rgba(15,42,72,.06)] backdrop-blur-xl">
      {items.map(item=>{
        const selected=isActive?isActive(item,active):active===item.key;
        const Icon=item.icon;
        return(
          <button
            key={item.key}
            onClick={()=>onChange(item.key)}
            className={[
              "hasat-pressable flex min-w-[62px] flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[9px] font-bold",
              selected
                ?"bg-emerald-50 text-emerald-700"
                :"text-slate-400 hover:bg-slate-50",
            ].join(" ")}
          >
            <Icon className={`h-5 w-5 ${selected?"stroke-[2.7]":""}`}/>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
