import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { StaggeredFade } from "./StaggeredFade";

const NAV_LINKS = ["Wander", "Archive", "Story", "Connect"];

export function Hero() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative h-screen w-full overflow-hidden" style={{ backgroundColor: "#010101" }}>
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover object-center"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260619_191346_9d19d66e-86a4-47f7-8dc6-712c1788c3b2.mp4"
      />
      <div className="absolute inset-0 bg-black/30 z-[1]" />

      {/* Navigation */}
      <nav className="relative z-20 flex items-center justify-between md:justify-center md:gap-12 px-5 sm:px-8 py-6">
        <span
          className="text-white font-light uppercase text-sm sm:text-base"
          style={{ letterSpacing: "0.25em" }}
        >
          <span className="md:hidden">Organic Visions</span>
          <span className="hidden md:inline" style={{ letterSpacing: "0.3em" }}>
            Organic Visions
          </span>
        </span>

        <div className="hidden md:flex items-center gap-10">
          {NAV_LINKS.map((l) => (
            <a
              key={l}
              href="#"
              className="text-white/80 hover:text-white uppercase text-xs font-light transition-colors duration-300"
              style={{ letterSpacing: "0.2em" }}
            >
              {l}
            </a>
          ))}
        </div>

        <button
          className="md:hidden text-white"
          aria-label="Toggle menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="mobile-menu-glass fixed top-16 left-4 right-4 z-50 md:hidden rounded-2xl py-8 flex flex-col items-center gap-5"
          >
            {NAV_LINKS.map((l, i) => (
              <motion.a
                key={l}
                href="#"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.06, duration: 0.3, ease: "easeOut" }}
                className="text-white/90 hover:text-white uppercase font-light text-sm"
                style={{ letterSpacing: "0.25em" }}
                onClick={() => setOpen(false)}
              >
                {l}
              </motion.a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-5 sm:px-8 pt-12 sm:pt-16 md:pt-24">
        <h1 className="font-garamond font-normal text-white text-4xl sm:text-6xl md:text-8xl lg:text-9xl tracking-tight mb-6 sm:mb-8" style={{ lineHeight: 1.08 }}>
          <span className="block"><StaggeredFade text="WITNESS THE" /></span>
          <span className="block"><StaggeredFade text="HIDDEN REALM" /></span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.6 }}
          className="text-white/70 font-light leading-relaxed max-w-xs sm:max-w-md mb-8 sm:mb-10 text-sm sm:text-base md:text-lg"
        >
          An odyssey through delicate living forms,
          <br className="hidden sm:inline" /> revealed by lens and curiosity.
        </motion.p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 2.0 }}
          className="liquid-glass rounded-full text-white/90 uppercase text-xs sm:text-sm font-light px-7 sm:px-10 py-3.5 sm:py-4"
          style={{ letterSpacing: "0.18em" }}
        >
          Begin the Experience
        </motion.button>
      </div>
    </div>
  );
}
