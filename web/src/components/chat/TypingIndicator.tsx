import { motion, AnimatePresence } from 'framer-motion';

export function TypingIndicator({ users }: { users: string[] }) {
  return (
    <AnimatePresence>
      {users.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, height: 0, y: 5 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0, y: 5 }}
          className="px-6 py-2 overflow-hidden"
        >
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.3, 1, 0.3]
                  }}
                  transition={{ 
                    repeat: Infinity, 
                    duration: 1.2, 
                    delay: i * 0.15,
                    ease: "easeInOut" 
                  }}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]"
                />
              ))}
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-text-muted)] opacity-50">
              {users.length === 1 ? 'Intel Stream Active' : 'Multiple Data Ingress'}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
