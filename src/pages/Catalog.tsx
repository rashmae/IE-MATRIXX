import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Filter, 
  Grid, 
  List as ListIcon,
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
  Calendar,
  Upload,
  FileText,
  Star,
  Check,
  Calculator,
  FlaskConical,
  Monitor,
  Building2,
  Coins,
  Cpu,
  Dumbbell,
  Shield,
  ShieldCheck,
  PenTool,
  BarChart,
  BookOpen,
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
  Trophy,
  FunctionSquare,
  Timer,
  Database,
  Activity,
  TrendingUp,
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
  Megaphone,
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
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User, Subject, YearLevel, Semester } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { useDebounce } from '@/src/hooks/useDebounce';
import { useMediaQuery } from '@/src/hooks/useMediaQuery';
import { HeaderSkeleton, StatSkeleton, GridSkeleton } from '@/src/components/SkeletonLoader';
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
  DropdownMenuGroup,
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
import { getGWAColor } from '@/src/lib/gradeUtils';
import { db } from '@/src/lib/firebase';
import { collection, onSnapshot, query, orderBy, updateDoc, doc, serverTimestamp, where, getDocs, addDoc } from 'firebase/firestore';
import { extractSyllabusFromUrl, extractSyllabusFromFile } from '@/src/services/aiService';

type SortOption = 'relevance' | 'alpha-asc' | 'alpha-desc' | 'newest';


