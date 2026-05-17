import React from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../ThemeToggle';
import NotificationCenter from './NotificationCenter';

interface MobileHeaderProps {
  hideBranding?: boolean;
  hideActions?: boolean;
}

export default function MobileHeader({ hideBranding = false, hideActions = false }: MobileHeaderProps) {
  const navigate = useNavigate();

  if (hideBranding && hideActions) return null;

  return (
    <div className="md:hidden flex items-center justify-between mb-4 px-2">
      {!hideBranding && (
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4 py-2 cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          {/* Enhanced Logo Implementation for Mobile */}
          <div className="relative w-12 h-12 shrink-0">
            <div className="absolute inset-0 bg-ctu-gold/30 rounded-full blur-xl animate-pulse" />
            <div className="relative w-full h-full neumorphic-raised rounded-full p-1 flex items-center justify-center bg-background overflow-hidden border border-white/10 shadow-lg">
              <div className="absolute inset-0 border-[2px] border-ctu-gold/30 rounded-full animate-[spin_8s_linear_infinite]" />
              
              <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-ctu-gold via-ctu-maroon to-navy-deep flex items-center justify-center shadow-inner overflow-hidden border border-white/20">
                <motion.div 
                  animate={{ 
                    scale: [1, 1.2, 1], 
                    opacity: [0.7, 1, 0.7],
                    rotate: [0, 10, -10, 0]
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="w-5 h-5 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] flex items-center justify-center"
                >
                  <div className="w-2.5 h-2.5 rounded-full bg-navy-deep flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-ctu-gold animate-ping" />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          <span className="text-2xl min-[380px]:text-3xl min-[420px]:text-4xl font-black tracking-tighter frosted-header uppercase leading-none mt-1">
            IE MATRIX
          </span>
        </motion.div>
      )}

      {!hideActions && (
        <div className="flex items-center gap-4 ml-auto">
          <NotificationCenter />

          {/* Theme Toggle Shortcut */}
          <ThemeToggle className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl active:scale-90 transition-all border-4 border-background p-0" />
        </div>
      )}
    </div>
  );
}
