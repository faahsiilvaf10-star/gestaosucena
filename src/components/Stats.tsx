import { motion } from "framer-motion";

const STATS = [
  { value: "20+", label: "Years Experience" },
  { value: "95+", label: "Projects Done" },
  { value: "200%", label: "Satisfied Clients" },
];

export function Stats() {
  return (
    <section className="bg-bg py-16 md:py-24">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-6">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: i * 0.1 }}
            viewport={{ once: true }}
            className="text-center md:text-left"
          >
            <div className="text-6xl md:text-7xl lg:text-8xl font-display italic text-text-primary mb-3">{s.value}</div>
            <div className="text-xs text-muted uppercase tracking-[0.3em]">{s.label}</div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