export default function Catalog() {
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const { progressMap, loading: progressMapLoading } = useProgress();
  const isMobile = useMediaQuery('(max-width: 640px)');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  // Admin Upload State
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null);
  const [syllabusUrlInput, setSyllabusUrlInput] = useState('');
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Advanced Filter State
  const [selectedYears, setSelectedYears] = useState<YearLevel[]>([]);
  const [selectedSems, setSelectedSems] = useState<Semester[]>([]);
  const [unitRange, setUnitRange] = useState<[number]>([5]);
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [hasReviews, setHasReviews] = useState(false);
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  
  const sortLabels: Record<string, string> = {
    'relevance': 'Default',
    'alpha-asc': 'A - Z',
    'alpha-desc': 'Z - A',
    'newest': 'Newest'
  };

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
  
  // Highlight search terms component
  const HighlightedText = ({ text, term }: { text: string; term: string }) => {
    if (!term.trim()) return <>{text}</>;
    
    // Escape special characters for regex
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedTerm})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === term.toLowerCase() ? (
            <span key={i} className="bg-ctu-gold/30 rounded-sm px-0.5 text-foreground font-black">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedYears.length > 0) count++;
    if (selectedSems.length > 0) count++;
    if (unitRange[0] < 5) count++;
    return count;
  }, [selectedYears, selectedSems, unitRange]);

  useEffect(() => {
    // Scroll to top on load
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!profile) {
      setSubjects([]);
      setSubjectsLoading(false);
      return;
    }

    setSubjectsLoading(true);
    
    // We listen to both collections to ensure real-time accuracy and fallback robustness
    const subjectsQ = query(collection(db, 'subjects'));
    const ratingsQ = query(collection(db, 'ratings'));

    let firestoreSubjects: any[] = [];
    let allRatings: any[] = [];
    let isSubjectsLoaded = false;
    let isRatingsLoaded = false;

    const mergeAndSet = () => {
      // 1. Group ratings by normalized subject identifiers
      const ratingMap: Record<string, { sum: number, count: number }> = {};
      
      allRatings.forEach(r => {
        const sid = r.subjectId;
        if (!sid) return;
        
        // Use normalization consistent with SubjectDetail to group ratings correctly
        const normalizedSid = sid.toUpperCase().replace(/[-\s]/g, "");
        const matchingOfficial = IE_SUBJECTS.find(s => 
          s.id.toUpperCase().replace(/[-\s]/g, "") === normalizedSid ||
          s.code.toUpperCase().replace(/[-\s]/g, "") === normalizedSid
        );

        const key = matchingOfficial ? matchingOfficial.id : sid;

        if (!ratingMap[key]) ratingMap[key] = { sum: 0, count: 0 };
        ratingMap[key].sum += (r.rating || 0);
        ratingMap[key].count += 1;
      });

      // 2. Merge data into official subjects
      const finalSubjects = IE_SUBJECTS.map(officialSub => {
        const matchingFirestoreSub = firestoreSubjects.find(fs => 
          fs.id === officialSub.id || 
          (fs.code && fs.code.replace(/\s/g, '').toLowerCase() === officialSub.code.replace(/\s/g, '').toLowerCase())
        );
        
        // Priority for ratings:
        // 1. Live ratings computed from the ratings collection (most accurate/fresh)
        // 2. Aggregate counts from the subjects collection
        // 3. Static defaults from constants.ts
        
        const liveRating = ratingMap[officialSub.id];
        let avgRating = officialSub.rating ?? null;
        let totalCount = officialSub.reviewCount ?? 0;

        if (liveRating && liveRating.count > 0) {
          avgRating = Number((liveRating.sum / liveRating.count).toFixed(1));
          totalCount = liveRating.count;
        } else if (matchingFirestoreSub) {
          const fsRatingCount = matchingFirestoreSub.ratingCount ?? 0;
          const fsTotalSum = matchingFirestoreSub.totalRatingSum ?? 0;
          const fsAvgDirect = matchingFirestoreSub.averageRating;

          avgRating = fsAvgDirect != null
            ? Number(fsAvgDirect)
            : fsRatingCount > 0
              ? Number((fsTotalSum / fsRatingCount).toFixed(1))
              : (officialSub.rating ?? null);
          totalCount = fsRatingCount || (officialSub.reviewCount ?? 0);
        }

        return {
          ...officialSub,
          ...matchingFirestoreSub,
          // Ensure critical fields are locked to official definitions
          id: officialSub.id, 
          yearLevel: officialSub.yearLevel,
          semester: officialSub.semester,
          units: officialSub.units,
          code: officialSub.code,
          averageRating: avgRating,
          ratingCount: totalCount,
        };
      });

      // 3. Sort in memory
      const yearOrder = { '1st': 1, '2nd': 2, '3rd': 3, '4th': 4 };
      const semOrder = { '1st': 1, '2nd': 2, 'Summer': 3 };

      finalSubjects.sort((a, b) => {
        const yearDiff = (yearOrder[a.yearLevel as keyof typeof yearOrder] || 0) - (yearOrder[b.yearLevel as keyof typeof yearOrder] || 0);
        if (yearDiff !== 0) return yearDiff;
        return (semOrder[a.semester as keyof typeof semOrder] || 0) - (semOrder[b.semester as keyof typeof semOrder] || 0);
      });
      
      setSubjects(finalSubjects);
      if (isSubjectsLoaded && isRatingsLoaded) {
        setSubjectsLoading(false);
      }
    };

    const unsubSubjects = onSnapshot(subjectsQ, (snapshot) => {
      firestoreSubjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      isSubjectsLoaded = true;
      mergeAndSet();
    }, (error) => {
      console.error("Subjects sync error:", error);
      isSubjectsLoaded = true;
      mergeAndSet();
    });

    const unsubRatings = onSnapshot(ratingsQ, (snapshot) => {
      allRatings = snapshot.docs.map(doc => doc.data());
      isRatingsLoaded = true;
      mergeAndSet();
    }, (error) => {
      console.warn("Ratings sync error:", error);
      isRatingsLoaded = true;
      mergeAndSet();
    });

    return () => {
      unsubSubjects();
      unsubRatings();
    };
  }, [profile]);

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login');
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
    // Deprecated in favor of onSnapshot useEffect
  };

  const filteredSubjects = useMemo(() => {
    let result = subjects.filter(s => {
      const matchesSearch = 
        s.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
        s.code.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        s.description?.toLowerCase().includes(debouncedSearch.toLowerCase());
        
      const matchesYear = selectedYears.length === 0 || selectedYears.includes(s.yearLevel);
      const matchesSem = selectedSems.length === 0 || selectedSems.includes(s.semester);
      const matchesUnits = s.units <= unitRange[0];
      
      return matchesSearch && matchesYear && matchesSem && matchesUnits;
    });

    // Apply Sorting
    switch (sortBy) {
      case 'alpha-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'alpha-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'newest':
        result.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        break;
      default:
        // Relevance - default order from constant/DB
        break;
    }

    return result;
  }, [subjects, debouncedSearch, selectedYears, selectedSems, unitRange, sortBy]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedYears([]);
    setSelectedSems([]);
    setUnitRange([5]);
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
    setSyllabusFile(null);
    setIsUploadDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSyllabusFile(e.target.files[0]);
    }
  };

  const handleSaveSyllabus = async () => {
    if (!activeSubject) return;
    if (!syllabusUrlInput.trim() && !syllabusFile) return;

    setIsSaving(true);
    try {
      let aiMetadata = {};
      
      // Step 1: Perform AI Extraction from File or URL
      if (syllabusFile) {
        toast.info("Analyzing syllabus PDF...", { 
          description: "Gemini is extracting data from your file.",
          duration: 6000 
        });

        // Convert file to base64
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const result = e.target?.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(syllabusFile);
        });

        const extracted = await extractSyllabusFromFile(fileContent, syllabusFile.type);
        if (extracted) {
          aiMetadata = extracted;
          toast.success("PDF extraction complete!");
        }
      } else if (syllabusUrlInput && syllabusUrlInput !== activeSubject.syllabusUrl) {
        toast.info("Extracting data from syllabus URL...", { 
          description: "This might take a moment while Gemini analyzes the link.",
          duration: 5000 
        });
        
        const extracted = await extractSyllabusFromUrl(syllabusUrlInput);
        if (extracted) {
          aiMetadata = extracted;
          toast.success("URL extraction complete!");
        }
      }

      const subjectRef = doc(db, 'subjects', activeSubject.id);
      const updateData = {
        syllabusUrl: syllabusUrlInput,
        isAvailable: true,
        ...aiMetadata,
        updatedAt: serverTimestamp()
      };
      await updateDoc(subjectRef, updateData);

      // Also persist to syllabusLinks for the ingestion queue
      try {
        const match = syllabusUrlInput.match(/\/d\/([^\/]+)/);
        const driveId = match ? match[1] : (syllabusUrlInput.includes('id=') ? syllabusUrlInput.split('id=')[1].split('&')[0] : null);
        
        if (driveId) {
          const linksRef = collection(db, 'syllabusLinks');
          const q = query(linksRef, where('driveId', '==', driveId));
          const existing = await getDocs(q);
          
          if (existing.empty) {
            await addDoc(linksRef, {
              name: `${activeSubject.code}: ${activeSubject.name}`,
              driveId,
              url: syllabusUrlInput,
              createdAt: serverTimestamp()
            });
          }
        }
      } catch (linkErr) {
        console.warn("Failed to save to ingestion queue:", linkErr);
        // Don't fail the whole operation if this secondary save fails
      }

      // Update local state for immediate feedback
      setSubjects(prev => prev.map(s => 
        s.id === activeSubject.id 
          ? { ...s, syllabusUrl: syllabusUrlInput, isAvailable: true, ...aiMetadata } 
          : s
      ));

      toast.success("Syllabus updated successfully!");
      setIsUploadDialogOpen(false);
      setActiveSubject(null);
      setSyllabusFile(null);
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

      <div className="space-y-6 px-1" role="group" aria-labelledby="filter-units">
        <div className="flex justify-between items-center mb-2">
          <h4 id="filter-units" className="text-sm font-bold uppercase tracking-widest text-foreground/40">Max Units</h4>
          <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-sm font-black border border-primary/20 shadow-sm transition-all duration-300">
            {unitRange[0] || 5} Units
          </div>
        </div>
        <div className="space-y-3 px-2">
          <Slider
            value={unitRange}
            min={1}
            max={5}
            step={1}
            onValueChange={setUnitRange as any}
            className="py-4"
            aria-label="Maximum units"
          />
          <div className="flex justify-between px-1 text-[11px] font-black text-foreground/40">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
            <span className="text-primary font-black">5 (Max)</span>
          </div>
        </div>
        <div className="h-0.5 w-full bg-foreground/10 rounded-full my-4" />
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
      <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
        <Sidebar user={null} />
        <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
          <HeaderSkeleton />
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="hidden lg:block w-72 shrink-0 space-y-6">
              <StatSkeleton />
              <StatSkeleton />
            </aside>
            <div className="flex-1">
              <GridSkeleton count={6} />
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
                {/* Header & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <div className="flex items-end gap-4 flex-wrap">
              <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl frosted-header font-black tracking-tight leading-[1.1] py-2 sm:py-4">Catalog</h1>
              {!subjectsLoading && (
                <span className="mb-3 sm:mb-5 text-[10px] font-black uppercase tracking-[0.25em] text-ctu-maroon bg-ctu-maroon/10 px-3 py-1.5 rounded-xl border border-ctu-maroon/20">
                  {subjects.length} Subjects
                </span>
              )}
            </div>
            <p className="text-foreground/40 mt-1 sm:mt-2 text-sm sm:text-base md:text-lg font-medium tracking-tight max-w-xl">
              Full BSIE curriculum — browse, track, and rate every subject.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <AnimatePresence>
              {isMobile && !isMobileSearchOpen && (
                <motion.button
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  onClick={() => setIsMobileSearchOpen(true)}
                  className="p-3 rounded-full neumorphic-raised text-ctu-gold tap-target"
                >
                  <Search size={24} />
                </motion.button>
              )}
            </AnimatePresence>
            <div className="flex bg-background p-1.5 rounded-2xl neumorphic-raised" role="group" aria-label="View mode toggle">
              {[
                { mode: 'grid' as const, Icon: Grid, label: 'Grid View' },
                { mode: 'list' as const, Icon: ListIcon, label: 'List View' },
              ].map(({ mode, Icon, label }) => (
                <button
                  key={mode}
                  title={label}
                  onClick={() => setViewMode(mode)}
                  aria-label={label}
                  aria-pressed={viewMode === mode}
                  className={cn(
                    "p-2.5 rounded-xl transition-all tap-target relative",
                    viewMode === mode
                      ? "neumorphic-pressed text-ctu-gold"
                      : "text-foreground/40 hover:text-foreground/60"
                  )}
                >
                  <Icon size={20} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Search Overlay */}
        <AnimatePresence>
          {isMobile && isMobileSearchOpen && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ 
                height: 'auto', 
                opacity: 1,
              }}
              onAnimationComplete={() => {
                // Ensure overflow is visible so dropdowns aren't clipped
                // We use a style object for direct DOM manipulation if needed, 
                // but setting a state or using transitionEnd is usually enough.
              }}
              exit={{ 
                height: 0, 
                opacity: 0,
                transition: { duration: 0.2 }
              }}
              className="mb-8 relative z-20"
            >
              <div className="flex flex-col gap-4">
                <div className="relative z-10">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
                  <Input 
                    autoFocus
                    placeholder="Subject or code..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-background border-none neumorphic-pressed pl-12 pr-12 h-14 rounded-2xl focus-ring"
                  />
                  <button 
                    onClick={() => setIsMobileSearchOpen(false)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full text-foreground/40 tap-target"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 px-1 no-scrollbar -mx-1 relative z-20">
                  <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                    <SheetTrigger className="px-5 py-2.5 rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] neumorphic-raised text-ctu-gold flex items-center gap-2 bg-background/50 border border-ctu-gold/20 shrink-0 active:neumorphic-pressed transition-all tap-target">
                      <SlidersHorizontal size={14} className="animate-pulse" /> Filters
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[85dvh] rounded-t-[40px] bg-background border-none p-6 shadow-2xl">
                      <div className="w-12 h-1.5 bg-foreground/10 rounded-full mx-auto mb-6" />
                      <SheetHeader className="mb-8">
                        <SheetTitle className="text-3xl font-black italic uppercase tracking-tighter text-ctu-maroon">Advanced Filters</SheetTitle>
                      </SheetHeader>
                      <ScrollArea className="h-full pr-4 pb-24">
                        <FilterPanelContent />
                      </ScrollArea>
                      <div className="pt-4 mt-4 border-t border-foreground/5 flex justify-between items-center text-xs font-bold uppercase tracking-widest text-foreground/40">
                        <span>Active: {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}</span>
                        <span>{filteredSubjects.length} results</span>
                      </div>
                    </SheetContent>
                  </Sheet>

                  <DropdownMenu>
                    <DropdownMenuTrigger className="px-5 py-2.5 rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] neumorphic-raised text-foreground/60 flex items-center gap-2 bg-background/50 border border-foreground/5 shrink-0 active:neumorphic-pressed transition-all tap-target focus:outline-none focus:ring-1 focus:ring-ctu-gold/50">
                      <ArrowUpDown size={14} className={cn(sortBy !== 'relevance' && "text-ctu-gold animate-bounce")} /> 
                      Sort: {sortLabels[sortBy] || 'Default'}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent 
                      align="start" 
                      sideOffset={8}
                      className="w-64 bg-background/98 backdrop-blur-2xl border border-foreground/10 rounded-[28px] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-[9999] animate-in fade-in zoom-in-95 duration-200"
                    >
                      {[
                        { id: 'relevance' as SortOption, label: 'Default Relevance' },
                        { id: 'alpha-asc' as SortOption, label: 'Name: A to Z' },
                        { id: 'alpha-desc' as SortOption, label: 'Name: Z to A' },
                        { id: 'newest' as SortOption, label: 'Recently Updated' }
                      ].map((item) => (
                        <DropdownMenuItem 
                          key={item.id}
                          onClick={() => setSortBy(item.id)} 
                          className={cn(
                            "rounded-2xl px-5 py-4 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer mb-1 flex items-center justify-between",
                            sortBy === item.id ? "bg-ctu-maroon text-white" : "hover:bg-ctu-maroon/10 hover:text-ctu-maroon"
                          )}
                        >
                          {item.label}
                          {sortBy === item.id && <CheckCircle2 size={12} />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {(['1st', '2nd', '3rd', '4th'] as YearLevel[]).map(year => (
                    <button
                      key={year}
                      onClick={() => {
                        if (selectedYears.includes(year)) setSelectedYears(prev => prev.filter(y => y !== year));
                        else setSelectedYears(prev => [...prev, year]);
                      }}
                      className={cn(
                        "px-5 py-2.5 rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all shrink-0 border tap-target",
                        selectedYears.includes(year) 
                          ? "bg-ctu-maroon text-white border-ctu-maroon shadow-lg neumorphic-raised" 
                          : "neumorphic-raised text-foreground/40 border-transparent bg-background/50"
                      )}
                    >
                      {year} Year
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
            <div className={cn("space-y-6", isMobile && "hidden")}>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
                  <Input 
                    placeholder="Search subject name or code..." 
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
                    className="bg-background border-none neumorphic-pressed pl-12 pr-12 h-14 rounded-2xl focus:ring-ctu-gold text-foreground placeholder:text-foreground/30 shadow-none ring-offset-0 focus-ring"
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
                  <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
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
                      <div className="pt-4 mt-4 border-t border-foreground/5 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-foreground/40">
                        <span>Active: {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}</span>
                        <span>{filteredSubjects.length} results</span>
                      </div>
                    </SheetContent>
                  </Sheet>

                  <DropdownMenu open={isSortDropdownOpen} onOpenChange={setIsSortDropdownOpen}>
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
                      <DropdownMenuGroup>
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
                        <DropdownMenuItem onClick={() => setSortBy('newest')} className={cn("rounded-xl px-3 py-2.5 font-medium cursor-pointer flex items-center gap-2", sortBy === 'newest' && "bg-ctu-gold/10 text-ctu-gold")}>
                          <Calendar size={14} className="text-emerald-500" /> Newest Added
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
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
                        "flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                        isActive 
                          ? "bg-gradient-to-r from-ctu-gold/10 to-ctu-maroon/10 neumorphic-pressed text-ctu-gold border border-ctu-gold/20" 
                          : "neumorphic-raised text-foreground/40 hover:text-foreground/60 border border-transparent"
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
              <p className={cn(
                "text-xs font-bold uppercase tracking-[2px] transition-colors",
                activeFilterCount > 0 || debouncedSearch ? "text-ctu-gold/70" : "text-foreground/40"
              )}>
                {filteredSubjects.length === subjects.length
                  ? `All ${subjects.length} subjects`
                  : `${filteredSubjects.length} of ${subjects.length} subjects`
                }
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

            {/* Results Grid - Grouped by Year and Semester */}
            <div className="space-y-12">
              {['1st', '2nd', '3rd', '4th'].map((year) => {
                const yearSubjects = filteredSubjects.filter(s => s.yearLevel === year);
                if (yearSubjects.length === 0) return null;

                return (
                  <div key={year} className="space-y-6">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center justify-center w-10 h-10 rounded-2xl neumorphic-pressed shadow-inner border border-foreground/5 bg-background">
                        <span className={cn("text-base font-black", 
                          year === '1st' ? 'text-ctu-maroon' :
                          year === '2nd' ? 'text-ctu-gold' :
                          year === '3rd' ? 'text-cyan-400' : 'text-emerald-400'
                        )}>
                          {year.replace('st','').replace('nd','').replace('rd','').replace('th','')}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-[9px] font-black uppercase tracking-[0.3em] text-foreground/20 mb-0.5">Year Level</div>
                          <h2 className="text-3xl sm:text-4xl font-display font-black tracking-tight text-foreground">
                            {year} Year
                          </h2>
                        </div>
                        <div className={cn("h-1 w-16 rounded-full ml-2 hidden sm:block", getYearBadgeColor(year as YearLevel))} />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/20 bg-foreground/5 px-2 py-1 rounded-md hidden sm:block ml-2">
                          {filteredSubjects.filter(s => s.yearLevel === year).length} subjects
                        </span>
                      </div>
                    </div>

                    {['1st', '2nd', 'Summer'].map((sem) => {
                      const semSubjects = yearSubjects.filter(s => s.semester === sem);
                      if (semSubjects.length === 0) return null;

                      return (
                        <div key={`${year}-${sem}`} className="space-y-4 ml-6">
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-foreground/20">Term</span>
                              <h3 className="text-lg font-black text-foreground/50 uppercase tracking-[0.2em] leading-none mb-1">
                                {sem === '1st' ? '1st Sem' : sem === '2nd' ? '2nd Sem' : 'Summer'}
                              </h3>
                            </div>
                            <div className="flex-1 h-px bg-foreground/8" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-foreground/20 shrink-0">
                              {semSubjects.length} {semSubjects.length === 1 ? 'subject' : 'subjects'}
                            </span>
                          </div>

                          <motion.div 
                            layout
                            className={cn(
                              "grid gap-6",
                              viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 items-stretch" : "grid-cols-1"
                            )}
                          >
                            <AnimatePresence mode="popLayout">
                              {semSubjects.map((subject, idx) => (
                                <motion.div
                                  key={subject.id}
                                  layout
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ duration: 0.3 }}
                                  className="h-full"
                                >
                                  <GlowCard 
                                    onClick={() => navigate(`/catalog/${subject.id}`)}
                                    glowColor={idx % 2 === 0 ? 'blue' : 'orange'}
                                    customSize
                                    className={cn(
                                      "w-full h-full border-none transition-all cursor-pointer group relative overflow-hidden !flex",
                                      viewMode === 'grid' ? "flex-col justify-between hover:scale-[1.02] min-h-[290px]" : "flex-row items-center p-2 sm:p-4"
                                    )}
                                  >
                                    <div className={cn(
                                      "absolute left-0 top-0 w-1.5 bg-ctu-maroon opacity-0 group-hover:opacity-100 transition-opacity",
                                      viewMode === 'grid' ? "bottom-0" : "h-full"
                                    )} />
                                    
                                    {viewMode === 'grid' ? (
                                      <div className="p-2 flex flex-1 flex-col relative z-10 w-full group/card">
                                        {/* Card Top: Code & Rating */}
                                        <div className="flex justify-between items-start mb-2">
                                          <div className="flex flex-col gap-0.5">
                                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-ctu-gold/60">
                                              {subject.yearLevel} • {subject.semester}
                                            </span>
                                            <div className="bg-ctu-maroon/10 text-ctu-maroon border border-ctu-maroon/20 px-2 py-0.5 rounded-md text-[9px] font-black tracking-widest inline-flex items-center w-fit shadow-sm gap-1.5">
                                              <HighlightedText text={subject.code} term={debouncedSearch} />
                                              {subject.isAvailable && (
                                                <div className="flex items-center justify-center w-3 h-3 rounded-full bg-emerald-500 text-white shadow-sm scale-110">
                                                  <Check className="w-2 h-2" strokeWidth={4} />
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center gap-1.5 bg-background/50 backdrop-blur-md px-1.5 py-1 rounded-xl border border-white/5 neumorphic-raised min-h-[22px]">
                                            {!subject.averageRating ? (
                                              <div className="flex items-center gap-1 px-1 opacity-40">
                                                <Star size={9} className="text-foreground/40" />
                                                <span className="text-[8px] font-black text-foreground/50 uppercase tracking-widest">N/A</span>
                                              </div>
                                            ) : (
                                              <>
                                                <Star size={10} className="text-ctu-gold fill-ctu-gold" />
                                                <span className="text-xs font-black text-foreground">{Number(subject.averageRating).toFixed(1)}</span>
                                                {subject.ratingCount > 0 && <span className="text-[8px] font-bold text-foreground/40">({subject.ratingCount})</span>}
                                              </>
                                            )}
                                          </div>
                                        </div>

                                        {/* Card Middle: Icon & Title */}
                                        <div className="flex-1 flex flex-col items-center justify-center py-1 text-center">
                                          <div className="w-16 h-16 rounded-[2rem] neumorphic-raised bg-background/40 flex items-center justify-center text-ctu-gold mb-3 group-hover/card:scale-110 transition-transform duration-500 relative shrink-0">
                                            <div className="absolute inset-0 bg-ctu-gold/5 rounded-inherit animate-pulse" />
                                            <SubjectIcon iconName={subject.icon} className="w-8 h-8 relative z-10 drop-shadow-[0_0_15px_rgba(234,179,8,0.3)]" />
                                          </div>

                                          {/* Standardized title container to keep text centered */}
                                          <div className="flex flex-col items-center justify-center w-full px-1 mb-2 min-h-[4rem]">
                                            <h3 className="text-lg font-black text-foreground group-hover/card:text-ctu-gold transition-colors leading-[1.1] text-center uppercase tracking-tighter italic line-clamp-3">
                                              <HighlightedText text={subject.name} term={debouncedSearch} />
                                            </h3>
                                          </div>

                                          <div className="flex items-center gap-4 text-[10px] text-foreground/40 font-black uppercase tracking-[0.15em] mt-auto">
                                            <span className="flex items-center gap-1.5 bg-foreground/5 px-2 py-1 rounded-md">
                                              <Circle size={6} className="fill-blue-500 text-blue-500" /> 
                                              {subject.units} Units
                                            </span>
                                            {subject.prerequisiteIds.length > 0 && (
                                              <span className="flex items-center gap-1.5 bg-ctu-maroon/5 text-ctu-maroon/60 px-2 py-1 rounded-md">
                                                <LinkIcon size={10} />
                                                Prereqs
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Card Bottom: Admin & Progress */}
                                        <div className="mt-4 pt-4 border-t border-foreground/5 space-y-4">
                                          {isAdmin && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={(e) => handleOpenUploadDialog(subject, e)}
                                              className="w-full h-10 text-[10px] font-black uppercase tracking-widest neumorphic-raised hover:neumorphic-pressed border-none text-ctu-gold/80"
                                            >
                                              <Upload size={14} className="mr-2" />
                                              Update Syllabus
                                            </Button>
                                          )}

                                          <div className="flex items-center justify-between h-10">
                                            {progressMap[subject.id]?.status === 'done' ? (
                                              <div className="flex items-center gap-2 w-full">
                                                <div className="flex-1 flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-2 rounded-xl border border-emerald-500/20">
                                                  <CheckCircle2 size={16} />
                                                  <span className="text-[10px] font-black uppercase tracking-widest">Completed</span>
                                                </div>
                                                {progressMap[subject.id]?.grade && (
                                                  <div className={cn(
                                                    "px-3 py-2 rounded-xl text-[11px] font-black border-2 border-current shadow-sm h-10 flex items-center justify-center min-w-[70px]",
                                                    getGWAColor(progressMap[subject.id].grade!)
                                                  )}>
                                                    {progressMap[subject.id].grade!.toFixed(1)}
                                                  </div>
                                                )}
                                              </div>
                                            ) : progressMap[subject.id]?.status === 'in_progress' ? (
                                              <div className="w-full flex items-center gap-3 bg-ctu-gold/10 text-ctu-gold px-3 py-2 rounded-xl border border-ctu-gold/20">
                                                <Clock size={16} className="animate-spin-slow" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">In Progress</span>
                                              </div>
                                            ) : (
                                              <div className="w-full flex items-center justify-between group/status">
                                                <div className="flex items-center gap-3 bg-foreground/5 text-foreground/30 px-3 py-2 rounded-xl border border-transparent transition-all group-hover/card:border-foreground/10 group-hover/card:bg-foreground/10 flex-1">
                                                  <Circle size={14} />
                                                  <span className="text-[10px] font-black uppercase tracking-widest">Not Started</span>
                                                </div>
                                                <ChevronRight size={20} className="text-foreground/10 group-hover/card:text-ctu-gold group-hover/card:translate-x-1 transition-all ml-2" />
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-8 relative z-10 w-full px-1 py-0 group/card">
                                        {/* Left Side: Code & Icon */}
                                        <div className="flex items-center gap-5 flex-1 min-w-0">
                                          <div className="shrink-0 w-16 h-16 rounded-2xl neumorphic-raised bg-background/50 border border-foreground/5 flex flex-col items-center justify-center relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-full h-1 bg-ctu-maroon/20" />
                                            <SubjectIcon iconName={subject.icon} className="w-6 h-6 text-ctu-gold mb-1" />
                                            <span className="text-[10px] font-black text-foreground drop-shadow-sm">
                                              <HighlightedText text={subject.code} term={debouncedSearch} />
                                            </span>
                                          </div>
                                          
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                              <h3 className="text-lg font-black text-foreground line-clamp-1 group-hover/card:text-ctu-gold transition-colors uppercase tracking-tighter italic">
                                                <HighlightedText text={subject.name} term={debouncedSearch} />
                                              </h3>
                                              {subject.prerequisiteIds.length > 0 && (
                                                <Badge variant="outline" className="border-blue-500/20 text-blue-500 text-[8px] font-black uppercase tracking-tighter bg-blue-500/5 h-4 px-1 shrink-0">
                                                  Prereq
                                                </Badge>
                                              )}
                                            </div>
                                            
                                            <div className="flex items-center gap-4">
                                              <span className="text-[10px] text-foreground/40 font-black uppercase tracking-widest flex items-center gap-1.5">
                                                <Circle size={8} className="fill-blue-500 text-blue-500" /> {subject.units} Units
                                              </span>
                                              {subject.averageRating === null ? (
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-foreground/5 border border-foreground/5 opacity-60 grayscale">
                                                  <Star size={10} className="text-foreground/30" />
                                                </div>
                                              ) : (
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-ctu-gold/10 border border-ctu-gold/20 shadow-[inset_0_0_8px_rgba(255,215,0,0.05)]">
                                                  <Star size={10} className="text-ctu-gold fill-ctu-gold" />
                                                  <span className="text-[10px] font-black text-ctu-gold">{Number(subject.averageRating).toFixed(1)}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Right Side: Status & Actions */}
                                        <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 sm:min-w-[180px]">
                                          <div className="flex items-center gap-3">
                                            {progressMap[subject.id]?.status === 'done' ? (
                                              <div className="flex items-center gap-3">
                                                {progressMap[subject.id]?.grade && (
                                                  <div className={cn(
                                                    "px-2 py-1 rounded-lg text-[10px] font-black border-2 border-current",
                                                    getGWAColor(progressMap[subject.id].grade!)
                                                  )}>
                                                    {progressMap[subject.id].grade!.toFixed(1)}
                                                  </div>
                                                )}
                                                <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-2 rounded-xl border border-emerald-500/20">
                                                  <CheckCircle2 size={16} />
                                                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Completed</span>
                                                </div>
                                              </div>
                                            ) : progressMap[subject.id]?.status === 'in_progress' ? (
                                              <div className="flex items-center gap-2 bg-ctu-gold/10 text-ctu-gold px-3 py-2 rounded-xl border border-ctu-gold/20">
                                                <Clock size={16} className="animate-spin-slow" />
                                                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Active</span>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2 bg-foreground/5 text-foreground/20 px-3 py-2 rounded-xl border border-foreground/5">
                                                <Circle size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Unstarted</span>
                                              </div>
                                            )}
                                          </div>
                                          
                                          <div className="h-10 w-10 flex items-center justify-center rounded-xl neumorphic-raised hover:neumorphic-pressed transition-all text-foreground/10 group-hover/card:text-ctu-gold">
                                            <ChevronRight size={20} className="transition-transform group-hover/card:translate-x-1" />
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </GlowCard>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </motion.div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {filteredSubjects.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-24 px-6 text-center mt-12 neumorphic-pressed rounded-[2rem] border border-foreground/5 flex flex-col items-center justify-center min-h-[400px]"
              >
                <div className="w-24 h-24 rounded-full neumorphic-raised flex items-center justify-center mb-6 bg-background">
                  <Search className="w-10 h-10 text-foreground/20" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-display font-black text-foreground tracking-tight mb-2">No subjects found</h3>
                <p className="text-foreground/40 text-sm sm:text-base font-medium tracking-tight max-w-md mx-auto">
                  We couldn't find any subjects matching your current filters. Try broadening your search criteria.
                </p>
                
                {(debouncedSearch || selectedYears.length > 0 || selectedSems.length > 0 || unitRange[0] < 5) && (
                  <Button 
                    variant="ghost" 
                    onClick={clearAllFilters}
                    className="mt-8 rounded-2xl font-bold tracking-widest uppercase text-[10px] sm:text-xs text-ctu-maroon hover:text-ctu-maroon hover:bg-ctu-maroon/10 h-12 px-6"
                  >
                    Clear all filters
                  </Button>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </main>

      {/* Admin Upload Dialog */}
      <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background border border-foreground/5 rounded-[32px] h-[85dvh] overflow-y-auto overscroll-contain">
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
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-foreground/5" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                <span className="bg-background px-2 text-foreground/20">OR</span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="syllabus-file" className="text-xs font-bold uppercase tracking-widest text-foreground/40 ml-1">
                Upload PDF Syllabus (Recommended)
              </label>
              <div className="relative group">
                <Input
                  id="syllabus-file"
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label 
                  htmlFor="syllabus-file" 
                  className={cn(
                    "flex flex-col items-center justify-center w-full h-32 rounded-2xl border-2 border-dashed transition-all cursor-pointer",
                    syllabusFile 
                      ? "border-emerald-500/50 bg-emerald-500/5" 
                      : "border-foreground/10 hover:border-ctu-gold/50 hover:bg-ctu-gold/5"
                  )}
                >
                  {syllabusFile ? (
                    <div className="flex flex-col items-center gap-2">
                      <CheckCircle2 className="text-emerald-500" size={32} />
                      <span className="text-xs font-black text-emerald-500 line-clamp-1 px-4">{syllabusFile.name}</span>
                      <span className="text-[10px] font-bold text-emerald-500/60 uppercase">File Ready for Extraction</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="text-foreground/20 group-hover:text-ctu-gold transition-colors" size={32} />
                      <span className="text-xs font-black text-foreground/40 uppercase tracking-widest pt-2">Click or Drag PDF</span>
                      <span className="text-[9px] font-bold text-foreground/20 uppercase tracking-widest">Supports files up to 20MB</span>
                    </div>
                  )}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="sm:justify-end gap-3 px-6 pb-6">
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
              disabled={isSaving || (!syllabusUrlInput.trim() && !syllabusFile)}
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
