import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Circle,
  ChevronDown,
  ChevronUp,
  Info,
  Link as LinkIcon,
  AlertCircle,
  Calculator,
  GraduationCap,
  Search,
  X,
  Trophy
} from 'lucide-react';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User, Subject, SubjectStatus, YearLevel } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { useDebounce } from '@/src/hooks/useDebounce';
import { HeaderSkeleton, StatSkeleton, GridSkeleton } from '@/src/components/SkeletonLoader';
import { 
  getGWAEquivalent, 
  getGWALabel, 
  getGWAColor, 
  getGWAHexColor,
  LATIN_HONORS
} from '@/src/lib/gradeUtils';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReTooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { db, auth } from '@/src/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/src/context/AuthContext';
import { useProgress } from '@/src/hooks/useProgress';

const GRADES = [1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 5.0];

export default function ProgressPage() {
  const { profile: user, loading: authLoading } = useAuth();
  const { progressMap, loading: progressLoading, updateProgress, toggleStatus, setGrade } = useProgress();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  /**
   * Optimized subject filter per year
   */
  const yearSubjectsMap = useMemo(() => {
    const map: Record<YearLevel, Subject[]> = {
      '1st': [], '2nd': [], '3rd': [], '4th': []
    };
    
    IE_SUBJECTS.forEach(s => {
      const matchesSearch = s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                            s.code.toLowerCase().includes(debouncedSearch.toLowerCase());
      if (matchesSearch) {
        map[s.yearLevel as YearLevel].push(s);
      }
    });
    
    return map;
  }, [debouncedSearch]);
  
  const stats = useMemo(() => {
    const total = IE_SUBJECTS.length;
    const items = Object.values(progressMap);
    const done = items.filter(s => s.status === 'done').length;
    const inProgress = items.filter(s => s.status === 'in_progress').length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    // GWA Calculation: Sum(Grade * Units) / Sum(Units)
    let totalWeightedGrade = 0;
    let totalUnits = 0;
    
    IE_SUBJECTS.forEach(s => {
      const p = progressMap[s.id];
      if (p?.status === 'done' && p.grade) {
        totalWeightedGrade += p.grade * s.units;
        totalUnits += s.units;
      }
    });

    const gwa = totalUnits > 0 ? parseFloat((totalWeightedGrade / totalUnits).toFixed(2)) : 0;
    
    // Trend Data for Chart
    const trendData = (['1st', '2nd', '3rd', '4th'] as YearLevel[]).map(year => {
      let yrWeighted = 0;
      let yrUnits = 0;
      IE_SUBJECTS.filter(s => s.yearLevel === year).forEach(s => {
        const p = progressMap[s.id];
        if (p?.status === 'done' && p.grade) {
          yrWeighted += p.grade * s.units;
          yrUnits += s.units;
        }
      });
      return {
        name: `${year} Year`,
        gwa: yrUnits > 0 ? parseFloat((yrWeighted / yrUnits).toFixed(2)) : null
      };
    }).filter(d => d.gwa !== null);

    const latinHonor = LATIN_HONORS.find(h => gwa >= h.min && gwa <= h.max);

    return { total, done, inProgress, percent, gwa, totalUnits, trendData, latinHonor };
  }, [progressMap]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
        <Sidebar user={null} />
        <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
          <HeaderSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
            <div className="lg:col-span-2 h-64 neumorphic-card animate-pulse" />
            <div className="lg:col-span-2 grid grid-cols-2 gap-6">
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
              <StatSkeleton />
            </div>
          </div>
          <GridSkeleton count={4} />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={user} />
      
      <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
        <div className="mb-12">
          <h1 className="text-4xl sm:text-6xl md:text-8xl frosted-header font-black tracking-tighter leading-[0.9] py-2">My Progress</h1>
          <p className="text-foreground/40 mt-3 text-xl font-medium tracking-tight">Track your academic journey through the IE curriculum.</p>
        </div>

        {/* Overall Progress Header */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-12">
          {/* GWA Card - THE HERO */}
          <Card className="lg:col-span-2 neumorphic-card border-none bg-gradient-to-br from-ctu-gold/10 via-background to-background relative overflow-hidden p-1">
             <div className="absolute inset-0 bg-ctu-gold/5 animate-pulse" />
             <div className="relative z-10 p-8 h-full flex flex-col items-center justify-between text-center">
                <div className="space-y-1">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-ctu-gold">Combined Academic GWA</h3>
                  <div className="flex items-center justify-center gap-3">
                    <span className="text-5xl sm:text-7xl font-display font-black text-foreground">{stats.gwa || '0.00'}</span>
                    <div className="flex flex-col items-start">
                      <Badge className={cn("text-[9px] font-bold uppercase", getGWAColor(stats.gwa) === 'text-ctu-gold' ? 'bg-ctu-gold text-white' : 'bg-foreground/10')}>
                         {getGWALabel(stats.gwa)}
                      </Badge>
                      <span className="text-[10px] text-foreground/40 font-bold mt-1">{stats.totalUnits} Units Tracked</span>
                    </div>
                  </div>
                </div>

                <div className="my-8 w-full">
                  {stats.latinHonor ? (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="glass-card border-ctu-gold/30 bg-ctu-gold/5 py-4 px-6 flex items-center justify-center gap-3"
                    >
                      <Trophy className="text-ctu-gold" size={24} />
                      <div className="text-left">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-ctu-gold">Current Standing</p>
                        <p className="text-lg font-display font-bold leading-tight">{stats.latinHonor.label}</p>
                      </div>
                    </motion.div>
                  ) : stats.gwa > 0 && stats.gwa <= 3.0 ? (
                    <div className="text-foreground/60 text-sm font-medium italic">
                       "Excellence is not an act, but a habit. Keep striving for institutional excellence."
                    </div>
                  ) : (
                    <div className="text-foreground/30 text-xs font-bold uppercase tracking-widest">
                       Input your first grades to begin evaluation
                    </div>
                  )}
                </div>

                <div className="w-full flex items-center justify-between pt-6 border-t border-foreground/5">
                   <div className="text-left">
                      <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Target Honor</p>
                      <p className="text-xs font-bold">Summa Cum Laude (1.20)</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest">Min. Units Left</p>
                      <p className="text-xs font-bold">~{164 - stats.totalUnits} Units</p>
                   </div>
                </div>
             </div>
          </Card>

          {/* Stats Column */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-6">
             <Card className="neumorphic-card border-none p-6 flex flex-col justify-center items-center text-center">
                <div className="relative w-28 h-28 mb-4">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle className="text-foreground/5 stroke-current" strokeWidth="8" fill="transparent" r="40" cx="50" cy="50" />
                    <motion.circle className="text-ctu-gold stroke-current" strokeWidth="8" strokeLinecap="round" fill="transparent" r="40" cx="50" cy="50"
                      initial={{ strokeDasharray: "251.2", strokeDashoffset: 251.2 }}
                      animate={{ strokeDashoffset: 251.2 - (251.2 * stats.percent) / 100 }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-bold text-foreground">{stats.percent}%</span>
                    <span className="text-[7px] uppercase font-bold text-foreground/40">Curriculum</span>
                  </div>
                </div>
                <p className="text-xs font-bold uppercase tracking-widest text-foreground/40">Overall Done</p>
             </Card>

             <Card className="neumorphic-card border-none p-6 flex flex-col justify-center">
                <div className="h-full space-y-4">
                  <div>
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Performance Trend</span>
                      <TrendingUp size={12} className="text-ctu-gold" />
                    </div>
                    <div className="h-20 w-full overflow-hidden">
                      <ResponsiveContainer width="100%" height={80} minWidth={0}>
                        <LineChart data={stats.trendData}>
                          <Line type="monotone" dataKey="gwa" stroke="#925dfc" strokeWidth={3} dot={{ fill: '#925dfc', r: 3 }} />
                          <ReTooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-background/95 backdrop-blur-md p-2 rounded-lg border border-white/5 shadow-xl text-[10px] font-bold">
                                    <p className="text-ctu-gold">{payload[0].payload.name}</p>
                                    <p className="text-foreground">GWA: {payload[0].value}</p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-foreground/5">
                     <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-500" />
                        <div>
                          <p className="text-sm font-bold leading-none">{stats.done}</p>
                          <p className="text-[8px] font-bold text-foreground/40 uppercase">Passed</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-2">
                        <Clock size={16} className="text-ctu-gold" />
                        <div>
                          <p className="text-sm font-bold leading-none">{stats.inProgress}</p>
                          <p className="text-[8px] font-bold text-foreground/40 uppercase">Active</p>
                        </div>
                     </div>
                  </div>
                </div>
             </Card>

             <Card className="col-span-2 neumorphic-card border-none p-6 flex items-center justify-between bg-foreground/5 border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-ctu-maroon/20 rounded-xl text-ctu-maroon">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-none mb-1">Dean's List Readiness</p>
                    <p className="text-[10px] text-foreground/40 font-medium">Maintain a GWA of <b>1.75 or better</b> for honors.</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin-roadmap')} className="text-[10px] font-bold text-ctu-gold uppercase tracking-widest hover:bg-ctu-gold/10">
                   View Roadmap →
                </Button>
             </Card>
          </div>
        </div>

        {/* Year-by-Year Breakdown */}
        <div className="space-y-10 mt-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <h2 className="text-3xl sm:text-4xl font-display font-black text-foreground tracking-tight whitespace-nowrap">Year Breakdown</h2>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={16} />
              <Input 
                placeholder="Find a subject..." 
                className="bg-background border-none neumorphic-pressed pl-10 pr-10 h-11 rounded-xl focus:ring-ctu-gold focus-ring"
                value={searchQuery}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchQuery('');
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full hover:bg-foreground/5 text-foreground/40 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <Accordion className="space-y-6">
            {(['1st', '2nd', '3rd', '4th'] as YearLevel[]).map((year) => {
              const subjects = yearSubjectsMap[year];
              const yearDone = subjects.filter(s => (progressMap[s.id]?.status || 'not_yet') === 'done').length;
              const yearPercent = subjects.length > 0 ? Math.round((yearDone / subjects.length) * 100) : 0;
              
            return (
              <AccordionItem key={year} value={year} className="neumorphic-card border-none rounded-3xl overflow-hidden px-8">
                <AccordionTrigger className="hover:no-underline py-8">
                  <div className="flex flex-1 items-center justify-between pr-6">
                    <div className="flex items-center gap-6">
                      <Badge className={cn(
                        "text-white border-none px-4 py-1 rounded-full text-[10px] uppercase font-bold",
                        year === '1st' ? 'bg-ctu-maroon' : year === '2nd' ? 'bg-ctu-gold' : year === '3rd' ? 'bg-cyan-500 !text-white' : 'bg-emerald-500 !text-white'
                      )}>
                        {year} Year
                      </Badge>
                      <span className="text-xl font-bold text-foreground">{yearDone} / {subjects.length} Subjects</span>
                    </div>
                    <div className="hidden md:flex items-center gap-6 w-72">
                      <div className="flex-1 h-3 neumorphic-pressed rounded-full overflow-hidden">
                        <div className="h-full bg-ctu-gold rounded-full transition-all duration-1000" style={{ width: `${yearPercent}%` }} />
                      </div>
                      <span className="text-xs font-bold text-foreground/40">{yearPercent}%</span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                {subjects.map((subject) => {
                  const p = progressMap[subject.id];
                  const status = p?.status || 'not_yet';
                  const grade = p?.grade;
                  const prerequisites = IE_SUBJECTS.filter(s => subject.prerequisiteIds.includes(s.id));
                  const unmetPrerequisites = prerequisites.filter(pr => (progressMap[pr.id]?.status || 'not_yet') !== 'done');
                  const arePrerequisitesMet = unmetPrerequisites.length === 0;
                  
                  return (
                    <div 
                      key={subject.id}
                      className={cn(
                        "flex items-center justify-between p-6 rounded-2xl transition-all",
                        status === 'done' ? "neumorphic-pressed" : "neumorphic-raised"
                      )}
                    >
                      <div className="flex-1 min-w-0 mr-6">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-bold text-ctu-gold uppercase tracking-widest">{subject.code}</p>
                          {prerequisites.length > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <div className={cn(
                                    "cursor-help p-1 rounded-md",
                                    arePrerequisitesMet ? "text-blue-500" : "text-ctu-maroon animate-pulse"
                                  )}>
                                    <LinkIcon size={12} />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-[10px] space-y-1">
                                    <p className="font-bold border-b border-foreground/5 pb-1 mb-1">Prerequisites:</p>
                                    {prerequisites.map(pr => (
                                      <div key={pr.id} className="flex items-center gap-2">
                                        {(progressMap[pr.id]?.status || 'not_yet') === 'done' ? 
                                          <CheckCircle2 size={10} className="text-green-500" /> : 
                                          <AlertCircle size={10} className="text-ctu-maroon" />
                                        }
                                        <span className={cn(
                                          (progressMap[pr.id]?.status || 'not_yet') === 'done' ? "text-foreground" : "text-foreground/40 font-bold"
                                        )}>
                                          {pr.code}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <p className="text-sm font-bold text-foreground truncate">{subject.name}</p>
                        
                        {status === 'done' && (
                          <div className="mt-3 flex items-center gap-3">
                            <span className="text-[10px] uppercase font-bold text-foreground/30 tracking-widest">Entry Grade (1.0-5.0):</span>
                            <div className="relative w-24">
                              <Input 
                                type="number"
                                step="0.01"
                                min="1.0"
                                max="5.0"
                                placeholder="Grd"
                                value={grade || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val)) {
                                    setGrade(subject.id, val);
                                  } else if (e.target.value === '') {
                                    updateProgress(subject.id, { grade: undefined });
                                  }
                                }}
                                className="h-8 text-[11px] font-bold neumorphic-pressed border-none text-center bg-transparent focus:ring-ctu-gold pr-1"
                              />
                            </div>
                            {grade !== undefined && grade !== null && (
                              <Badge className={cn(
                                "text-[10px] font-bold border-none",
                                grade <= 1.5 ? "bg-emerald-500/20 text-emerald-500" :
                                grade <= 2.25 ? "bg-blue-500/20 text-blue-500" :
                                grade <= 3.0 ? "bg-ctu-gold/20 text-ctu-gold" : "bg-ctu-maroon/20 text-ctu-maroon"
                              )}>
                                {grade <= 1.5 ? "Excellent" : 
                                 grade <= 2.25 ? "Good" :
                                 grade <= 3.0 ? "Passed" : "Failed"}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => toggleStatus(subject.id)}
                        aria-label={`Mark ${subject.code} as ${status === 'not_yet' ? 'In Progress' : status === 'in_progress' ? 'Done' : 'Not Yet'}`}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all whitespace-nowrap",
                          status === 'done' ? "bg-green-500/10 text-green-500 neumorphic-pressed" :
                          status === 'in_progress' ? "bg-ctu-gold/10 text-ctu-gold neumorphic-pressed" :
                          "neumorphic-raised text-foreground/40 hover:text-foreground hover:neumorphic-pressed",
                          (status === 'in_progress' && !arePrerequisitesMet) && "opacity-50 grayscale"
                        )}
                      >
                        {status === 'done' ? <CheckCircle2 size={14} /> :
                         status === 'in_progress' ? <Clock size={14} /> :
                         <Circle size={14} />}
                        {status.replace('_', ' ')}
                      </button>
                    </div>
                  );
                })}
              </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
