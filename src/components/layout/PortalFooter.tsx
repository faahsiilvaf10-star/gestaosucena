export function PortalFooter() {
  return (
    <footer className="w-full mt-10 pt-6 pb-8 border-t border-gray-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 transition-colors">
      {/* Left side: Logo + Motto */}
      <div className="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
        <div className="flex items-center gap-2">
          {/* Logo icon */}
          <svg width="22" height="18" viewBox="0 0 40 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 22C12 28 24 26 36 12C28 22 18 24 6 22Z" fill="#3B82F6" />
            <path d="M6 14C16 4 28 6 36 12C26 8 16 10 4 20C4 18 5 16 6 14Z" fill="#06B6D4" />
          </svg>
          <span className="font-extrabold text-[12px] tracking-wider text-slate-800 dark:text-slate-200">
            HYDRO REABILITAÇÃO
          </span>
        </div>

        <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>

        <span className="text-[11.5px] text-slate-500 dark:text-slate-400 font-medium">
          Trabalho Seguro • Pessoas • Resultados
        </span>
      </div>

      {/* Right side: Stylized handwritten slogan */}
      <div className="flex items-center justify-center sm:justify-end">
        <img
          src="/layout/footer-script.png"
          alt="Juntos construímos um futuro melhor!"
          className="h-7 w-auto object-contain dark:brightness-125 dark:contrast-125"
          onError={(e) => {
            // Fallback text if image fails to load
            const target = e.currentTarget
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement
            if (fallback) fallback.style.display = 'block'
          }}
        />
        <span
          style={{ display: 'none' }}
          className="text-xs italic font-semibold text-[#0284C7] dark:text-[#38BDF8]"
        >
          Juntos construímos um futuro melhor!
        </span>
      </div>
    </footer>
  )
}
