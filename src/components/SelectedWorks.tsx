import { motion } from "framer-motion";

const PROJECTS = [
  { title: "Automotive Motion", span: "md:col-span-7", img: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80" },
  { title: "Urban Architecture", span: "md:col-span-5", img: "https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1200&q=80" },
  { title: "Human Perspective", span: "md:col-span-5", img: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=1200&q=80" },
  { title: "Brand Identity", span: "md:col-span-7", img: "https://images.unsplash.com/photo-1561070791-2526d30994b8?w=1200&q=80" },
];

const fade = { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, transition: { duration: 1, ease: [0.25, 0.1, 0.25, 1] as const }, viewport: { once: true, margin: "-100px" } };

export function SelectedWorks() {
  return (
    <section id="works" className="bg-bg py-12 md:py-16">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">
        <motion.div {...fade} className="flex flex-wrap items-end justify-between gap-8 mb-12">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-stroke" />
              <span className="text-xs text-muted uppercase tracking-[0.3em]">Selected Work</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl text-text-primary mb-4 leading-tight">
              Featured <span className="font-display italic">projects</span>
            </h2>
            <p className="text-sm md:text-base text-muted">
              A selection of projects I've worked on, from concept to launch.
            </p>
          </div>
          <a href="#" className="hidden md:inline-flex group relative rounded-full">
            <span className="absolute opacity-0 group-hover:opacity-100 transition-opacity rounded-full accent-gradient" style={{ inset: "-2px" }} />
            <span className="relative inline-flex items-center gap-2 rounded-full bg-surface text-text-primary text-sm px-5 py-2.5">
              View all work <span className="text-muted">→</span>
            </span>
          </a>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">
          {PROJECTS.map((p) => (
            <motion.div
              key={p.title}
              {...fade}
              className={`group relative overflow-hidden rounded-3xl bg-surface border border-stroke ${p.span} aspect-[4/3]`}
            >
              <img src={p.img} alt={p.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div
                className="absolute inset-0 opacity-20 mix-blend-multiply"
                style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)", backgroundSize: "4px 4px" }}
              />
              <div className="absolute inset-0 bg-bg/70 backdrop-blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                <div className="relative rounded-full p-[2px] accent-gradient">
                  <span className="block bg-white text-bg rounded-full px-5 py-2 text-sm">
                    View — <span className="font-display italic">{p.title}</span>
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
