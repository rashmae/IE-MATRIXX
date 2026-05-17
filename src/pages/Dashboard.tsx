import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  BookOpen, 
  TrendingUp, 
  FolderOpen, 
  Megaphone, 
  CalendarDays,
  Search,
  ChevronRight,
  Clock,
  Filter,
  X,
  Trophy,
  Cpu,
  FlaskConical as FlaskConIcon,
  Bell,
  Calculator,
  FlaskConical,
  Monitor,
  Building2,
  Coins,
  Dumbbell,
  Shield,
  ShieldCheck,
  PenTool,
  BarChart,
  MessageSquare,
  User as UserIcon,
  Music,
  Variable,
  Settings,
  Factory,
  Beaker,
  Table,
  Users,
  Globe,
  Lightbulb,
  FunctionSquare,
  Timer,
  Database,
  Activity,
  Earth,
  Smartphone,
  Users2,
  BarChart3,
  CheckCircle,
  Armchair,
  GanttChart,
  Briefcase,
  Thermometer,
  Rocket,
  HardHat,
  Layout,
  UserCircle,
  FileEdit,
  Layers,
  BookText,
  Leaf,
  Building,
  ClipboardCheck,
  Truck,
  Share2,
  Box,
  Zap,
  Waves,
  Book,
  Flag,
  ShieldAlert,
  UserPlus,
  Compass,
  Copyright,
  Palette,
  Atom
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useProgress } from '@/src/hooks/useProgress';
import { useDebounce } from '@/src/hooks/useDebounce';
import { useLocalStorage } from '@/src/hooks/useLocalStorage';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { Subject, Announcement, CalendarEvent, YearLevel } from '@/src/types/index';
import { IE_SUBJECTS, ANNOUNCEMENTS, CALENDAR_EVENTS } from '@/src/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GlowCard } from '@/components/ui/spotlight-card';
import { Label } from '@/components/ui/label';
import { HeaderSkeleton, StatSkeleton, CardSkeleton } from '@/src/components/SkeletonLoader';
import { cn } from '@/src/lib/utils';
import { BrainCircuit } from 'lucide-react';
import { toast } from 'sonner';

import MobileHeader from '@/src/components/layout/MobileHeader';
import NotificationsList from '@/src/components/layout/NotificationsList';

