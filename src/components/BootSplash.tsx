"use client";

import Image from "next/image";
import { useStore } from "@/lib/store";

export default function BootSplash() {
  const loaded = useStore((state) => state.loaded);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={loaded ? "M-dots ready" : "Loading M-dots"}
      aria-hidden={loaded}
      className={`boot-splash fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 transition-opacity duration-300 ${loaded ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <Image src="/logo_head_transparent.png" alt="" aria-hidden="true" width={144} height={144} unoptimized priority className="boot-mark size-36 object-contain" />
      <div className="text-[18px] font-medium tracking-tight text-white">M-dots</div>
      <span className="h-1 w-24 overflow-hidden rounded-full bg-white/10">
        <span className="block h-full w-1/2 animate-pulse rounded-full bg-[#8585f5]" />
      </span>
    </div>
  );
}
