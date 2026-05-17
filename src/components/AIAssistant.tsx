import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Send, Loader2, Bot, ArrowRight } from 'lucide-react';
import { getCurriculumAdvice, askQuestion, isAIAvailable, getAvailableProviders } from '@/src/lib/gemini';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { useAuth } from '@/src/context/AuthContext';
import { useProgress } from '@/src/hooks/useProgress';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const RobotMascot = ({ className, size = 24, glow = true }: { className?: string, size?: number, glow?: boolean }) => (
  <div className={cn("relative flex items-center justify-center shrink-0", className)} style={{ width: size, height: size }}>
    <motion.div
      animate={{ y: [0, -2, 0] }}
      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      className="relative w-full h-full"
    >
      {/* Robot Head */}
      <div className="w-full h-full bg-gradient-to-br from-ctu-maroon to-ctu-maroon/80 rounded-[30%] border border-white/10 relative shadow-xl overflow-hidden">
        {/* Reflection */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent" />
        
        {/* Face Panel */}
        <div className="absolute inset-[20%] bg-black/40 rounded-md flex items-center justify-center gap-[15%]">
          {/* Eyes */}
          <motion.div 
            animate={{ 
              scaleY: [1, 1, 0.1, 1, 1],
              backgroundColor: glow ? ["#EAB308", "#EAB308", "#EAB308", "#EAB308", "#EAB308"] : "#EAB308"
            }} 
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }}
            className={cn(
              "w-[20%] h-[20%] bg-ctu-gold rounded-full",
              glow && "shadow-[0_0_8px_rgba(234,179,8,0.8)]"
            )} 
          />
          <motion.div 
            animate={{ 
              scaleY: [1, 1, 0.1, 1, 1]
            }} 
            transition={{ duration: 4, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }}
            className={cn(
              "w-[20%] h-[20%] bg-ctu-gold rounded-full",
              glow && "shadow-[0_0_8px_rgba(234,179,8,0.8)]"
            )} 
          />
        </div>
      </div>
      
      {/* Antennas / Ears */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-[8%] h-[25%] bg-ctu-gold rounded-full" />
      <motion.div 
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute -top-2 left-1/2 -translate-x-1/2 w-[15%] h-[15%] bg-ctu-gold rounded-full shadow-[0_0_6px_rgba(234,179,8,1)]" 
      />
      
      {/* Side Bolts */}
      <div className="absolute top-1/2 -left-0.5 -translate-y-1/2 w-[12%] h-[25%] bg-ctu-maroon border border-white/5 rounded-full" />
      <div className="absolute top-1/2 -right-0.5 -translate-y-1/2 w-[12%] h-[25%] bg-ctu-maroon border border-white/5 rounded-full" />
    </motion.div>
  </div>
);

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ie_matrix_ai_messages');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [input, setInput] = useState('');
  const { profile } = useAuth();
  const { progressMap } = useProgress();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && messages.length > 0) {
      localStorage.setItem('ie_matrix_ai_messages', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const [lastRequestTime, setLastRequestTime] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const COOLDOWN_MS = 15000; // 15 seconds cooldown

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (retryCountdown > 0) {
      timer = setInterval(() => {
        setRetryCountdown(prev => {
          const next = Math.max(0, prev - 1);
          if (next === 0) setLastRequestTime(0); // Clear cooldown when timer hits 0
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [retryCountdown]);

  const handleGetInitialAdvice = async () => {
    if (!profile) return;

    if (!isAIAvailable()) {
      setMessages([{
        role: 'assistant',
        content: "👋 Hello! I'm your **IE Matrix AI Advisor**. \n\nI noticed that no AI provider is configured. Please add an AI API Key to enable this feature."
      }]);
      setIsOpen(true);
      return;
    }

    const now = Date.now();
    if (now - lastRequestTime < COOLDOWN_MS || retryCountdown > 0) {
      const waitTime = retryCountdown > 0 ? retryCountdown : Math.ceil((COOLDOWN_MS - (now - lastRequestTime)) / 1000);
      setMessages([{ 
        role: 'assistant', 
        content: `🐢 **Throttling**: To preserve free AI quota, please wait ${waitTime}s before requesting a new analysis.` 
      }]);
      setIsOpen(true);
      return;
    }

    setLoading(true);
    setIsOpen(true);
    
    try {
      const result = await getCurriculumAdvice(progressMap, IE_SUBJECTS);
      setMessages([{ role: 'assistant', content: result }]);
      setLastRequestTime(Date.now());
    } catch (error: any) {
      const isQuota = error.status === 429 || error.message?.includes('429');
      if (isQuota) {
        let wait = error.retryAfter || 30;
        setRetryCountdown(wait);
        setMessages([{ 
          role: 'assistant', 
          content: `🚨 **AI Quota Exhausted**: The Gemini Free Tier is currently overloaded with global traffic. 

**Next availability**: ~${wait} seconds.

I have automatically switched to our **Offline Advisor Mode** for you:

${isQuota ? "*(Static Fallback Active)*" : ""}
` 
        }]);
      } else {
        setMessages([{ role: 'assistant', content: "I'm sorry, I couldn't generate advice right now. Please try again later." }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customMessage?: string) => {
    if (e) e.preventDefault();
    const userMessage = customMessage || input.trim();
    if (!userMessage || loading) return;

    const now = Date.now();
    if (!customMessage && (now - lastRequestTime < 2000 || retryCountdown > 0)) {
      if (retryCountdown > 0) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⏳ **AI Cooldown**: Please wait ${retryCountdown}s more before your next question.` }]);
      }
      return;
    }

    if (!isAIAvailable()) {
      setMessages(prev => [...prev, 
        { role: 'user', content: userMessage },
        { role: 'assistant', content: "Offline mode: AI functionality requires a Gemini API key." }
      ]);
      setInput('');
      return;
    }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);
    setLastRequestTime(now);

    const chatHistory = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    try {
      const response = await askQuestion(userMessage, chatHistory);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setLastRequestTime(Date.now());
    } catch (error: any) {
      const isQuota = error.status === 429 || error.message?.includes('429');
      if (isQuota) {
        const wait = error.retryAfter || 30;
        setRetryCountdown(wait);
      }
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: isQuota 
          ? `⚠️ **Free Tier Busy**: Gemini is currently overloaded. Please wait **${error.retryAfter || 30}s** before sending another message.`
          : "I encountered an error. Could you try asking that again?" 
      }]);
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
            if (messages.length === 0) {
              setMessages([{
                role: 'assistant',
                content: `👋 Mabuhay, **${profile?.fullName.split(' ')[0] || 'Future Engineer'}**! I am your **IE Matrix Advisor**. 
                
I can analyze your CTU curriculum progress and provide strategic advice. Would you like me to generate a personalized roadmap analysis for you?`
              }]);
            }
          }
          else setIsOpen(false);
        }}
        aria-label={isOpen ? "Close AI Advisor" : "Open IE Matrix AI Advisor"}
        className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-ctu-maroon to-ctu-gold shadow-2xl flex items-center justify-center text-white border border-white/20 cursor-grab active:cursor-grabbing touch-none overflow-hidden"
      >
        {isOpen ? <X size={24} /> : <RobotMascot size={32} />}
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
                <RobotMascot size={32} />
                <div>
                  <h3 className="text-sm font-bold text-foreground">IE Matrix AI Advisor</h3>
                  <p className="text-[10px] text-foreground/40 uppercase tracking-widest flex justify-between">
                     <span>Powered by {getAvailableProviders().find(p=>p.active)?.name || 'AI'}</span>
                     <button onClick={() => window.location.href='/profile'} className="hover:text-ctu-gold cursor-pointer ml-2">Change</button>
                  </p>
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
              
              {messages.length >= 1 && !loading && messages[0].content.includes('generate a personalized roadmap') && (
                <div className="px-4 pb-4">
                  <button 
                    onClick={handleGetInitialAdvice}
                    className="w-full py-3 rounded-2xl bg-ctu-maroon text-white text-xs font-bold uppercase tracking-wider shadow-lg hover:bg-ctu-maroon/90 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Sparkles size={16} />
                    Generate My Analysis
                  </button>
                </div>
              )}

              {messages.length > 1 && !loading && (
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
                  <RobotMascot size={48} className="mb-2" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No messages yet</p>
                </div>
              )}
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-background/80 border-t border-foreground/5 relative">
              <AnimatePresence>
                {retryCountdown > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-x-4 top-4 bottom-[calc(1rem+24px)] z-10 rounded-xl bg-background/60 backdrop-blur-[2px] flex items-center justify-center border border-ctu-maroon/20"
                  >
                    <div className="flex items-center gap-2 text-ctu-maroon font-bold text-[10px] uppercase tracking-widest animate-pulse">
                      <Loader2 size={12} className="animate-spin" />
                      Cooling Down: {retryCountdown}s
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <input 
                  type="text"
                  placeholder={retryCountdown > 0 ? "AI is cooling down..." : "Ask about your curriculum..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={loading || retryCountdown > 0}
                  className={cn(
                    "w-full bg-foreground/[0.02] border-none neumorphic-pressed h-11 rounded-xl pl-4 pr-12 text-xs focus:ring-1 focus:ring-ctu-gold/50 outline-none transition-all",
                    retryCountdown > 0 && "opacity-50 grayscale cursor-not-allowed"
                  )}
                />
                <button 
                  type="submit"
                  disabled={loading || !input.trim() || retryCountdown > 0}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-ctu-gold hover:bg-ctu-gold/80 disabled:opacity-50 disabled:grayscale transition-all"
                >
                  <ArrowRight size={14} className="text-white" />
                </button>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setMessages([]);
                  localStorage.removeItem('ie_matrix_ai_messages');
                }}
                className="mt-2 text-[9px] font-black uppercase tracking-widest text-foreground/30 hover:text-ctu-maroon w-full text-center transition-colors"
                disabled={loading}
              >
                Clear Chat History
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