export default function Dashboard() {
  const { profile, loading: authLoading } = useAuth();
  const { progressMap, loading: progressLoading } = useProgress();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedYear, setSelectedYear] = useLocalStorage<YearLevel | 'All'>('dashboard-year-filter', 'All');
  const [showOnlyRemaining, setShowOnlyRemaining] = useState(false);
  const navigate = useNavigate();
  
  // Icon Renderer Component
  const SubjectIcon = ({ iconName, className }: { iconName?: string; className?: string }) => {
    const icons: Record<string, any> = {
      Calculator, FlaskConical, Monitor, Building2, Coins, Cpu, Dumbbell, Shield, 
      ShieldCheck, PenTool, BarChart, BookOpen, MessageSquare, User: UserIcon, Music, 
      Variable, Settings, Factory, Beaker, Table, Users, Globe, Lightbulb, 
      Trophy, FunctionSquare, Timer, Database, Activity, TrendingUp, Earth, 
      Smartphone, Users2, BarChart3, CheckCircle, Armchair, GanttChart, 
      Briefcase, Thermometer, Rocket, HardHat, Layout, UserCircle, FileEdit, 
      Megaphone, Layers, BookText, Leaf, Building, ClipboardCheck, Truck, 
      Share2, Box, Zap, Waves, Book, Flag, ShieldAlert, UserPlus, Compass, 
      Copyright, Palette, Atom
    };
    
    const IconComponent = iconName ? icons[iconName] : BookText;
    return IconComponent ? <IconComponent className={className} /> : <BookText className={className} />;
  };

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login');
    }
  }, [profile, authLoading, navigate]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  const subjectsByYear = useMemo(() => ({
    '1st': IE_SUBJECTS.filter(s => s.yearLevel === '1st'),
    '2nd': IE_SUBJECTS.filter(s => s.yearLevel === '2nd'),
    '3rd': IE_SUBJECTS.filter(s => s.yearLevel === '3rd'),
    '4th': IE_SUBJECTS.filter(s => s.yearLevel === '4th'),
  }), []);

  const stats = useMemo(() => {
    const total = IE_SUBJECTS.length;
    const items = Object.values(progressMap);
    const done = items.filter(s => s.status === 'done').length;
    const inProgress = items.filter(s => s.status === 'in_progress').length;
    
    let totalWeightedGrade = 0;
    let gradedUnits = 0;
    
    IE_SUBJECTS.forEach(s => {
      const p = progressMap[s.id];
      if (p?.status === 'done' && p.grade) {
        totalWeightedGrade += p.grade * s.units;
        gradedUnits += s.units;
      }
    });

    const gwa = gradedUnits > 0 ? (totalWeightedGrade / gradedUnits).toFixed(2) : '0.00';
    return { total, done, inProgress, gwa };
  }, [progressMap]);

  const filteredSubjects = useMemo(() => {
    return IE_SUBJECTS.filter(s => {
      const matchesSearch = 
        s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        s.code.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        s.department?.toLowerCase().includes(debouncedSearch.toLowerCase());
      
      const matchesYear = selectedYear === 'All' || s.yearLevel === selectedYear;
      
      const isCompleted = progressMap[s.id]?.status === 'done';
      const matchesRemaining = !showOnlyRemaining || !isCompleted;
      
      return matchesSearch && matchesYear && matchesRemaining;
    });
  }, [debouncedSearch, selectedYear, showOnlyRemaining, progressMap]);

  const isFilterActive = debouncedSearch !== '' || selectedYear !== 'All' || showOnlyRemaining;

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedYear('All');
    setShowOnlyRemaining(false);
  };

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
        <Sidebar user={null} />
        <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
          <HeaderSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
                <StatSkeleton />
              </div>
              <div className="neumorphic-card p-10 h-64 animate-pulse">
                <div className="h-full flex items-center justify-center opacity-10 font-bold uppercase tracking-tighter text-4xl">Analyzing Matrix...</div>
              </div>
            </div>
            <div className="space-y-8">
              <div className="neumorphic-card p-6 h-96 animate-pulse" />
            </div>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={profile} />
      
      <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
        <MobileHeader />

        {/* Enhanced Header Section */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-10 mb-12 p-8 sm:p-10 rounded-[2.5rem] bg-foreground/[0.02] border border-white/5 neumorphic-raised relative overflow-hidden group/header transition-all duration-500">
          {/* Decorative Polish */}
          <div className="absolute -right-24 -top-24 w-80 h-80 bg-ctu-gold/5 rounded-full blur-[100px] opacity-0 group-hover/header:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          <div className="absolute -left-24 -bottom-24 w-80 h-80 bg-ctu-maroon/5 rounded-full blur-[100px] opacity-0 group-hover/header:opacity-100 transition-opacity duration-1000 pointer-events-none" />
          
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="relative z-10 flex flex-col gap-4"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-ctu-gold/60 leading-none">MATRIX ONLINE</span>
              </div>
              <h1 
                className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl frosted-header font-black tracking-tighter transition-all duration-500 hover:[text-shadow:_0_1px_40px_rgba(212,175,55,0.3)] leading-none"
              >
                {getGreeting()}, <span className="text-ctu-gold">{profile.fullName.split(' ')[0]}</span> 👋
              </h1>
              <p className="text-foreground/40 mt-3 text-xs sm:text-base md:text-xl font-medium tracking-tight max-w-lg leading-relaxed">
                Welcome back to your Industrial Engineering portal. Here's your current curriculum overview.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-2">
               <button 
                  onClick={() => navigate('/progress')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ctu-maroon/10 border border-ctu-maroon/20 text-ctu-maroon text-[10px] font-bold uppercase tracking-wider hover:bg-ctu-maroon hover:text-white transition-all active:scale-95"
                >
                  <TrendingUp size={14} />
                  View Analytics
                </button>
                <div className="h-4 w-px bg-foreground/10" />
                <div className="flex -space-x-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-6 h-6 rounded-full border-2 border-background bg-foreground/5 flex items-center justify-center">
                      <UserIcon size={10} className="text-foreground/40" />
                    </div>
                  ))}
                  <div className="w-6 h-6 rounded-full border-2 border-background bg-ctu-gold flex items-center justify-center text-[8px] font-bold text-white">
                    +42
                  </div>
                </div>
                <span className="text-[10px] font-bold text-foreground/30 ml-1">IE Students Active</span>
            </div>
          </motion.div>

          <div className="relative z-10 flex flex-col gap-6 w-full xl:w-auto">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="relative flex-1 md:w-80 lg:w-96">
                <Label htmlFor="dashboard-search" className="sr-only">Search subjects</Label>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={18} aria-hidden="true" />
                <input 
                  id="dashboard-search"
                  type="text" 
                  placeholder="Find a subject..." 
                  aria-label="Search subjects"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background/50 border border-white/5 neumorphic-pressed rounded-2xl py-4 pl-12 pr-12 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ctu-gold/30 transition-all text-foreground placeholder:text-foreground/30 backdrop-blur-sm"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full hover:bg-ctu-maroon/10 text-ctu-maroon transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              <button 
                onClick={() => {
                  const url = `/catalog?q=${encodeURIComponent(searchQuery)}${selectedYear !== 'All' ? `&year=${selectedYear}` : ''}`;
                  navigate(url);
                }}
                className="bg-ctu-gold text-white px-10 h-14 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-ctu-gold/20 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
              >
                Search Hub
              </button>
            </div>

            {/* Polished Controls Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-2 neumorphic-pressed rounded-[1.5rem] bg-foreground/[0.01]">
              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                {(['All', '1st', '2nd', '3rd', '4th'] as const).map((year) => {
                  const yearSubjects = year === 'All' ? IE_SUBJECTS : subjectsByYear[year];
                  const completed = yearSubjects.filter(s => progressMap[s.id]?.status === 'done').length;
                  
                  const icons = {
                    'All': <LayoutDashboard size={14} />,
                    '1st': <BookOpen size={14} />,
                    '2nd': <BrainCircuit size={14} />,
                    '3rd': <FolderOpen size={14} />,
                    '4th': <Trophy size={14} />
                  };

                  return (
                    <button
                      key={year}
                      onClick={() => setSelectedYear(year)}
                      className={cn(
                        "group relative flex items-center gap-2.5 px-4 h-11 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                        selectedYear === year 
                          ? "bg-ctu-gold text-white shadow-lg shadow-ctu-gold/20" 
                          : "text-foreground/40 hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      {icons[year as keyof typeof icons]}
                      <span>{year === 'All' ? 'Library' : `${year} Yr`}</span>
                      {completed > 0 && selectedYear !== year && (
                         <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 pl-2 border-l border-foreground/10 shrink-0">
                <button
                  onClick={() => setShowOnlyRemaining(!showOnlyRemaining)}
                  className={cn(
                    "flex items-center gap-2 h-11 px-5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                    showOnlyRemaining 
                      ? "bg-ctu-maroon text-white shadow-lg shadow-ctu-maroon/20" 
                      : "text-foreground/40 hover:text-ctu-maroon"
                  )}
                >
                  <TrendingUp size={14} />
                  Remaining
                </button>
              </div>
            </div>
          </div>
        </div>

        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Total Subjects', value: stats.total.toString(), icon: BookOpen, color: 'text-cyan-500', bg: 'bg-cyan-500/10', path: '/catalog' },
                { label: 'Completed', value: stats.done.toString(), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', path: '/progress' },
                { label: 'In Progress', value: stats.inProgress.toString(), icon: Clock, color: 'text-ctu-maroon', bg: 'bg-ctu-maroon/10', path: '/progress' },
                { label: 'Standing', value: `GWA ${stats.gwa}`, icon: LayoutDashboard, color: 'text-ctu-gold', bg: 'bg-ctu-gold/10', path: '/progress' },
              ].map((stat, i) => (
                <motion.div key={i} variants={itemVariants}>
                  <Card 
                    className="neumorphic-card border-none overflow-hidden hover:scale-[1.02] active:scale-95 transition-all cursor-pointer tap-target h-auto"
                    onClick={() => navigate(stat.path)}
                  >
                    <CardContent className="p-4 sm:p-6 text-center sm:text-left flex flex-col items-center sm:items-start w-full">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors", stat.bg)}>
                        <stat.icon size={20} className={stat.color} />
                      </div>
                      <p className="text-[9px] sm:text-[11px] text-foreground/40 uppercase tracking-[1px] font-bold">{stat.label}</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mt-2">{stat.value}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Year Progress Grid */}
            <motion.div variants={itemVariants} className="neumorphic-card p-10">
              <h3 className="text-4xl font-display font-black text-ctu-gold uppercase tracking-[0.2em] mb-12 border-b border-foreground/5 pb-6">Year Level Progress</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { 
                    id: '1st',
                    year: '1st Year', 
                    subjects: subjectsByYear['1st'],
                    gradient: 'from-ctu-maroon to-pink-400', 
                    badge: 'bg-ctu-maroon',
                    glow: 'shadow-[0_0_15px_rgba(240,100,163,0.3)]'
                  },
                  { 
                    id: '2nd',
                    year: '2nd Year', 
                    subjects: subjectsByYear['2nd'],
                    gradient: 'from-ctu-gold to-purple-400', 
                    badge: 'bg-ctu-gold',
                    glow: 'shadow-[0_0_15px_rgba(146,93,252,0.3)]'
                  },
                  { 
                    id: '3rd',
                    year: '3rd Year', 
                    subjects: subjectsByYear['3rd'],
                    gradient: 'from-cyan-500 to-blue-400', 
                    badge: 'bg-cyan-500',
                    glow: 'shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                  },
                  { 
                    id: '4th',
                    year: '4th Year', 
                    subjects: subjectsByYear['4th'],
                    gradient: 'from-emerald-500 to-teal-400', 
                    badge: 'bg-emerald-500',
                    glow: 'shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                  },
                ].map((year, i) => {
                  const done = year.subjects.filter(s => progressMap[s.id]?.status === 'done').length;
                  const progress = Math.round((done / year.subjects.length) * 100);
                  
                  return (
                    <div 
                      key={i} 
                      onClick={() => setSelectedYear(year.id as YearLevel)}
                      className={cn(
                        "neumorphic-pressed border-none p-6 rounded-2xl flex flex-col justify-between group cursor-pointer transition-all active:scale-95",
                        selectedYear === year.id && "bg-foreground/5 shadow-inner"
                      )}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className={cn(
                          "text-[9px] px-3 py-1 rounded-lg font-bold uppercase tracking-wider text-white",
                          year.badge
                        )}>
                          {year.year}
                        </span>
                        <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest">{done}/{year.subjects.length} DONE</span>
                      </div>
                      <div className="text-3xl font-black text-foreground mt-2 tracking-tighter">{progress}%</div>
                      <div className="h-2.5 bg-foreground/5 rounded-full mt-6 overflow-hidden relative">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1, delay: 0.5 + i * 0.1, ease: "easeOut" }}
                          className={cn(
                            "h-full rounded-full transition-all duration-500 bg-gradient-to-r",
                            year.gradient,
                            year.glow
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Dynamic Results Area */}
            <motion.div variants={itemVariants} className="space-y-10 mt-12">
              <div className="flex items-center justify-between">
                <h3 className="text-xl sm:text-2xl md:text-4xl font-display font-black tracking-tight frosted-header">
                  {isFilterActive ? `Search Results (${filteredSubjects.length})` : 'Recommended for You'}
                </h3>
                <div className="flex gap-2 min-w-0">
                  {isFilterActive && (
                    <button 
                      onClick={clearFilters}
                      className="text-xs font-bold text-foreground/40 hover:text-foreground/60 transition-colors bg-foreground/5 px-3 py-1.5 rounded-lg flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <X size={12} /> Clear Filters
                    </button>
                  )}
                  <div className="flex items-center gap-1 ml-2">
                    <button 
                      onClick={() => {
                        const el = document.getElementById('horizontal-scroll-container');
                        if (el) el.scrollBy({ left: -300, behavior: 'smooth' });
                      }}
                      className="p-2 rounded-full neumorphic-raised hover:neumorphic-pressed text-foreground/40 hover:text-ctu-gold transition-all"
                      aria-label="Scroll left"
                    >
                      <ChevronRight size={16} className="rotate-180" />
                    </button>
                    <button 
                      onClick={() => {
                        const el = document.getElementById('horizontal-scroll-container');
                        if (el) el.scrollBy({ left: 300, behavior: 'smooth' });
                      }}
                      className="p-2 rounded-full neumorphic-raised hover:neumorphic-pressed text-foreground/40 hover:text-ctu-gold transition-all"
                      aria-label="Scroll right"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  {!isFilterActive && (
                    <button 
                      onClick={() => navigate('/catalog')}
                      className="text-ctu-gold text-[10px] sm:text-sm font-bold flex items-center gap-1 hover:underline px-2 whitespace-nowrap"
                    >
                      View Library <ChevronRight size={12} className="sm:size-4" />
                    </button>
                  )}
                </div>
              </div>

              {filteredSubjects.length > 0 ? (
                <div className="relative group/scroll">
                   <div 
                    id="horizontal-scroll-container"
                    className="flex gap-4 sm:gap-6 overflow-x-auto pb-10 px-4 sm:px-6 scroll-smooth snap-x snap-mandatory overscroll-x-contain"
                  >
                    {filteredSubjects.slice(0, 10).map((subject, idx) => {
                      const isDone = progressMap[subject.id]?.status === 'done';
                      const yearColors: Record<string, string> = {
                        '1st': 'border-l-ctu-maroon',
                        '2nd': 'border-l-ctu-gold',
                        '3rd': 'border-l-cyan-500',
                        '4th': 'border-l-emerald-500'
                      };
                      
                      return (
                        <GlowCard 
                          key={subject.id} 
                          glowColor={idx % 2 === 0 ? 'blue' : 'orange'}
                          customSize
                          className={cn(
                            "w-56 sm:w-64 md:w-72 shrink-0 min-h-[180px] h-auto hover:scale-[1.05] transition-all cursor-pointer border-none flex flex-col justify-between snap-start tap-target rounded-3xl p-5 overflow-hidden border-l-4",
                            yearColors[subject.yearLevel] || 'border-l-foreground/10'
                          )}
                          onClick={() => navigate(`/catalog/${subject.id}`)}
                        >
                          <div className="relative z-10 w-full min-w-0">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex gap-2">
                                <div className="w-8 h-8 rounded-lg bg-ctu-gold/10 flex items-center justify-center text-ctu-gold shrink-0">
                                  <SubjectIcon iconName={subject.icon} className="w-4 h-4" />
                                </div>
                                <Badge variant="outline" className="border-ctu-gold text-ctu-gold text-[10px] font-bold bg-ctu-gold/5 max-w-[80%] truncate h-8 flex items-center">
                                  {subject.code}
                                </Badge>
                              </div>
                              {isDone && (
                                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 mt-1.5">
                                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-3 h-3">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  </motion.div>
                                </div>
                              )}
                            </div>
                            <h4 className="font-bold text-foreground text-clamp-2 text-sm sm:text-base leading-tight mb-2">
                              {subject.name}
                            </h4>
                            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider text-clamp-1">
                              {subject.department || 'IE Department'}
                            </p>
                          </div>
                          
                          <div className="relative z-10 flex justify-between items-center mt-4 pt-3 border-t border-foreground/5">
                            <p className="text-[10px] sm:text-xs text-foreground/60 font-medium">
                              {subject.units} Units · {subject.semester}
                            </p>
                            <ChevronRight size={14} className="text-foreground/40 shrink-0" />
                          </div>
                        </GlowCard>
                      );
                    })}
                  </div>
                  {/* Subtle mobile scroll hint gradient on the right */}
                  <div className="absolute top-0 right-0 bottom-10 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden z-20" />
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="neumorphic-pressed rounded-3xl p-12 text-center"
                >
                  <div className="w-20 h-20 bg-foreground/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search size={32} className="text-foreground/20" />
                  </div>
                  <h4 className="text-lg font-bold text-foreground mb-2">No subjects found</h4>
                  <p className="text-sm text-foreground/40 max-w-xs mx-auto mb-6">
                    We couldn't find any subjects matching "{searchQuery}" in {selectedYear === 'All' ? 'any year level' : selectedYear + ' Year'}.
                  </p>
                  <button 
                    onClick={clearFilters}
                    className="bg-ctu-gold text-white font-bold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity text-sm"
                  >
                    Reset all filters
                  </button>
                </motion.div>
              )}
            </motion.div>
          </div>

          {/* Right Panel */}
          <div className="space-y-8">
            {/* Recent Notifications */}
            <motion.div variants={itemVariants}>
              <Card className="neumorphic-card border-none">
                <CardHeader className="pb-6 border-b border-foreground/5 mb-6 flex flex-row items-center justify-between">
                  <CardTitle className="text-3xl font-black text-ctu-maroon uppercase tracking-[0.2em]">
                    Alerts
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => navigate('/notifications')}
                    className="text-[10px] font-black uppercase tracking-widest text-foreground/40 hover:text-ctu-maroon"
                  >
                    View All
                  </Button>
                </CardHeader>
                <CardContent>
                  <NotificationsList maxItems={3} />
                </CardContent>
              </Card>
            </motion.div>

            {/* Calendar Widget */}
            <motion.div variants={itemVariants}>
              <Card className="neumorphic-card border-none">
                <CardHeader className="pb-6 border-b border-foreground/5 mb-6">
                  <CardTitle className="text-3xl flex items-center gap-3 font-black uppercase tracking-tight">
                    <CalendarDays size={32} className="text-ctu-gold" />
                    Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {CALENDAR_EVENTS.map((event) => (
                    <div 
                      key={event.id} 
                      onClick={() => navigate('/calendar')}
                      className="flex gap-4 items-start p-4 rounded-2xl neumorphic-raised hover:neumorphic-pressed transition-all cursor-pointer"
                    >
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-xl neumorphic-pressed shrink-0">
                        <span className="text-[10px] font-bold uppercase text-foreground/40">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                        <span className="text-lg font-bold text-foreground leading-none">{new Date(event.date).getDate()}</span>
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-foreground">{event.title}</h5>
                        <p className="text-xs text-foreground/40 font-medium line-clamp-1">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Announcements */}
            <motion.div variants={itemVariants}>
              <Card className="neumorphic-card border-none">
                <CardHeader className="pb-6 border-b border-foreground/5 mb-6">
                  <CardTitle className="text-3xl font-black text-ctu-gold uppercase tracking-[0.2em]">
                    Bulletin
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ANNOUNCEMENTS.map((ann) => (
                    <div 
                      key={ann.id} 
                      onClick={() => toast.info(`Bulletin: ${ann.title}`, { description: 'Full announcement details are available at the Registrar office.' })}
                      className={cn(
                        "p-5 rounded-2xl neumorphic-raised hover:neumorphic-pressed transition-all cursor-pointer border-l-4",
                        ann.category === 'academic' ? 'border-ctu-maroon' :
                        ann.category === 'event' ? 'border-ctu-gold' :
                        ann.category === 'holiday' ? 'border-blue-600' : 'border-green-600'
                      )}
                    >
                      <h5 className="text-[13px] font-bold text-foreground mb-1">{ann.title}</h5>
                      <p className="text-[11px] text-foreground/40 font-bold uppercase tracking-wider">
                        {new Date(ann.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • {ann.category}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </main>

      <BottomNav />
    </div>
  );
}
