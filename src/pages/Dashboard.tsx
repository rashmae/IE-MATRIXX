import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useDebounce } from '@/src/hooks/useDebounce';
import { useLocalStorage } from '@/src/hooks/useLocalStorage';
import { DashboardSkeleton } from '@/src/components/SkeletonLoader';
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
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { useProgress } from '@/src/hooks/useProgress';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { Subject, Announcement, CalendarEvent, YearLevel } from '@/src/types/index';
import { IE_SUBJECTS, ANNOUNCEMENTS, CALENDAR_EVENTS } from '@/src/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GlowCard } from '@/components/ui/spotlight-card';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { BrainCircuit } from 'lucide-react';
import { toast } from 'sonner';

export default function Dashboard() {
  const { profile, loading: authLoading } = useAuth();
  const { progressMap, loading: progressLoading } = useProgress();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedYear, setSelectedYear] = useLocalStorage<YearLevel | 'All'>('dashboard-year-filter', 'All');
  const [showOnlyRemaining, setShowOnlyRemaining] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!authLoading && !profile) navigate('/login');
  }, [profile, authLoading, navigate]);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedYear('All');
    setShowOnlyRemaining(false);
  }, [setSelectedYear]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };

  const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };

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
    let totalWeightedGrade = 0, gradedUnits = 0;
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

  const filteredSubjects = useMemo(() => IE_SUBJECTS.filter(s => {
    const q = debouncedSearch.toLowerCase();
    const matchesSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      s.department?.toLowerCase().includes(q) ||
      s.professor?.toLowerCase().includes(q);
    const matchesYear = selectedYear === 'All' || s.yearLevel === selectedYear;
    const isCompleted = progressMap[s.id]?.status === 'done';
    return matchesSearch && matchesYear && (!showOnlyRemaining || !isCompleted);
  }), [debouncedSearch, selectedYear, showOnlyRemaining, progressMap]);

  const isFilterActive = debouncedSearch !== '' || selectedYear !== 'All' || showOnlyRemaining;

  if (authLoading || progressLoading || !profile) {
    return (
      <div className="min-h-screen bg-background text-foreground flex">
        <Sidebar user={null} />
        <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
          <DashboardSkeleton />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={profile} />
      
      <main id="main-content" className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-4 sm:gap-6"
          >
            {/* AI Robot Logo */}
            <div className="relative w-16 h-16 sm:w-24 sm:h-24 shrink-0" aria-hidden="true">
              <div className="absolute inset-0 bg-ctu-gold/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-full h-full neumorphic-raised rounded-full p-1 flex items-center justify-center bg-background overflow-hidden border border-white/10 scale-90">
                <div className="absolute inset-0 border-2 border-ctu-gold/30 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-ctu-gold via-ctu-maroon to-navy-deep flex items-center justify-center shadow-inner">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] flex items-center justify-center"
                  >
                    <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-navy-deep flex items-center justify-center">
                      <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-ctu-gold animate-ping" />
                    </div>
                  </motion.div>
                </div>
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl frosted-header font-black tracking-tighter leading-none truncate">
                {getGreeting()}, {profile.fullName.split(' ')[0]} 👋
              </h1>
              <p className="text-foreground/40 mt-2 text-sm md:text-base lg:text-xl font-medium tracking-tight">Navigate your IE journey. One subject at a time.</p>
            </div>
          </motion.div>

          <div className="flex flex-col items-end gap-3">
            <div className="flex items-center gap-2">
              {/* Mobile search toggle */}
              <button
                onClick={() => setShowMobileSearch(v => !v)}
                className="lg:hidden p-3 rounded-xl neumorphic-raised hover:neumorphic-pressed text-foreground/50 transition-all tap-target"
                aria-label="Toggle search"
              >
                <Search size={18} />
              </button>
              {/* Desktop search */}
              <div className="relative hidden lg:block w-72">
                <Label htmlFor="dashboard-search" className="sr-only">Search subjects</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" size={16} />
                <input
                  id="dashboard-search"
                  type="text"
                  placeholder="Search subjects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-background border-none neumorphic-pressed rounded-xl py-3 pl-10 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ctu-gold/50 transition-all text-foreground placeholder:text-foreground/30"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full hover:bg-foreground/5 text-foreground/40 transition-colors">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                onClick={() => navigate(`/catalog${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ''}`)}
                className="neumorphic-raised hover:neumorphic-pressed px-5 py-3 rounded-full text-foreground font-bold text-sm transition-all whitespace-nowrap tap-target"
              >
                Full Catalog
              </button>
            </div>
            {/* Filters - desktop */}
            <div className="hidden md:flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowOnlyRemaining(!showOnlyRemaining)}
                className={cn(
                  "flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border tap-target",
                  showOnlyRemaining
                    ? "bg-ctu-maroon border-ctu-maroon text-white"
                    : "border-foreground/10 text-foreground/40 hover:text-foreground/60"
                )}
              >
                <TrendingUp size={12} />Remaining
              </button>
              <div className="w-px h-4 bg-foreground/10" />
              {(['All', '1st', '2nd', '3rd', '4th'] as const).map((year) => {
                const yearSubjects = year === 'All' ? IE_SUBJECTS : subjectsByYear[year];
                return (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-widest transition-all tap-target",
                      selectedYear === year ? "neumorphic-pressed text-ctu-gold" : "text-foreground/30 hover:text-foreground/60"
                    )}
                  >
                    {year === 'All' ? 'All' : `${year} Yr`}
                    <span className="opacity-50">({yearSubjects.length})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile search bar — slides in */}
        {showMobileSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="lg:hidden mb-6"
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={16} />
              <input
                autoFocus
                type="text"
                placeholder="Search subjects, codes, professors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border-none neumorphic-pressed rounded-2xl py-4 pl-11 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-ctu-gold/50 text-foreground placeholder:text-foreground/30"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-foreground/40">
                  <X size={16} />
                </button>
              )}
            </div>
            {/* Mobile year filters */}
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
              {(['All', '1st', '2nd', '3rd', '4th'] as const).map((year) => (
                <button
                  key={year}
                  onClick={() => setSelectedYear(year)}
                  className={cn(
                    "flex-shrink-0 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all tap-target",
                    selectedYear === year ? "bg-ctu-gold text-white" : "neumorphic-raised text-foreground/50"
                  )}
                >
                  {year === 'All' ? 'All Years' : `${year} Year`}
                </button>
              ))}
            </div>
          </motion.div>
        )}
              <div className="absolute inset-0 bg-ctu-gold/20 rounded-full blur-xl animate-pulse" />
              <div className="relative w-full h-full neumorphic-raised rounded-full p-1 flex items-center justify-center bg-background overflow-hidden border border-white/10 scale-90">
                <div className="absolute inset-0 border-2 border-ctu-gold/30 rounded-full animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-2 border border-ctu-maroon/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                
                <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-ctu-gold via-ctu-maroon to-navy-deep flex items-center justify-center shadow-inner overflow-hidden">
                  <motion.div 
                    animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-8 h-8 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] flex items-center justify-center"
                    role="img"
                    aria-label="Glowing AI Robot eye representing IE MATRIX intelligence"
                  >
                    <div className="w-4 h-4 rounded-full bg-navy-deep flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-ctu-gold animate-ping" />
                    </div>
                  </motion.div>
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {[
                { label: 'Total Subjects', value: stats.total.toString(), icon: BookOpen, color: 'text-cyan-500', bg: 'bg-cyan-500/10', to: '/catalog' },
                { label: 'Completed', value: stats.done.toString(), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', to: '/progress' },
                { label: 'In Progress', value: stats.inProgress.toString(), icon: Clock, color: 'text-ctu-maroon', bg: 'bg-ctu-maroon/10', to: '/progress' },
                { label: 'GWA', value: stats.gwa, icon: LayoutDashboard, color: 'text-ctu-gold', bg: 'bg-ctu-gold/10', to: '/progress' },
              ].map((stat, i) => (
                <motion.div key={i} variants={itemVariants}>
                  <Card
                    className="neumorphic-card border-none overflow-hidden card-hover tap-target cursor-pointer"
                    onClick={() => navigate(stat.to)}
                  >
                    <CardContent className="p-4 sm:p-6">
                      <div className={cn("w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center mb-3", stat.bg)}>
                        <stat.icon size={18} className={stat.color} />
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-foreground/40 uppercase tracking-[1px] font-bold">{stat.label}</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground mt-1">{stat.value}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Year Progress */}
            <motion.div variants={itemVariants} className="neumorphic-card p-6 sm:p-10">
              <h3 className="text-2xl sm:text-4xl font-display font-black text-ctu-gold uppercase tracking-[0.2em] mb-6 sm:mb-12 border-b border-foreground/5 pb-4 sm:pb-6">Year Level Progress</h3>
              <div className="grid grid-cols-2 gap-4 sm:gap-6">
                {([
                  { id: '1st', year: '1st Year', subjects: subjectsByYear['1st'], gradient: 'from-ctu-maroon to-pink-400', badge: 'bg-ctu-maroon' },
                  { id: '2nd', year: '2nd Year', subjects: subjectsByYear['2nd'], gradient: 'from-ctu-gold to-purple-400', badge: 'bg-ctu-gold' },
                  { id: '3rd', year: '3rd Year', subjects: subjectsByYear['3rd'], gradient: 'from-cyan-500 to-blue-400', badge: 'bg-cyan-500' },
                  { id: '4th', year: '4th Year', subjects: subjectsByYear['4th'], gradient: 'from-emerald-500 to-teal-400', badge: 'bg-emerald-500' },
                ] as const).map((year, i) => {
                  const done = year.subjects.filter((s: any) => progressMap[s.id]?.status === 'done').length;
                  const progress = Math.round((done / year.subjects.length) * 100);
                  return (
                    <button key={i} onClick={() => setSelectedYear(year.id as any)}
                      className="neumorphic-pressed p-4 sm:p-6 rounded-2xl flex flex-col text-left tap-target hover:scale-[1.01] transition-transform"
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className={cn("text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider text-white", year.badge)}>{year.year}</span>
                        <span className="text-[10px] text-foreground/40 font-bold">{done}/{year.subjects.length}</span>
                      </div>
                      <div className="text-xl sm:text-3xl font-black text-foreground mt-1 tracking-tighter">{progress}%</div>
                      <div className="h-2 bg-foreground/5 rounded-full mt-3 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1, delay: 0.5 + i * 0.1, ease: 'easeOut' }}
                          className={cn('h-full rounded-full bg-gradient-to-r', year.gradient)}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* Subject Cards */}
            <motion.div variants={itemVariants} className="space-y-6 mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl sm:text-3xl font-display font-black tracking-tight frosted-header">
                  {isFilterActive ? `Results (${filteredSubjects.length})` : 'Recommended'}
                </h3>
                <div className="flex items-center gap-2">
                  {isFilterActive && (
                    <button onClick={clearFilters} className="text-xs font-bold text-foreground/40 hover:text-foreground/60 bg-foreground/5 px-3 py-1.5 rounded-lg flex items-center gap-1 tap-target">
                      <X size={12} /> Clear
                    </button>
                  )}
                  {!isFilterActive && (
                    <button onClick={() => navigate('/catalog')} className="text-ctu-gold text-sm font-bold flex items-center gap-1 hover:underline tap-target">
                      View All <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              </div>
              {filteredSubjects.length > 0 ? (
                <div id="horizontal-scroll-container" className="flex gap-4 overflow-x-auto pb-6 no-scrollbar snap-x snap-mandatory">
                  {filteredSubjects.slice(0, 12).map((subject, idx) => (
                    <GlowCard
                      key={subject.id}
                      glowColor={idx % 2 === 0 ? 'blue' : 'orange'}
                      customSize
                      className="w-56 sm:w-72 h-40 sm:h-44 shrink-0 hover:scale-[1.03] transition-all cursor-pointer border-none flex flex-col justify-between snap-start tap-target"
                      onClick={() => navigate(`/catalog/${subject.id}`)}
                    >
                      <div className="relative z-10 w-full">
                        <Badge variant="outline" className="mb-2 border-ctu-gold text-ctu-gold text-[10px] font-bold bg-ctu-gold/5">{subject.code}</Badge>
                        <h4 className="font-bold text-foreground text-clamp-2 text-sm sm:text-base">{subject.name}</h4>
                        <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-wider mt-1 text-clamp-1">{subject.department || 'IE Dept'}</p>
                      </div>
                      <div className="relative z-10 flex justify-between items-center">
                        <p className="text-xs text-foreground/60">{subject.units} Units</p>
                        <ChevronRight size={14} className="text-foreground/40" />
                      </div>
                    </GlowCard>
                  ))}
                </div>
              ) : (
                <div className="neumorphic-pressed rounded-3xl p-8 text-center">
                  <Search size={28} className="text-foreground/20 mx-auto mb-4" />
                  <h4 className="text-base font-bold mb-2">No subjects found</h4>
                  <button onClick={clearFilters} className="bg-ctu-gold text-white font-bold px-5 py-2 rounded-xl text-sm tap-target mt-2">Reset Filters</button>
                </div>
              )}
            </motion.div>
          </div>

          {/* Right Panel */}
          <div className="space-y-8">
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
