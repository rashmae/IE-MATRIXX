import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Grid, 
  List as ListIcon,
  Star,
  Link as LinkIcon,
  ChevronRight,
  CheckCircle2,
  Clock,
  Circle,
  History,
  X,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  Trophy,
  MessageSquare,
  Calendar,
  Heart,
  Upload,
  FileText
} from 'lucide-react';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User, Subject, YearLevel, Semester } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { Badge } from '@/components/ui/badge';
import { GlowCard } from '@/components/ui/spotlight-card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';

import { useAuth } from '@/src/context/AuthContext';
import { useProgress } from '@/src/hooks/useProgress';
import { getGWAEquivalent, getGWAColor } from '@/src/lib/gradeUtils';
import { db } from '@/src/lib/firebase';
import { collection, getDocs, query, orderBy, updateDoc, doc, serverTimestamp } from 'firebase/firestore';

type SortOption = 'relevance' | 'alpha-asc' | 'alpha-desc' | 'rating-desc' | 'reviews-desc' | 'newest';

export default function Catalog() {
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const { progressMap, loading: progressMapLoading } = useProgress();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Admin Upload State
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [syllabusUrlInput, setSyllabusUrlInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Advanced Filter State
  const [selectedYears, setSelectedYears] = useState<YearLevel[]>([]);
  const [selectedSems, setSelectedSems] = useState<Semester[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [unitRange, setUnitRange] = useState<[number]>([5]);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [hasReviews, setHasReviews] = useState(false);
  
  const navigate = useNavigate();

  const departments = useMemo(() => {
    const deps = new Set<string>();
    subjects.forEach(s => s.department && deps.add(s.department));
    return Array.from(deps).sort();
  }, [subjects]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedYears.length > 0) count++;
    if (selectedSems.length > 0) count++;
    if (selectedDepartments.length > 0) count++;
    if (unitRange[0] < 5) count++;
    if (onlyAvailable) count++;
    if (onlyFavorites) count++;
    if (hasReviews) count++;
    return count;
  }, [selectedYears, selectedSems, selectedDepartments, unitRange, onlyAvailable, onlyFavorites, hasReviews]);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login');
    }

    if (profile) {
      fetchSubjects();
    }
    
    const params = new URLSearchParams(window.location.search);
    const queryParam = params.get('q');
    const yearParam = params.get('year');

    if (queryParam) setSearchQuery(queryParam);
    if (yearParam && (['1st', '2nd', '3rd', '4th'] as const).includes(yearParam as any)) {
      setSelectedYears([yearParam as YearLevel]);
    }

    const history = localStorage.getItem('ctu_hub_catalog_search_history');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
  }, [profile, authLoading, navigate]);

  const fetchSubjects = async () => {
    setSubjectsLoading(true);
    try {
      const q = query(collection(db, 'subjects'), orderBy('yearLevel'), orderBy('semester'));
      const querySnapshot = await getDocs(q);
      
      let fetchedSubjects: Subject[] = [];
      if (!querySnapshot.empty) {
        fetchedSubjects = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subject));
      } else {
        fetchedSubjects = IE_SUBJECTS;
      }
      setSubjects(fetchedSubjects);
    } catch (error) {
      console.error("Error fetching subjects:", error);
      setSubjects(IE_SUBJECTS);
    } finally {
      setSubjectsLoading(false);
    }
  };

  const filteredSubjects = useMemo(() => {
    let result = subjects.filter(s => {
      const matchesSearch = 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.professor?.toLowerCase().includes(searchQuery.toLowerCase());
        
      const matchesYear = selectedYears.length === 0 || selectedYears.includes(s.yearLevel);
      const matchesSem = selectedSems.length === 0 || selectedSems.includes(s.semester);
      const matchesDept = selectedDepartments.length === 0 || (s.department && selectedDepartments.includes(s.department));
      const matchesUnits = s.units <= unitRange[0];
      const matchesAvailable = !onlyAvailable || (s.slotsAvailable && s.slotsAvailable > 0);
      const matchesFavorite = !onlyFavorites || s.isFavorite;
      const matchesReviews = !hasReviews || (s.reviewCount && s.reviewCount > 0);
      
      return matchesSearch && matchesYear && matchesSem && matchesDept && matchesUnits && matchesAvailable && matchesFavorite && matchesReviews;
    });

    // Apply Sorting
    switch (sortBy) {
      case 'alpha-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'alpha-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'rating-desc':
        result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case 'reviews-desc':
        result.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
        break;
      case 'newest':
        result.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        break;
      default:
        // Relevance - default order from constant/DB
        break;
    }

    return result;
  }, [subjects, searchQuery, selectedYears, selectedSems, selectedDepartments, unitRange, onlyAvailable, onlyFavorites, hasReviews, sortBy]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedYears([]);
    setSelectedSems([]);
    setSelectedDepartments([]);
    setUnitRange([5]);
    setOnlyAvailable(false);
    setOnlyFavorites(false);
    setHasReviews(false);
    setSortBy('relevance');
  };

  const removeFromHistory = (query: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory(prev => {
      const newHistory = prev.filter(item => item !== query);
      localStorage.setItem('ctu_hub_catalog_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const addToHistory = (query: string) => {
    if (!query.trim()) return;
    
    setSearchHistory(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== query.toLowerCase());
      const newHistory = [query, ...filtered].slice(0, 3);
      localStorage.setItem('ctu_hub_catalog_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const handleOpenUploadDialog = (subject: Subject, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveSubject(subject);
    setSyllabusUrlInput(subject.syllabusUrl || '');
    setIsUploadDialogOpen(true);
  };

  const handleSaveSyllabus = async () => {
    if (!activeSubject || !syllabusUrlInput.trim()) return;

    setIsSaving(true);
    try {
      const subjectRef = doc(db, 'subjects', activeSubject.id);
      await updateDoc(subjectRef, {
        syllabusUrl: syllabusUrlInput,
        isAvailable: true,
        updatedAt: serverTimestamp()
      });

      // Update local state for immediate feedback
      setSubjects(prev => prev.map(s => 
        s.id === activeSubject.id 
          ? { ...s, syllabusUrl: syllabusUrlInput, isAvailable: true } 
          : s
      ));

      toast.success("Syllabus updated successfully!");
      setIsUploadDialogOpen(false);
      setActiveSubject(null);
    } catch (error) {
      console.error("Error updating syllabus:", error);
      toast.error("Failed to update syllabus.");
    } finally {
      setIsSaving(false);
    }
  };

  const getYearBadgeColor = (year: YearLevel) => {
    switch (year) {
      case '1st': return 'bg-ctu-maroon';
      case '2nd': return 'bg-ctu-gold';
      case '3rd': return 'bg-cyan-500 text-white';
      case '4th': return 'bg-emerald-500 text-white';
      default: return 'bg-foreground/10 text-foreground/60';
    }
  };

  const FilterPanelContent = () => (
    <div className="space-y-8 py-4">
      <div className="space-y-4" role="group" aria-labelledby="filter-year-level">
        <h4 id="filter-year-level" className="text-sm font-bold uppercase tracking-widest text-foreground/40 px-1">Year Level</h4>
        <div className="grid grid-cols-2 gap-3">
          {(['1st', '2nd', '3rd', '4th'] as YearLevel[]).map(year => (
            <div key={year} className="flex items-center space-x-2">
              <Checkbox 
                id={`year-${year}`} 
                checked={selectedYears.includes(year)}
                onCheckedChange={(checked) => {
                  if (checked) setSelectedYears(prev => [...prev, year]);
                  else setSelectedYears(prev => prev.filter(y => y !== year));
                }}
              />
              <Label htmlFor={`year-${year}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                {year} Year
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4" role="group" aria-labelledby="filter-semester">
        <h4 id="filter-semester" className="text-sm font-bold uppercase tracking-widest text-foreground/40 px-1">Semester</h4>
        <div className="flex flex-wrap gap-2">
          {(['1st', '2nd', 'Summer'] as Semester[]).map(sem => (
            <button
              key={sem}
              aria-pressed={selectedSems.includes(sem)}
              onClick={() => {
                if (selectedSems.includes(sem)) setSelectedSems(prev => prev.filter(s => s !== sem));
                else setSelectedSems(prev => [...prev, sem]);
              }}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                selectedSems.includes(sem) 
                  ? "neumorphic-pressed text-ctu-gold" 
                  : "neumorphic-raised text-foreground/40 hover:text-foreground"
              )}
            >
              {sem} Sem
            </button>
          ))}
        </div>
      </div>

      {departments.length > 0 && (
        <div className="space-y-4" role="group" aria-labelledby="filter-department">
          <h4 id="filter-department" className="text-sm font-bold uppercase tracking-widest text-foreground/40 px-1">Department</h4>
          <div className="space-y-2">
            {departments.map(dept => (
              <div key={dept} className="flex items-center space-x-2">
                <Checkbox 
                  id={`dept-${dept}`} 
                  checked={selectedDepartments.includes(dept)}
                  onCheckedChange={(checked) => {
                    if (checked) setSelectedDepartments(prev => [...prev, dept]);
                    else setSelectedDepartments(prev => prev.filter(d => d !== dept));
                  }}
                />
                <Label htmlFor={`dept-${dept}`} className="text-sm font-medium leading-none truncate cursor-pointer">
                  {dept}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-6 px-1" role="group" aria-labelledby="filter-units">
        <div className="flex justify-between items-center">
          <h4 id="filter-units" className="text-sm font-bold uppercase tracking-widest text-foreground/40">Max Units</h4>
          <span className="text-sm font-bold text-ctu-gold" aria-live="polite">{unitRange[0]} Units</span>
        </div>
        <Slider
          value={unitRange}
          min={1}
          max={5}
          step={1}
          onValueChange={setUnitRange as any}
          className="py-4"
          aria-label="Maximum units"
        />
      </div>

      <div className="space-y-4 pt-4 border-t border-foreground/5" role="group" aria-label="Course Availability and Preferences">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="available-slots" className="text-sm font-bold cursor-pointer">Available Slots</Label>
            <p className="text-[10px] text-foreground/40">Show only courses with open slots</p>
          </div>
          <Switch 
            id="available-slots"
            checked={onlyAvailable}
            onCheckedChange={setOnlyAvailable}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="only-favorites" className="text-sm font-bold cursor-pointer">Favorites</Label>
            <p className="text-[10px] text-foreground/40">Show only your favorited courses</p>
          </div>
          <Switch 
            id="only-favorites"
            checked={onlyFavorites}
            onCheckedChange={setOnlyFavorites}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="has-reviews" className="text-sm font-bold cursor-pointer">Has Reviews</Label>
            <p className="text-[10px] text-foreground/40">Show only courses with student feedback</p>
          </div>
          <Switch 
            id="has-reviews"
            checked={hasReviews}
            onCheckedChange={setHasReviews}
          />
        </div>
      </div>

      <Button 
        variant="outline" 
        onClick={clearAllFilters}
        className="w-full rounded-xl h-12 border-foreground/10 hover:bg-foreground/5 font-bold"
      >
        Reset All Filters
      </Button>
    </div>
  );

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={profile} />
      
      <main id="main-content" className="flex-1 p-6 lg:p-10 pb-32 lg:pb-10 overflow-x-hidden">
        {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl frosted-header font-bold tracking-tight">Course Catalog</h1>
            <p className="text-foreground/60 mt-1 text-sm font-medium">Explore the CTU Industrial Engineering curriculum.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-background p-1.5 rounded-2xl neumorphic-raised">
              <button 
                onClick={() => setViewMode('grid')}
                aria-label="Grid View"
                className={cn("p-2.5 rounded-xl transition-all", viewMode === 'grid' ? "neumorphic-pressed text-ctu-gold" : "text-foreground/40")}
              >
                <Grid size={20} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                aria-label="List View"
                className={cn("p-2.5 rounded-xl transition-all", viewMode === 'list' ? "neumorphic-pressed text-ctu-gold" : "text-foreground/40")}
              >
                <ListIcon size={20} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden lg:block w-72 shrink-0 space-y-6">
            <div className="sticky top-10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Filter size={18} className="text-ctu-gold" />
                  Filters
                </h3>
                {activeFilterCount > 0 && (
                  <Badge className="bg-ctu-gold text-white font-bold rounded-full h-5 w-5 flex items-center justify-center p-0">
                    {activeFilterCount}
                  </Badge>
                )}
              </div>
              <ScrollArea className="h-[calc(100vh-200px)] pr-4 -mr-4">
                <FilterPanelContent />
              </ScrollArea>
            </div>
          </aside>

          <div className="flex-1 space-y-8">
            {/* Search History */}
            {searchHistory.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center gap-2"
              >
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-ctu-gold uppercase tracking-[2px] mr-1">
                  <History size={12} />
                  Recent
                </div>
                {searchHistory.map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setSearchQuery(item)}
                    aria-label={`Search for ${item}`}
                    className="group flex items-center gap-2 px-3 py-1 rounded-lg neumorphic-raised hover:neumorphic-pressed transition-all cursor-pointer bg-background/30 border border-white/5"
                  >
                    <span className="text-[10px] font-bold text-foreground/50 group-hover:text-ctu-gold transition-colors">
                      {item}
                    </span>
                    <div 
                      onClick={(e) => removeFromHistory(item, e)}
                      aria-label={`Remove ${item} from search history`}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          removeFromHistory(item, e as any);
                        }
                      }}
                      className="text-foreground/20 hover:text-ctu-maroon transition-colors"
                    >
                      <X size={10} />
                    </div>
                  </button>
                ))}
                <button 
                  onClick={() => {
                    setSearchHistory([]);
                    localStorage.removeItem('ctu_hub_catalog_search_history');
                  }}
                  className="text-[9px] font-bold text-foreground/20 uppercase tracking-widest hover:text-ctu-maroon transition-colors ml-2"
                >
                  Clear All
                </button>
              </motion.div>
            )}

            {/* Controls Bar */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
                  <Input 
                    placeholder="Search subject name, code, or professor..." 
                    aria-label="Search subjects"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addToHistory(searchQuery);
                      }
                    }}
                    onBlur={() => {
                      if (searchQuery.trim()) addToHistory(searchQuery);
                    }}
                    className="bg-background border-none neumorphic-pressed pl-12 pr-12 h-14 rounded-2xl focus:ring-ctu-gold text-foreground placeholder:text-foreground/30 shadow-none ring-offset-0"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full hover:bg-foreground/5 text-foreground/40 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                <div className="flex gap-3 h-14">
                  <Sheet>
                    <SheetTrigger 
                      aria-label="Open advanced filters"
                      className="h-full px-5 rounded-2xl neumorphic-raised hover:neumorphic-pressed transition-all flex items-center gap-2 text-foreground/60"
                    >
                      <SlidersHorizontal size={18} />
                      <span className="font-bold text-sm hidden sm:inline">Advanced</span>
                      {activeFilterCount > 0 && (
                        <span className="bg-ctu-gold text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] font-bold">
                          {activeFilterCount}
                        </span>
                      )}
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[300px] sm:w-[400px] p-6 bg-background border-l border-foreground/5">
                      <SheetHeader className="mb-6">
                        <SheetTitle className="text-2xl font-bold">Advanced Filters</SheetTitle>
                        <SheetDescription className="text-foreground/40">Fine-tune your curriculum search</SheetDescription>
                      </SheetHeader>
                      <ScrollArea className="h-[calc(100vh-180px)] pr-4 -mr-4">
                        <FilterPanelContent />
                      </ScrollArea>
                    </SheetContent>
                  </Sheet>

                  <DropdownMenu>
                    <DropdownMenuTrigger 
                      aria-label="Sort subjects"
                      className="h-full px-5 rounded-2xl neumorphic-raised hover:neumorphic-pressed transition-all flex items-center gap-2 text-foreground/60 min-w-[140px] justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <ArrowUpDown size={18} />
                        <span className="font-bold text-sm hidden sm:inline">Sort</span>
                      </div>
                      <ChevronDown size={16} />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-background border border-foreground/5 rounded-2xl p-2 shadow-2xl">
                      <DropdownMenuLabel className="font-bold text-xs uppercase tracking-widest text-foreground/40 px-3 py-2">Sorting View</DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-foreground/5" />
                      <DropdownMenuItem onClick={() => setSortBy('relevance')} className={cn("rounded-xl px-3 py-2.5 font-medium cursor-pointer", sortBy === 'relevance' && "bg-ctu-gold/10 text-ctu-gold")}>
                        Relevance (Default)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('alpha-asc')} className={cn("rounded-xl px-3 py-2.5 font-medium cursor-pointer flex items-center justify-between", sortBy === 'alpha-asc' && "bg-ctu-gold/10 text-ctu-gold")}>
                        Alphabetical (A-Z)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('alpha-desc')} className={cn("rounded-xl px-3 py-2.5 font-medium cursor-pointer flex items-center justify-between", sortBy === 'alpha-desc' && "bg-ctu-gold/10 text-ctu-gold")}>
                        Alphabetical (Z-A)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('rating-desc')} className={cn("rounded-xl px-3 py-2.5 font-medium cursor-pointer flex items-center gap-2", sortBy === 'rating-desc' && "bg-ctu-gold/10 text-ctu-gold")}>
                        <Trophy size={14} className="text-ctu-gold" /> Highest Rated
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('reviews-desc')} className={cn("rounded-xl px-3 py-2.5 font-medium cursor-pointer flex items-center gap-2", sortBy === 'reviews-desc' && "bg-ctu-gold/10 text-ctu-gold")}>
                        <MessageSquare size={14} className="text-blue-500" /> Most Reviewed
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setSortBy('newest')} className={cn("rounded-xl px-3 py-2.5 font-medium cursor-pointer flex items-center gap-2", sortBy === 'newest' && "bg-ctu-gold/10 text-ctu-gold")}>
                        <Calendar size={14} className="text-emerald-500" /> Newest Added
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Horizontal Year Level Chips (Smart Matrix View) */}
              <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar">
                <div className="bg-ctu-gold/10 p-2 rounded-xl">
                  <Filter size={14} className="text-ctu-gold" />
                </div>
                {[
                  { id: 'all', label: 'All Subjects', year: null },
                  { id: '1st', label: '1st Year', year: '1st' },
                  { id: '2nd', label: '2nd Year', year: '2nd' },
                  { id: '3rd', label: '3rd Year', year: '3rd' },
                  { id: '4th', label: '4th Year', year: '4th' },
                ].map((chip) => {
                  const isActive = (chip.year === null && selectedYears.length === 0) || (chip.year && selectedYears.includes(chip.year as YearLevel));
                  const count = chip.year 
                    ? subjects.filter(s => s.yearLevel === chip.year).length
                    : subjects.length;

                  return (
                    <button
                      key={chip.id}
                      aria-pressed={isActive}
                      onClick={() => {
                        if (chip.year === null) setSelectedYears([]);
                        else setSelectedYears([chip.year as YearLevel]);
                      }}
                      className={cn(
                        "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap border border-transparent",
                        isActive 
                          ? "neumorphic-pressed text-ctu-gold border-ctu-gold/20" 
                          : "neumorphic-raised text-foreground/40 hover:text-foreground/60"
                      )}
                    >
                      {chip.label}
                      <span className={cn(
                        "text-[8px] bg-foreground/5 px-1.5 py-0.5 rounded-md",
                        isActive ? "text-ctu-gold bg-ctu-gold/5" : "text-foreground/20"
                      )}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-foreground/40 font-bold uppercase tracking-[2px]">
                Showing {filteredSubjects.length} of {subjects.length} subjects
              </p>
              {activeFilterCount > 0 && (
                <button 
                  onClick={clearAllFilters}
                  className="text-xs font-bold text-ctu-maroon hover:underline flex items-center gap-1.5"
                >
                  <X size={12} /> Reset Filters
                </button>
              )}
            </div>

            {/* Results Grid */}
            <motion.div 
              layout
              className={cn(
                "grid gap-8",
                viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
              )}
            >
              <AnimatePresence mode="popLayout">
                {filteredSubjects.map((subject, idx) => (
                  <motion.div
                    key={subject.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: idx * 0.05 }}
                  >
                    <GlowCard 
                      onClick={() => navigate(`/catalog/${subject.id}`)}
                      glowColor={idx % 2 === 0 ? 'blue' : 'orange'}
                      customSize
                      className="w-full h-full border-none hover:scale-[1.02] transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-ctu-maroon opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      {subject.isFavorite && (
                        <div className="absolute right-4 top-4 z-20 text-ctu-gold">
                          <Heart size={16} fill="currentColor" />
                        </div>
                      )}

                      <div className="p-5 flex flex-col h-full justify-between relative z-10">
                        <div>
                            <div className="flex justify-between items-start mb-6">
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className="border-ctu-gold text-ctu-gold font-bold bg-ctu-gold/5 px-2 py-0.5">{subject.code}</Badge>
                                <Badge className={cn("text-white border-none font-bold px-2 py-0.5", getYearBadgeColor(subject.yearLevel))}>
                                  {subject.yearLevel} Year
                                </Badge>
                              </div>
                              {subject.rating ? (
                                <div className="flex items-center gap-1 text-ctu-gold bg-ctu-gold/5 px-2 py-1 rounded-lg">
                                  <Star size={12} fill="currentColor" />
                                  <span className="text-xs font-bold leading-none">{subject.rating}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-foreground/30 font-bold uppercase tracking-widest italic">No ratings yet</span>
                              )}
                            </div>

                          <h3 className="text-xl font-bold text-foreground mb-3 group-hover:text-ctu-gold transition-colors leading-tight line-clamp-2">
                            {subject.name}
                          </h3>

                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleOpenUploadDialog(subject, e)}
                              className="mb-4 h-8 text-[10px] font-bold uppercase tracking-widest border-ctu-gold/20 hover:bg-ctu-gold/5 text-ctu-gold"
                            >
                              <Upload size={12} className="mr-1.5" />
                              Update Syllabus
                            </Button>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-[10px] text-foreground/40 font-bold uppercase tracking-wider mb-6">
                            <span className="flex items-center gap-1"><Circle size={8} className="fill-blue-500 text-blue-500" /> {subject.units} Units</span>
                            <span className="flex items-center gap-1"><Circle size={8} className="fill-orange-500 text-orange-500" /> {subject.semester} Semester</span>
                            {subject.department && <span className="flex items-center gap-1"><Circle size={8} className="fill-emerald-500 text-emerald-500" /> {subject.department}</span>}
                          </div>

                          {subject.slotsAvailable !== undefined && (
                            <div className="mb-6 space-y-1.5">
                              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-foreground/40">Available Slots</span>
                                <span className={cn(subject.slotsAvailable === 0 ? "text-ctu-maroon" : "text-emerald-500")}>
                                  {subject.slotsAvailable} / {subject.totalSlots}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-foreground/5 rounded-full overflow-hidden">
                                <div 
                                  className={cn("h-full rounded-full transition-all duration-1000", subject.slotsAvailable === 0 ? "bg-ctu-maroon" : "bg-emerald-500")}
                                  style={{ width: `${(subject.slotsAvailable / (subject.totalSlots || 1)) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-5 border-t border-foreground/5">
                          <div className="flex items-center gap-2">
                            {subject.prerequisiteIds.length > 0 ? (
                              <div className="flex items-center gap-1 text-blue-500 text-[10px] font-bold uppercase tracking-widest bg-blue-500/5 px-2 py-1 rounded-md">
                                <LinkIcon size={12} />
                                Prereq
                              </div>
                            ) : (
                              <span className="text-[10px] text-foreground/20 uppercase font-bold tracking-widest">No Prerequisites</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {progressMap[subject.id]?.status === 'done' ? (
                              <div className="flex items-center gap-2">
                                {progressMap[subject.id]?.grade && (
                                  <div className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] font-black border-2 border-current",
                                    getGWAColor(getGWAEquivalent(progressMap[subject.id].grade!))
                                  )}>
                                    GWA {getGWAEquivalent(progressMap[subject.id].grade!).toFixed(1)}
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded-md">
                                  <CheckCircle2 size={12} />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Completed</span>
                                </div>
                              </div>
                            ) : progressMap[subject.id]?.status === 'in_progress' ? (
                              <div className="flex items-center gap-1.5 bg-ctu-gold/10 text-ctu-gold px-2 py-1 rounded-md">
                                <Clock size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">In Progress</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 bg-foreground/5 text-foreground/20 px-2 py-1 rounded-md">
                                <Circle size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Not Started</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </GlowCard>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>

            {filteredSubjects.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-32 neumorphic-pressed rounded-[40px]"
              >
                <div className="w-24 h-24 bg-foreground/5 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search size={32} className="text-foreground/20" />
                </div>
                <h3 className="text-3xl font-display font-bold text-foreground mb-2">No subjects found</h3>
                <p className="text-foreground/40 font-medium max-w-md mx-auto mb-8">
                  We couldn't find any subjects matching your current filters. Try adjusting your search query or reset all filters.
                </p>
                <Button 
                  onClick={clearAllFilters}
                  className="bg-ctu-gold text-white font-bold px-8 py-4 rounded-2xl hover:opacity-90 transition-opacity"
                >
                  Clear All Filters
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Admin Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background border border-foreground/5 rounded-[32px] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <div className="p-2 bg-ctu-gold/10 rounded-xl">
                <FileText className="text-ctu-gold" size={20} />
              </div>
              Update Syllabus
            </DialogTitle>
            <DialogDescription className="text-foreground/40">
              Update the syllabus for <span className="text-foreground font-bold">{activeSubject?.code}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="syllabus-url" className="text-xs font-bold uppercase tracking-widest text-foreground/40 ml-1">
                Google Drive Preview Link
              </label>
              <Input
                id="syllabus-url"
                placeholder="Paste preview link here..."
                value={syllabusUrlInput}
                onChange={(e) => setSyllabusUrlInput(e.target.value)}
                className="bg-foreground/5 border-none h-12 rounded-xl focus:ring-ctu-gold"
              />
              <p className="text-[10px] text-foreground/30 italic ml-1">
                Tip: Link should end in /preview for best embedding
              </p>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsUploadDialogOpen(false)}
              className="rounded-xl font-bold h-12"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveSyllabus}
              disabled={isSaving || !syllabusUrlInput.trim()}
              className="bg-ctu-gold hover:bg-ctu-gold/90 text-white rounded-xl px-8 font-bold h-12 shadow-lg shadow-ctu-gold/20"
            >
              {isSaving ? "Saving..." : "Save Syllabus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
