import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Send, Loader2, Bot, Trash2 } from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useProgress } from '@/src/hooks/useProgress';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { getGeminiClient, DEFAULT_MODEL } from '@/src/lib/gemini';
import ReactMarkdown from 'react-markdown';

type Message = { role: 'user' | 'ai'; content: string };

const SYSTEM_CONTEXT = (progress: any, subjects: any[]) => `
You are the IE Matrix AI Advisor, an expert academic advisor for Industrial Engineering students at Cebu Technological University.
Curriculum: ${JSON.stringify(subjects.map(s => ({ code: s.code, name: s.name, year: s.yearLevel, sem: s.semester, prereqs: s.prerequisiteIds })))}
Student Progress: ${JSON.stringify(progress)}
Be concise, friendly, and helpful. Use markdown for formatting. Focus on IE curriculum, study advice, and academic planning.
`;

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const { progressMap } = useProgress();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      // Auto-greet on first open
      handleSend('Give me a quick overview of my current IE curriculum progress and your top 2 recommendations.');
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async (overrideText?: string) => {
    const text = overrideText ?? input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    if (!overrideText) setInput('');
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const ai = getGeminiClient();
      if (!ai) {
        setMessages(prev => [...prev, { role: 'ai', content: '⚠️ AI Advisor is unavailable — check your `VITE_GEMINI_API_KEY` environment variable.' }]);
        return;
      }

      const history = [...messages, userMsg];
      const fullPrompt = `${SYSTEM_CONTEXT(progressMap, IE_SUBJECTS)}\n\nConversation:\n${history.map(m => `${m.role === 'user' ? 'Student' : 'Advisor'}: ${m.content}`).join('\n')}\n\nAdvisor:`;

      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: fullPrompt,
      });

      const aiText = response.text || 'Sorry, I could not process that. Please try again.';
      setMessages(prev => [...prev, { role: 'ai', content: aiText }]);
    } catch (err) {
      console.error('AI Advisor error:', err);
      setMessages(prev => [...prev, { role: 'ai', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setTimeout(() => handleSend('Give me a quick overview of my current IE curriculum progress and your top 2 recommendations.'), 100);
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        drag
        dragMomentum={false}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(prev => !prev)}
        aria-label={isOpen ? "Close AI Advisor" : "Open IE Matrix AI Advisor"}
        className="fixed bottom-24 right-6 lg:bottom-10 lg:right-10 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-ctu-maroon to-ctu-gold shadow-2xl flex items-center justify-center text-white border border-white/20 cursor-grab active:cursor-grabbing touch-none"
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={isOpen ? 'close' : 'open'}
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {isOpen ? <X size={22} /> : <Sparkles size={22} />}
          </motion.div>
        </AnimatePresence>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-40 right-4 lg:bottom-28 lg:right-10 z-50 w-[calc(100vw-2rem)] md:w-[400px] glass-card rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10"
            style={{ maxHeight: '70vh', minHeight: '400px' }}
          >
            {/* Header */}
            <div className="p-4 border-b border-foreground/5 bg-foreground/[0.03] flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ctu-maroon to-ctu-gold flex items-center justify-center text-white shrink-0">
                <Bot size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-foreground">IE Matrix AI Advisor</h3>
                <p className="text-[10px] text-foreground/40 uppercase tracking-widest">Powered by Gemini</p>
              </div>
              <button
                onClick={clearChat}
                title="Clear chat"
                className="p-1.5 rounded-lg text-foreground/30 hover:text-foreground/60 hover:bg-foreground/5 transition-colors"
              >
                <Trash2 size={14} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-foreground/30 hover:text-foreground/60 hover:bg-foreground/5 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {msg.role === 'ai' && (
                    <div className="w-6 h-6 rounded-full bg-ctu-gold/20 flex items-center justify-center text-ctu-gold shrink-0 mt-1">
                      <Bot size={12} />
                    </div>
                  )}
                  <div className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-ctu-gold/20 text-foreground rounded-tr-sm'
                      : 'bg-foreground/5 text-foreground/80 rounded-tl-sm'
                  }`}>
                    {msg.role === 'ai' ? (
                      <div className="prose prose-sm max-w-none prose-invert text-foreground/80">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-ctu-gold/20 flex items-center justify-center text-ctu-gold shrink-0">
                    <Bot size={12} />
                  </div>
                  <div className="bg-foreground/5 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                    <Loader2 size={14} className="text-ctu-gold animate-spin" />
                    <span className="text-xs text-foreground/40 font-medium">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompts */}
            {messages.length <= 1 && !loading && (
              <div className="px-4 pb-2 flex gap-2 flex-wrap">
                {[
                  'What should I study next?',
                  'Check my prerequisites',
                  'Tips for GWA improvement',
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-[10px] font-bold px-3 py-1.5 rounded-full bg-foreground/5 hover:bg-ctu-gold/10 text-foreground/50 hover:text-ctu-gold transition-all border border-foreground/5 hover:border-ctu-gold/20 whitespace-nowrap"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-foreground/5 bg-foreground/[0.02] shrink-0">
              <div className="flex items-center gap-2 neumorphic-pressed rounded-2xl px-4 py-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask your IE advisor..."
                  disabled={loading}
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground/30 outline-none min-w-0"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className="w-8 h-8 rounded-full bg-ctu-gold flex items-center justify-center text-white transition-all hover:bg-ctu-maroon disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
              <p className="text-[9px] text-foreground/20 text-center mt-1.5 font-bold uppercase tracking-widest">Press Enter to send</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
