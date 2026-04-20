import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
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
  X
} from 'lucide-react';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User, Subject, SubjectStatus, YearLevel, Progress } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
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
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const getYearSubjects = (year: YearLevel) => {
    return IE_SUBJECTS.filter(s => {
      const matchesYear = s.yearLevel === year;
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            s.code.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesYear && matchesSearch;
    });
  };
  
  const getStats = () => {
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

    const gwa = totalUnits > 0 ? (totalWeightedGrade / totalUnits).toFixed(2) : '0.00';
    
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

    return { total, done, inProgress, percent, gwa, totalUnits, trendData };
  };

  const stats = getStats();

  if (authLoading || progressLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={user} />
      
      <main className="flex-1 p-6 lg:p-10 pb-32 lg:pb-10 overflow-x-hidden">
        <div className="mb-10">
          <h1 className="text-4xl frosted-header font-bold tracking-tight">My Progress</h1>
          <p className="text-foreground/60 mt-1 text-sm font-medium">Track your academic journey through the IE curriculum.</p>
        </div>

        {/* Overall Progress Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <Card className="neumorphic-card border-none lg:col-span-1 flex flex-col items-center justify-center p-8">
            <div className="relative w-40 h-40 mb-6">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                <circle
                  className="text-foreground/5 stroke-current"
                  strokeWidth="8"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                />
                <motion.circle
                  className="text-ctu-gold stroke-current"
                  strokeWidth="8"
                  strokeLinecap="round"
                  fill="transparent"
                  r="40"
                  cx="50"
                  cy="50"
                  initial={{ strokeDasharray: "251.2", strokeDashoffset: "251.2" }}
                  animate={{ strokeDashoffset: 251.2 - (251.2 * stats.percent) / 100 }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-display font-bold text-foreground">{stats.percent}%</span>
                <span className="text-[8px] uppercase font-bold text-foreground/40 tracking-widest">Done</span>
              </div>
            </div>
            
            <div className="w-full h-[120px] mt-4">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={stats.trendData}>
                   <defs>
                     <linearGradient id="colorGwa" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#C5A059" stopOpacity={0.3}/>
                       <stop offset="95%" stopColor="#C5A059" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <ReTooltip 
                     content={({ active, payload }) => {
                       if (active && payload && payload.length) {
                         return (
                           <div className="bg-background/95 backdrop-blur-md p-2 rounded-lg neumorphic-card border-none shadow-xl text-[10px] font-bold">
                             <p className="text-ctu-gold uppercase">{payload[0].payload.name}</p>
                             <p className="text-foreground">GWA: {payload[0].value}</p>
                           </div>
                         );
                       }
                       return null;
                     }}
                   />
                   <Area type="monotone" dataKey="gwa" stroke="#C5A059" strokeWidth={3} fillOpacity={1} fill="url(#colorGwa)" />
                 </AreaChart>
               </ResponsiveContainer>
               <p className="text-center text-[9px] font-bold text-foreground/30 uppercase mt-2 tracking-widest">GWA Performance Trend</p>
            </div>
          </Card>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="neumorphic-card border-none p-8 flex flex-col justify-center bg-ctu-gold/5 border border-ctu-gold/20">
              <div className="p-3 rounded-2xl neumorphic-pressed w-fit mb-4 text-ctu-gold">
                <Calculator size={24} />
              </div>
              <p className="text-4xl font-bold text-foreground">{stats.gwa}</p>
              <p className="text-xs text-foreground/40 font-bold uppercase tracking-widest mt-1">Overall GWA</p>
              <p className="text-[10px] text-foreground/30 mt-2 italic">Based on {stats.totalUnits} graded units</p>
            </Card>

            {[
              { label: 'Done', value: stats.done, color: 'text-green-500', icon: CheckCircle2 },
              { label: 'In Progress', value: stats.inProgress, color: 'text-ctu-gold', icon: Clock },
            ].map((stat, i) => (
              <Card key={i} className="neumorphic-card border-none p-8 flex flex-col justify-center">
                <div className={cn("p-3 rounded-2xl neumorphic-pressed w-fit mb-4", stat.color)}>
                  <stat.icon size={24} />
                </div>
                <p className="text-4xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-foreground/40 font-bold uppercase tracking-widest mt-1">{stat.label}</p>
              </Card>
            ))}
            
            <Card 
              onClick={() => navigate('/study')}
              className="neumorphic-card border-none p-6 md:col-span-3 flex items-center gap-4 bg-ctu-maroon/5 border border-ctu-maroon/10 cursor-pointer hover:bg-ctu-maroon/10 transition-colors"
            >
              <div className="p-2 rounded-xl neumorphic-pressed text-ctu-maroon">
                <GraduationCap size={24} />
              </div>
              <p className="text-sm text-foreground/70 font-medium">
                Academic Tips: Aim for <b className="text-ctu-gold font-bold">1.50</b> or higher to be a Consistent Dean's Lister. 
                <span className="block text-xs mt-1 text-foreground/40 font-bold tracking-tight uppercase">Input your grades in the subject list below to calculate GWA.</span>
              </p>
            </Card>
          </div>
        </div>

        {/* Year-by-Year Breakdown */}
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
            <h2 className="text-2xl font-display font-bold text-foreground whitespace-nowrap">Year-by-Year Breakdown</h2>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={16} />
              <Input 
                placeholder="Find a subject..." 
                className="bg-background border-none neumorphic-pressed pl-10 pr-10 h-11 rounded-xl focus:ring-ctu-gold"
                value={searchQuery}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchQuery('');
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full hover:bg-foreground/5 text-foreground/40"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <Accordion className="space-y-6">
            {(['1st', '2nd', '3rd', '4th'] as YearLevel[]).map((year) => {
              const subjects = getYearSubjects(year);
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
                                grade <= 3.0 ? "bg-green-500/20 text-green-500" : "bg-ctu-maroon/20 text-ctu-maroon"
                              )}>
                                {grade <= 3.0 ? "Passed" : "Failed"}
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
