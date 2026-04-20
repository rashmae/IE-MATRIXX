import React from 'react';
import { GlowCard } from "@/components/ui/spotlight-card";
import { Sparkles, Cpu, Zap, Bot } from 'lucide-react';

export default function SpotlightDemo() {
  return (
    <div className="min-h-screen bg-navy-deep flex flex-col items-center justify-center p-10 gap-12 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-ctu-maroon/20 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ctu-gold/20 blur-[120px] rounded-full"></div>
      </div>

      <div className="z-10 text-center space-y-4">
        <h1 className="text-5xl font-display font-bold text-white tracking-tighter">
          Spotlight <span className="text-ctu-gold">Core</span>
        </h1>
        <p className="text-white/40 font-medium max-w-md mx-auto uppercase tracking-[4px] text-xs">
          Interactive Neumorphic Glow Components
        </p>
      </div>

      <div className="z-10 flex flex-wrap items-center justify-center gap-10">
        <GlowCard glowColor="blue" size="md" className="flex flex-col justify-end">
          <div className="relative z-10 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
              <Cpu size={24} />
            </div>
            <h3 className="text-xl font-bold text-white">Neural Engine</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Advanced AI processing unit designed for high-performance curriculum analysis.
            </p>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800" 
            alt="Macro shot of a high-performance computer chip with glowing circuits representing AI intelligence" 
            className="absolute inset-0 w-full h-full object-cover opacity-20 rounded-2xl pointer-events-none"
            referrerPolicy="no-referrer"
          />
        </GlowCard>

        <GlowCard glowColor="orange" size="md" className="flex flex-col justify-end">
          <div className="relative z-10 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-ctu-gold/20 flex items-center justify-center text-ctu-gold mb-4">
              <Zap size={24} />
            </div>
            <h3 className="text-xl font-bold text-white">Rapid Sync</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Real-time synchronization across all your academic devices and progress trackers.
            </p>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1614728263952-84ea256f9679?auto=format&fit=crop&q=80&w=800" 
            alt="Digital network abstract art showing light paths representing fast data synchronization" 
            className="absolute inset-0 w-full h-full object-cover opacity-20 rounded-2xl pointer-events-none"
            referrerPolicy="no-referrer"
          />
        </GlowCard>

        <GlowCard glowColor="purple" size="md" className="flex flex-col justify-end">
          <div className="relative z-10 space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
              <Bot size={24} />
            </div>
            <h3 className="text-xl font-bold text-white">AI Advisor</h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Personalized academic guidance powered by state-of-the-art language models.
            </p>
          </div>
          <img 
            src="https://images.unsplash.com/photo-1531746790731-6c087fecd05a?auto=format&fit=crop&q=80&w=800" 
            alt="Futuristic robotic head profile illustrating an AI academic advisor" 
            className="absolute inset-0 w-full h-full object-cover opacity-20 rounded-2xl pointer-events-none"
            referrerPolicy="no-referrer"
          />
        </GlowCard>
      </div>

      <button 
        onClick={() => window.history.back()}
        className="z-10 mt-8 px-8 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm transition-all flex items-center gap-2"
      >
        <Sparkles size={16} className="text-ctu-gold" />
        Return to Matrix
      </button>
    </div>
  );
}
