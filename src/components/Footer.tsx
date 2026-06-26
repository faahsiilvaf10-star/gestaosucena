import { useEffect, useRef } from "react";
import Hls from "hls.js";
import { gsap } from "gsap";

const HLS_SRC = "https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8";
const SOCIALS = ["Twitter", "LinkedIn", "Dribbble", "GitHub"];

export function Footer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(HLS_SRC);
      hls.attachMedia(v);
    } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = HLS_SRC;
    }
    return () => { hls?.destroy(); };
  }, []);

  useEffect(() => {
    if (!marqueeRef.current) return;
    const tween = gsap.to(marqueeRef.current, { xPercent: -50, duration: 40, ease: "none", repeat: -1 });
    return () => { tween.kill(); };
  }, []);

  return (
    <footer className="relative bg-bg pt-16 md:pt-20 pb-8 md:pb-12 overflow-hidden">
      <video
        ref={videoRef}
        autoPlay muted loop playsInline
        className="absolute top-1/2 left-1/2 min-w-full min-h-full object-cover -translate-x-1/2 -translate-y-1/2 scale-y-[-1]"
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 overflow-hidden mb-16">
        <div ref={marqueeRef} className="flex whitespace-nowrap text-6xl md:text-8xl lg:text-9xl font-display italic text-text-primary/90">
          {Array.from({ length: 10 }).map((_, i) => (
            <span key={i} className="px-6">BUILDING THE FUTURE •</span>
          ))}
        </div>
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 text-center">
        <a href="mailto:hello@michaelsmith.com" className="group relative inline-block rounded-full mb-16">
          <span className="absolute opacity-0 group-hover:opacity-100 transition-opacity rounded-full accent-gradient" style={{ inset: "-2px" }} />
          <span className="relative inline-block rounded-full bg-text-primary text-bg text-base md:text-lg px-8 py-4">
            hello@michaelsmith.com
          </span>
        </a>

        <div className="flex flex-wrap items-center justify-between gap-6 pt-8 border-t border-stroke">
          <div className="flex items-center gap-5">
            {SOCIALS.map((s) => (
              <a key={s} href="#" className="text-xs text-muted hover:text-text-primary uppercase tracking-[0.2em] transition-colors">
                {s}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-75" />
              <span className="relative w-2 h-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs text-muted uppercase tracking-[0.2em]">Available for projects</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
