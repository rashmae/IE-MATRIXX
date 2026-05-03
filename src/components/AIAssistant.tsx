import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Send, Loader2, Bot, ArrowRight } from 'lucide-react';
import { getCurriculumAdvice, askQuestion } from '@/src/lib/gemini';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { useAuth } from '@/src/context/AuthContext';
import { useProgress } from '@/src/hooks/useProgress';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const { profile } = useAuth();
  const { progressMap } = useProgress();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleGetInitialAdvice = async () => {
    if (!profile) return;
    setLoading(true);
    setIsOpen(true);
    
    try {
      const result = await getCurriculumAdvice(progressMap, IE_SUBJECTS);
      setMessages([{ role: 'assistant', content: result }]);
    } catch (error) {
      setMessages([{ role: 'assistant', content: "I'm sorry, I couldn't generate advice right now. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customMessage?: string) => {
    if (e) e.preventDefault();
    const userMessage = customMessage || input.trim();
    if (!userMessage || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const chatHistory = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
      const response = await askQuestion(userMessage, chatHistory);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I encountered an error. Could you try asking that again?" }]);
    } finally {
      setLoading(false);
    }
  };

  const QUICK_PROMPTS = [
    "Analyze my progress",
    "Identify bottlenecks",
    "Suggest electives"
  ];

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        drag
        dragMomentum={false}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          if (!isOpen) {
            setIsOpen(true);
            if (messages.length === 0) handleGetInitialAdvice();
          }
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
            <div className="p-4 border-b border-foreground/5 bg-foreground/[0.02] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-ctu-gold/20 flex items-center justify-center text-ctu-gold">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">IE Matrix AI Advisor</h3>
                  <p className="text-[10px] text-foreground/40 uppercase tracking-widest">Powered by Gemini</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-foreground/5 rounded-full transition-colors">
                <X size={16} className="text-foreground/40" />
              </button>
            </div>

            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-background/50"
            >
              {messages.map((msg, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex flex-col",
                    msg.role === 'user' ? "items-end" : "items-start"
                  )}
                >
                  <div className={cn(
                    "max-w-[85%] p-3 rounded-2xl text-xs font-medium leading-relaxed",
                    msg.role === 'user' 
                      ? "bg-ctu-maroon text-white rounded-tr-none" 
                      : "neumorphic-raised text-foreground rounded-tl-none"
                  )}>
                    <div className={cn(
                      "prose prose-xs max-w-none",
                      msg.role === 'user' ? "prose-invert" : "prose-neutral"
                    )}>
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="neumorphic-raised text-foreground rounded-2xl rounded-tl-none p-3">
                    <Loader2 size={16} className="text-ctu-gold animate-spin" />
                  </div>
                </div>
              )}
              
              {messages.length === 1 && !loading && (
                <div className="flex flex-wrap gap-2 px-4 pb-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {QUICK_PROMPTS.map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => handleSendMessage(undefined, prompt)}
                      className="px-3 py-1.5 rounded-full bg-ctu-gold/10 border border-ctu-gold/20 text-[10px] font-bold text-ctu-gold hover:bg-ctu-gold/20 transition-all uppercase tracking-wider"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
              
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
                  <Bot size={32} className="mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No messages yet</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-background/80 border-t border-foreground/5">
              <div className="relative">
                <input 
                  type="text"
                  placeholder="Ask about your curriculum..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading}
                  className="w-full bg-foreground/[0.02] border-none neumorphic-pressed h-11 rounded-xl pl-4 pr-12 text-xs focus:ring-1 focus:ring-ctu-gold/50 outline-none transition-all"
                />
                <button 
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-ctu-gold hover:bg-ctu-gold/80 disabled:opacity-50 disabled:grayscale transition-all"
                >
                  <ArrowRight size={14} className="text-white" />
                </button>
              </div>
              <button 
                type="button"
                onClick={handleGetInitialAdvice}
                className="mt-2 text-[9px] font-black uppercase tracking-widest text-ctu-gold hover:text-ctu-gold/80 w-full text-center transition-colors"
                disabled={loading}
              >
                Reset Analysis
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
