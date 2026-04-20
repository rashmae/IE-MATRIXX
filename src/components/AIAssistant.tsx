import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Loader2, Bot } from 'lucide-react';
import { getCurriculumAdvice } from '@/src/lib/gemini';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { useAuth } from '@/src/context/AuthContext';
import { useProgress } from '@/src/hooks/useProgress';
import ReactMarkdown from 'react-markdown';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const { profile } = useAuth();
  const { progressMap } = useProgress();

  const handleGetAdvice = async () => {
    if (!profile) return;
    setLoading(true);
    setIsOpen(true);
    
    const result = await getCurriculumAdvice(progressMap, IE_SUBJECTS);
    setAdvice(result);
    setLoading(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        drag
        dragMomentum={false}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          if (!isOpen) handleGetAdvice();
          else setIsOpen(false);
        }}
        aria-label={isOpen ? "Close AI Advisor" : "Open IE Matrix AI Advisor"}
        className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-ctu-maroon to-ctu-gold shadow-2xl flex items-center justify-center text-white border border-white/20 cursor-grab active:cursor-grabbing touch-none"
      >
        {isOpen ? <X size={24} /> : <Sparkles size={24} />}
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragMomentum={false}
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            className="fixed bottom-40 right-6 lg:bottom-28 lg:right-10 z-50 w-[calc(100vw-3rem)] md:w-96 glass-card rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/20 cursor-move"
            style={{ maxHeight: '70vh' }}
          >
            <div className="p-4 border-b border-foreground/5 bg-foreground/[0.02] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-ctu-gold/20 flex items-center justify-center text-ctu-gold">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">IE Matrix AI Advisor</h3>
                <p className="text-[10px] text-foreground/40 uppercase tracking-widest">Powered by Gemini</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Loader2 size={32} className="text-ctu-gold animate-spin mb-4" />
                  <p className="text-sm text-foreground/40 font-bold uppercase tracking-widest">Analyzing your curriculum...</p>
                </div>
              ) : (
                <div className="prose prose-sm max-w-none text-foreground/80 font-medium leading-relaxed">
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{advice || ''}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-foreground/[0.02] border-t border-foreground/5">
              <button 
                onClick={handleGetAdvice}
                disabled={loading}
                className="w-full py-3 neumorphic-raised hover:neumorphic-pressed rounded-2xl text-xs font-bold text-foreground transition-all flex items-center justify-center gap-2"
              >
                <Sparkles size={14} className="text-ctu-gold" />
                Refresh Advice
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
