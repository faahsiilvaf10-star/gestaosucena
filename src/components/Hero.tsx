import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { gsap } from "gsap";

const ROLES = ["Creative", "Fullstack", "Founder", "Scholar"];
const HLS_SRC = "https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8";

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [roleIndex, setRoleIndex] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: Hls | null = null;
    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(HLS_SRC);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = HLS_SRC;
    }
    return () => { hls?.destroy(); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setRoleIndex((i) => (i + 1) % ROLES.length), 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".name-reveal", { opacity: 0, y: 50, duration: 1.2, delay: 0.1 })
        .from(".blur-in", { opacity: 0, filter: "blur(10px)", y: 20, duration: 1, stagger: 0.1 }, "-=0.9");
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative min-h-screen w-full overflow-hidden">
      <video
        ref={videoRef}
        autoPlay muted loop playsInline
        className="absolute top-1/2 left-1/2 min-w-full min-h-full object-cover -translate-x-1/2 -translate-y-1/2"
      />
      <div className="absolute inset-0 bg-black/20" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-bg to-transparent" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-6">
        <div className="blur-in text-xs text-muted uppercase tracking-[0.3em] mb-8">COLLECTION '26</div>
        <h1 className="name-reveal text-6xl md:text-8xl lg:text-9xl font-display italic leading-[0.9] tracking-tight text-text-primary mb-6">
          Michael Smith
        </h1>
        <p className="blur-in text-lg md:text-2xl text-text-primary/90 mb-6">
          A{" "}
          <span key={roleIndex} className="font-display italic text-text-primary animate-role-fade-in inline-block">
            {ROLES[roleIndex]}
          </span>{" "}
          lives in Chicago.
        </p>
        <p className="blur-in text-sm md:text-base text-muted max-w-md mb-12">
          Designing seamless digital interactions by focusing on the unique nuances which bring systems to life.
        </p>
        <div className="blur-in inline-flex flex-wrap justify-center gap-4">
          <a href="#works" className="group relative rounded-full">
            <span className="absolute opacity-0 group-hover:opacity-100 transition-opacity rounded-full accent-gradient" style={{ inset: "-2px" }} />
            <span className="relative inline-block rounded-full bg-text-primary text-bg group-hover:bg-bg group-hover:text-text-primary text-sm px-7 py-3.5 transition-all hover:scale-105">
              See Works
            </span>
          </a>
          <a href="mailto:hello@michaelsmith.com" className="group relative rounded-full">
            <span className="absolute opacity-0 group-hover:opacity-100 transition-opacity rounded-full accent-gradient" style={{ inset: "-2px" }} />
            <span className="relative inline-block rounded-full border-2 border-stroke group-hover:border-transparent bg-bg text-text-primary text-sm px-7 py-3.5 transition-all hover:scale-105">
              Reach out...
            </span>
          </a>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-3">
        <span className="text-xs text-muted uppercase tracking-[0.2em]">SCROLL</span>
        <div className="relative w-px h-10 bg-stroke overflow-hidden">
          <div className="absolute inset-x-0 h-4 accent-gradient animate-scroll-down" />
        </div>
      </div>
    </section>
  );
}
