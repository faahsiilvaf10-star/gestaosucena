import { motion } from "framer-motion";

const ENTRIES = [
  { title: "Designing for clarity in dark interfaces", read: "6 min read", date: "Jun 12, 2026", img: "https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=400&q=80" },
  { title: "Why motion is the new typography", read: "4 min read", date: "May 28, 2026", img: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=400&q=80" },
  { title: "Building portfolios that feel inevitable", read: "8 min read", date: "Apr 09, 2026", img: "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&q=80" },
  { title: "Notes on craft, speed, and taste", read: "5 min read", date: "Mar 22, 2026", img: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?w=400&q=80" },
];

export function Journal() {
  return (
    <section className="bg-bg py-16 md:py-24">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-wrap items-end justify-between gap-8 mb-12"
        >
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-8 h-px bg-stroke" />
              <span className="text-xs text-muted uppercase tracking-[0.3em]">Journal</span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl text-text-primary mb-4 leading-tight">
              Recent <span className="font-display italic">thoughts</span>
            </h2>
            <p className="text-sm md:text-base text-muted">Long-form notes on craft, motion, and process.</p>
          </div>
          <a href="#" className="group relative rounded-full">
            <span className="absolute opacity-0 group-hover:opacity-100 transition-opacity rounded-full accent-gradient" style={{ inset: "-2px" }} />
            <span className="relative inline-flex items-center gap-2 rounded-full bg-surface text-text-primary text-sm px-5 py-2.5">
              View all <span className="text-muted">→</span>
            </span>
          </a>
        </motion.div>

        <div className="flex flex-col gap-4">
          {ENTRIES.map((e, i) => (
            <motion.a
              key={e.title}
              href="#"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.05 }}
              viewport={{ once: true, margin: "-50px" }}
              className="flex items-center gap-6 p-4 rounded-[40px] sm:rounded-full bg-surface/30 hover:bg-surface border border-stroke transition-colors"
            >
              <img src={e.img} alt={e.title} className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
              <h3 className="flex-1 text-base md:text-lg text-text-primary">{e.title}</h3>
              <span className="hidden md:inline text-xs text-muted">{e.read}</span>
              <span className="hidden sm:inline text-xs text-muted">{e.date}</span>
              <span className="text-muted pr-3">→</span>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
