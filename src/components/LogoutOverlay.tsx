import LogOut from 'lucide-react/dist/esm/icons/log-out.js';
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../contexts/ThemeContext'

interface LogoutOverlayProps {
  isVisible: boolean
  userName: string
  userRole: string
}

export function LogoutOverlay({ isVisible, userName, userRole }: LogoutOverlayProps) {
  const { isDark } = useTheme()

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-colors duration-500 ${
            isDark ? 'text-white' : 'text-[#1c1d21]'
          }`}
          style={{
            background: isDark
              ? 'radial-gradient(ellipse at center top, #1a1508 0%, #0d0d0d 40%, #050505 100%)'
              : 'radial-gradient(ellipse at center top, #fffdf7 0%, #f7f3e8 45%, #eceff4 100%)',
          }}
        >
          {/* Subtle golden glow at top */}
          <div
            className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px] pointer-events-none transition-opacity duration-500 ${
              isDark ? 'opacity-20' : 'opacity-30'
            }`}
            style={{ background: 'radial-gradient(ellipse, #c9a84c 0%, transparent 70%)' }}
          />

          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="flex flex-col items-center gap-0 relative z-10"
          >
            {/* LogOut icon in gold circle */}
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.5 }}
              className={`w-24 h-24 rounded-full border-[3px] border-[#c9a84c] flex items-center justify-center mb-8 ${
                isDark ? 'bg-transparent' : 'bg-white/80 shadow-md backdrop-blur-sm'
              }`}
              style={{
                boxShadow: isDark
                  ? '0 0 30px rgba(201,168,76,0.25), inset 0 0 20px rgba(201,168,76,0.1)'
                  : '0 12px 30px rgba(201,168,76,0.2), inset 0 0 15px rgba(201,168,76,0.1)',
              }}
            >
              <LogOut size={40} style={{ color: isDark ? '#c9a84c' : '#b88e28' }} className="ml-1" />
            </motion.div>
            
            {/* SAINDO... */}
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-4xl md:text-5xl font-extrabold tracking-[0.08em] uppercase mb-6 whitespace-nowrap"
              style={{ 
                color: isDark ? '#c9a84c' : '#b88e28',
                textShadow: isDark ? '0 0 40px rgba(201,168,76,0.3)' : '0 2px 20px rgba(201,168,76,0.2)',
                fontFamily: 'Inter, sans-serif'
              }}
            >
              SAINDO...
            </motion.h2>

            {/* Gold divider line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.9, duration: 0.6 }}
              className="h-[2px] w-16 mb-6"
              style={{ background: 'linear-gradient(90deg, transparent, #c9a84c, transparent)' }}
            />
            
            {/* User Name & Role */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center flex flex-col items-center"
            >
              <p className={`text-5xl tracking-tight mb-1 font-medium transition-colors ${
                isDark ? 'text-white' : 'text-[#1c1d21]'
              }`}>
                {userName}
              </p>
              <p className="text-sm uppercase tracking-[0.25em] font-semibold mt-3" style={{ color: isDark ? '#c9a84c' : '#b88e28' }}>
                {userRole}
              </p>
            </motion.div>
            
            {/* Three animated dots */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="mt-14 flex gap-3"
            >
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                className={`w-2.5 h-2.5 rounded-full transition-colors ${isDark ? 'bg-white/40' : 'bg-slate-400'}`}
              />
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: isDark ? '#c9a84c' : '#b88e28' }}
              />
              <motion.div
                animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: isDark ? '#c9a84c' : '#b88e28' }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

