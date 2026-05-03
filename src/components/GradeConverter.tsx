import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  RefreshCcw, 
  ArrowRightLeft,
  Info 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  percentToGWA, 
  gwaToPercent, 
  getGWALabel, 
  getGWAColor 
} from '@/src/lib/gradeUtils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function GradeConverter() {
  const [mode, setMode] = useState<'percent-to-gwa' | 'gwa-to-percent'>('percent-to-gwa');
  const [inputValue, setInputValue] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const val = parseFloat(inputValue);
    if (isNaN(val)) {
      setResult(null);
      setLabel(null);
      return;
    }

    if (mode === 'percent-to-gwa') {
      const gwa = percentToGWA(val);
      setResult(gwa.toFixed(2));
      setLabel(getGWALabel(gwa));
    } else {
      const percentage = gwaToPercent(val);
      setResult(`${percentage}%`);
      setLabel(getGWALabel(val));
    }
  }, [inputValue, mode]);

  const toggleMode = () => {
    setMode(prev => prev === 'percent-to-gwa' ? 'gwa-to-percent' : 'percent-to-gwa');
    setInputValue('');
  };

  return (
    <Card className="neumorphic-card border-none overflow-hidden">
      <CardContent className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ctu-gold/10 flex items-center justify-center text-ctu-gold">
              <Calculator size={20} />
            </div>
            <h3 className="text-xl font-bold tracking-tight">Grade Converter</h3>
          </div>
          <button 
            onClick={toggleMode}
            className="p-2.5 rounded-xl neumorphic-raised hover:neumorphic-pressed text-ctu-gold transition-all tap-target"
            aria-label="Switch conversion mode"
          >
            <ArrowRightLeft size={18} />
          </button>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-foreground/40 ml-1">
              {mode === 'percent-to-gwa' ? 'Grade Percentage (%)' : 'GWA Value (1.0 - 5.0)'}
            </Label>
            <div className="relative">
              <Input 
                type="number"
                step={mode === 'percent-to-gwa' ? "1" : "0.25"}
                min={mode === 'percent-to-gwa' ? "50" : "1.0"}
                max={mode === 'percent-to-gwa' ? "100" : "5.0"}
                placeholder={mode === 'percent-to-gwa' ? "e.g. 95" : "e.g. 1.5"}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="h-14 bg-background border-none neumorphic-pressed rounded-2xl pl-6 pr-12 text-lg font-bold focus-ring"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/20 font-black">
                {mode === 'percent-to-gwa' ? '%' : 'GWA'}
              </div>
            </div>
          </div>

          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-foreground/5" />
            </div>
            <div className="relative flex justify-center">
              <div className="bg-background px-4">
                <RefreshCcw size={16} className="text-foreground/20 animate-spin-slow" />
              </div>
            </div>
          </div>

          <div className="neumorphic-pressed rounded-2xl p-6 text-center transition-all bg-gradient-to-br from-background to-foreground/[0.02]">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div
                  key="result"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="space-y-2"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Equivalent Result</p>
                  <p className={cn(
                    "text-5xl font-black tracking-tighter",
                    mode === 'percent-to-gwa' ? getGWAColor(parseFloat(result)) : "text-foreground"
                  )}>
                    {result}
                  </p>
                  <div className="pt-2">
                    <Badge className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-4 py-1",
                      label === 'Excellent' ? 'bg-emerald-500 text-white' : 
                      label === 'Good' ? 'bg-blue-500 text-white' :
                      label === 'Passed' ? 'bg-ctu-gold text-white' : 'bg-ctu-maroon text-white'
                    )}>
                      {label}
                    </Badge>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-6 flex flex-col items-center justify-center text-foreground/20"
                >
                  <Info size={40} className="mb-3 opacity-20" />
                  <p className="text-xs font-bold uppercase tracking-widest">Enter a value above</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-foreground/5">
          <p className="text-[9px] text-foreground/30 font-medium leading-relaxed uppercase tracking-wider">
            Official CTU Grading System. Values are estimated based on standard institutional conversion tables.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
