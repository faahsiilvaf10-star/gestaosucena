import { motion, AnimatePresence } from 'framer-motion'
import { LogOut } from 'lucide-react'

interface LogoutOverlayProps {
  isVisible: boolean
  userName: string
  userRole: string
}

export function LogoutOverlay({ isVisible, userName, userRole }: LogoutOverlayProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#09090b] text-white"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="flex flex-col items-center gap-6"
          >
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.5 }}
              className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-2"
            >
              <LogOut size={36} className="text-red-500 ml-1" />
            </motion.div>
            
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="text-4xl font-tarmiles tracking-[0.2em] text-red-400 drop-shadow-[0_0_15px_rgba(248,113,113,0.4)]"
            >
              SAINDO...
            </motion.h2>
            
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-center flex flex-col items-center"
            >
              <p className="text-2xl font-evantic tracking-wide text-white/90">{userName}</p>
              <div className="h-px w-12 bg-white/10 my-3"></div>
              <p className="text-xs text-white/40 uppercase tracking-[0.3em] font-medium">{userRole}</p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="mt-12 flex gap-3"
            >
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                className="w-1.5 h-1.5 rounded-full bg-white/40"
              />
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                className="w-1.5 h-1.5 rounded-full bg-white/40"
              />
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                className="w-1.5 h-1.5 rounded-full bg-white/40"
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
