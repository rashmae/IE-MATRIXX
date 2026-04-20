import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-ctu-gold/10 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-ctu-maroon/10 rounded-full blur-[100px] animate-pulse delay-700" />
      
      <div className="relative z-10 flex flex-col items-center">
        {/* Animated Logo / Robot Eye Wrapper */}
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8 }}
          className="relative w-32 h-32 mb-10"
        >
          <div className="absolute inset-0 bg-ctu-gold/20 rounded-full blur-2xl animate-pulse" />
          <div className="relative w-full h-full neumorphic-raised rounded-full p-1 flex items-center justify-center bg-background border border-white/10">
            {/* Core AI Eye */}
            <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-ctu-gold via-ctu-maroon to-navy-deep flex items-center justify-center shadow-inner overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_70%)]" />
              <motion.div 
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.8, 1, 0.8]
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-10 h-10 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)] flex items-center justify-center"
              >
                <div className="w-5 h-5 rounded-full bg-navy-deep flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-ctu-gold animate-ping" />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Text Loader */}
        <div className="text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-bold tracking-tighter mb-2 bg-gradient-to-r from-ctu-gold to-ctu-maroon bg-clip-text text-transparent"
          >
            IE MATRIX
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs uppercase tracking-[0.3em] font-black text-foreground/40 animate-pulse"
          >
            Initializing Intelligence
          </motion.p>
        </div>

        {/* Progress Bar */}
        <div className="mt-8 w-48 h-1 bg-foreground/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-1/2 h-full bg-ctu-gold"
          />
        </div>
      </div>
    </div>
  );
}
