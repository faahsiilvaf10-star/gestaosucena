import { useEffect, useState } from "react";

const LINKS = ["Home", "Work", "Resume"];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("Home");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 md:pt-6 px-4">
      <div
        className={`inline-flex items-center rounded-full backdrop-blur-md border border-white/10 bg-surface px-2 py-2 transition-shadow ${
          scrolled ? "shadow-md shadow-black/10" : ""
        }`}
      >
        <a href="#" className="group relative w-9 h-9 rounded-full p-[1.5px] accent-gradient transition-transform hover:scale-110">
          <span className="flex items-center justify-center w-full h-full rounded-full bg-bg font-display italic text-[13px] text-text-primary">JA</span>
        </a>
        <div className="w-px h-5 bg-stroke mx-1 hidden sm:block" />
        {LINKS.map((l) => (
          <button
            key={l}
            onClick={() => setActive(l)}
            className={`text-xs sm:text-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 transition-colors ${
              active === l ? "text-text-primary bg-stroke/50" : "text-muted hover:text-text-primary hover:bg-stroke/50"
            }`}
          >
            {l}
          </button>
        ))}
        <div className="w-px h-5 bg-stroke mx-1 hidden sm:block" />
        <a href="mailto:hello@michaelsmith.com" className="group relative rounded-full">
          <span className="absolute opacity-0 group-hover:opacity-100 transition-opacity rounded-full accent-gradient" style={{ inset: "-2px" }} />
          <span className="relative inline-flex items-center gap-1 bg-surface rounded-full backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-text-primary">
            Say hi <span className="text-muted">↗</span>
          </span>
        </a>
      </div>
    </nav>
  );
}
