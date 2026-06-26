import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const ITEMS = [
  "https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?w=600&q=80",
  "https://images.unsplash.com/photo-1502691876148-a84978e59af8?w=600&q=80",
  "https://images.unsplash.com/photo-1517842645767-c639042777db?w=600&q=80",
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=600&q=80",
  "https://images.unsplash.com/photo-1506765515384-028b60a970df?w=600&q=80",
  "https://images.unsplash.com/photo-1499063078284-f78f7d89616a?w=600&q=80",
];

export function Explorations() {
  const sectionRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const rightColRef = useRef<HTMLDivElement>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!sectionRef.current || !contentRef.current) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current!,
        start: "top top",
        end: "bottom bottom",
        pin: contentRef.current!,
        pinSpacing: false,
      });
      gsap.to(leftColRef.current, {
        y: -200,
        ease: "none",
        scrollTrigger: { trigger: sectionRef.current!, start: "top bottom", end: "bottom top", scrub: 1 },
      });
      gsap.to(rightColRef.current, {
        y: 100,
        ease: "none",
        scrollTrigger: { trigger: sectionRef.current!, start: "top bottom", end: "bottom top", scrub: 1 },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  const left = ITEMS.filter((_, i) => i % 2 === 0);
  const right = ITEMS.filter((_, i) => i % 2 === 1);

  return (
    <section ref={sectionRef} className="relative bg-bg min-h-[300vh]">
      <div ref={contentRef} className="relative z-10 h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-8 h-px bg-stroke" />
          <span className="text-xs text-muted uppercase tracking-[0.3em]">Explorations</span>
          <span className="w-8 h-px bg-stroke" />
        </div>
        <h2 className="text-4xl md:text-6xl lg:text-7xl text-text-primary mb-4 leading-tight">
          Visual <span className="font-display italic">playground</span>
        </h2>
        <p className="text-sm md:text-base text-muted max-w-md mb-8">
          Sketches, frames, and small experiments — a window into the process.
        </p>
        <a href="#" className="group relative rounded-full">
          <span className="absolute opacity-0 group-hover:opacity-100 transition-opacity rounded-full accent-gradient" style={{ inset: "-2px" }} />
          <span className="relative inline-flex items-center gap-2 rounded-full bg-surface text-text-primary text-sm px-5 py-2.5">
            Follow on Dribbble <span className="text-muted">↗</span>
          </span>
        </a>
      </div>

      <div className="absolute inset-0 z-20 flex items-start justify-center pointer-events-none">
        <div className="grid grid-cols-2 gap-12 md:gap-40 max-w-[1400px] w-full px-6 pt-[20vh]">
          <div ref={leftColRef} className="flex flex-col gap-12 items-end">
            {left.map((src, i) => (
              <button
                key={src}
                onClick={() => setLightbox(src)}
                style={{ transform: `rotate(${i % 2 === 0 ? -3 : 2}deg)` }}
                className="pointer-events-auto aspect-square w-full max-w-[320px] rounded-2xl overflow-hidden border border-stroke bg-surface transition-transform hover:scale-105"
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <div ref={rightColRef} className="flex flex-col gap-12 items-start pt-32">
            {right.map((src, i) => (
              <button
                key={src}
                onClick={() => setLightbox(src)}
                style={{ transform: `rotate(${i % 2 === 0 ? 3 : -2}deg)` }}
                className="pointer-events-auto aspect-square w-full max-w-[320px] rounded-2xl overflow-hidden border border-stroke bg-surface transition-transform hover:scale-105"
              >
                <img src={src} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 cursor-zoom-out"
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </section>
  );
}
