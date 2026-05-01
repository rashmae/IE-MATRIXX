import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import Papa from 'papaparse';
import { 
  ArrowLeft, 
  Star, 
  Link as LinkIcon, 
  Download, 
  Plus, 
  FileText, 
  Video, 
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  Clock,
  Circle,
  X,
  AlertCircle,
  Youtube,
  FileBarChart,
  FilePieChart,
  Upload as UploadIcon,
  Trash2
} from 'lucide-react';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User, Subject, SubjectStatus, Resource } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LiquidButton } from '@/components/ui/liquid-glass';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UploadResourceModal from '@/src/components/resources/UploadResourceModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle as ModalTitle,
  DialogDescription as ModalDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  ThumbsUp, 
  User as UserIcon,
  MessageSquare,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { handleFirestoreError } from '@/src/lib/firestore-errors';

import { useAuth } from '@/src/context/AuthContext';
import { useProgress } from '@/src/hooks/useProgress';
import { db } from '@/src/lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';

export default function SubjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile, isAdmin, loading: authLoading } = useAuth();
  const { progressMap, loading: progressLoading, updateProgress: saveProgress } = useProgress();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  
  // Admin Upload State
  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [syllabusUrlInput, setSyllabusUrlInput] = useState('');
  const [isSavingSyllabus, setIsSavingSyllabus] = useState(false);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [userRating, setUserRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStarFilter, setSelectedStarFilter] = useState<number | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState<string | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState<string | null>(null);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login');
      return;
    }

    if (profile) {
      fetchSubjectData();
    }
  }, [id, profile, authLoading, navigate]);

  const fetchSubjectData = async () => {
    setLoading(true);
    try {
      const subRef = doc(db, 'subjects', id!);
      const subSnap = await getDoc(subRef);
      
      if (subSnap.exists()) {
        setSubject({ id: subSnap.id, ...subSnap.data() } as Subject);
      } else {
        const foundSubject = IE_SUBJECTS.find(s => s.id === id);
        if (foundSubject) {
          setSubject(foundSubject);
        } else {
          toast.error('Subject not found');
          navigate('/catalog');
          return;
        }
      }

      const resourcesQuery = query(
        collection(db, 'resources'), 
        where('subjectId', '==', id)
      );
      const resourcesSnap = await getDocs(resourcesQuery);
      const resourcesData = resourcesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Sort in memory to avoid index requirement
      resourcesData.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || (a.createdAt instanceof Date ? a.createdAt.getTime() : 0) || new Date(a.createdAt).getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || (b.createdAt instanceof Date ? b.createdAt.getTime() : 0) || new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });
      
      setResources(resourcesData);

      const subjectCode = subSnap.exists() ? subSnap.data().code : (IE_SUBJECTS.find(s => s.id === id)?.code || id);
      
      // Construct possible IDs to search for in ratings
      const possibleIds: string[] = [id!];
      if (subjectCode) possibleIds.push(subjectCode);
      
      // Add variations for robustness (case-insensitive and characters)
      const clean = (s: string) => s.toUpperCase().replace(/[-\s]/g, '');
      const rawId = id || '';
      
      possibleIds.push(rawId.toLowerCase());
      possibleIds.push(rawId.toUpperCase());
      possibleIds.push(clean(rawId));
      
      if (subjectCode) {
        possibleIds.push(subjectCode.toLowerCase());
        possibleIds.push(subjectCode.toUpperCase());
        possibleIds.push(clean(subjectCode));
      }
      
      // Add ID from official list as fallback
      const official = IE_SUBJECTS.find(s => s.id === id || s.code === id);
      if (official) {
        possibleIds.push(official.id);
        possibleIds.push(official.code);
        possibleIds.push(clean(official.id));
        possibleIds.push(clean(official.code));
      }
      
      // Deduplicate
      const finalIds = Array.from(new Set(possibleIds.filter(Boolean)));
      console.log(`[Ratings Debug] Subject ID: ${id}. Code: ${subjectCode}. Searching ratings with subjectId in:`, finalIds);

      try {
        const ratingsQuery = query(
          collection(db, 'ratings'),
          where('subjectId', 'in', finalIds)
        );
        const ratingsSnap = await getDocs(ratingsQuery);
        console.log(`[Ratings Debug] SUCCESS: Found ${ratingsSnap.size} ratings in Firestore for ${id}`);
        
        const localRatings = ratingsSnap.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data };
        });
        
        // Debug first rating if exists
        if (localRatings.length > 0) {
          console.log(`[Ratings Debug] Example rating found:`, localRatings[0]);
        }
        
        // Robust Sort Helper
        const getTime = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (typeof val.toDate === 'function') return val.toDate().getTime();
          if (val instanceof Date) return val.getTime();
          if (typeof val === 'number') return val;
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };

        localRatings.sort((a: any, b: any) => getTime(b.createdAt) - getTime(a.createdAt));
        setRatings(localRatings);
      } catch (re: any) {
        console.warn("[Ratings Debug] Firestore query failed:", re);
        // If "in" query fails (e.g. too many items), try a simpler one
        if (finalIds.length > 0) {
          try {
             const fallbackQuery = query(collection(db, 'ratings'), where('subjectId', '==', id));
             const fallbackSnap = await getDocs(fallbackQuery);
             setRatings(fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch (e2) {
             console.error("[Ratings Debug] Fallback query failed:", e2);
          }
        }
      }

      // Fetch Live Remote Ratings if configured (to allow automatic updates)
      try {
        const configDoc = await getDoc(doc(db, 'config', 'ratings'));
        if (configDoc.exists()) {
          const { sheetUrl } = configDoc.data();
          if (sheetUrl) {
            const currentSubCode = subSnap.exists() ? subSnap.data().code : (IE_SUBJECTS.find(s => s.id === id)?.code || id);
            const response = await fetch(sheetUrl);
            const csvText = await response.text();
            Papa.parse(csvText, {
              header: true,
              complete: (results) => {
                const remoteRatings = (results.data as any[])
                  .filter((row: any) => {
                    const keys = Object.keys(row);
                    const subjectKey = keys.find(k => k.toLowerCase().includes('subject') || k.toLowerCase().includes('course') || k.toLowerCase().includes('code'));
                    if (!subjectKey) return false;
                    const val = String(row[subjectKey] || '').toUpperCase().replace(/[-\s]/g, '');
                    const target = String(currentSubCode || id).toUpperCase().replace(/[-\s]/g, '');
                    return val.includes(target) || target.includes(val);
                  })
                  .map((row: any, i: number) => {
                    const keys = Object.keys(row);
                    const ratingKey = keys.find(k => k.toLowerCase().includes('rate') || k.toLowerCase().includes('rating') || k.toLowerCase().includes('score')) || '';
                    const feedbackKey = keys.find(k => k.toLowerCase().includes('comment') || k.toLowerCase().includes('feedback') || k.toLowerCase().includes('review') || k.toLowerCase().includes('why')) || '';
                    const userKey = keys.find(k => k.toLowerCase().includes('name')) || keys.find(k => k.toLowerCase().includes('email')) || '';
                    const dateKey = keys.find(k => k.toLowerCase().includes('timestamp') || k.toLowerCase().includes('date') || k.toLowerCase().includes('time')) || '';

                    return {
                      id: `live-${i}`,
                      rating: Math.min(5, Math.max(1, parseInt(row[ratingKey]) || 5)),
                      feedback: row[feedbackKey] || '',
                      userName: String(row[userKey] || 'External Feedback').slice(0, 50),
                      createdAt: row[dateKey] ? new Date(row[dateKey]) : new Date(),
                      isLive: true
                    };
                  });
                
                if (remoteRatings.length > 0) {
                  setRatings(prev => {
                    // Avoid duplicates if already imported
                    const filteredRemote = remoteRatings.filter(rr => 
                      !prev.some(pr => (pr.feedback === rr.feedback || pr.review === rr.feedback) && pr.rating === rr.rating)
                    );
                    return [...prev, ...filteredRemote];
                  });
                }
              }
            });
          }
        }
      } catch (e) {
        console.warn("Live ratings sync omitted or failed:", e);
      }

    } catch (error) {
      console.error("Error fetching subject data:", error);
    } finally {
      setLoading(false);
    }
  };

  const prerequisites = useMemo(() => {
    if (!subject) return [];
    return subject.prerequisiteIds.map(preId => {
      const found = IE_SUBJECTS.find(s => s.id === preId || s.code === preId);
      if (found) return found;
      return { id: preId, code: preId, name: preId } as Subject;
    });
  }, [subject]);

  const averageRating = useMemo(() => {
    if (ratings.length === 0) return "0.0";
    return (ratings.reduce((acc, curr) => acc + curr.rating, 0) / ratings.length).toFixed(1);
  }, [ratings]);

  const ratingCounts = useMemo(() => {
    return [5, 4, 3, 2, 1].map(stars => {
      const count = ratings.filter(r => r.rating === stars).length;
      const percentage = ratings.length > 0 ? (count / ratings.length) * 100 : 0;
      return { stars, count, percentage };
    });
  }, [ratings]);

  const filteredRatings = useMemo(() => {
    if (selectedStarFilter === null) return ratings;
    return ratings.filter((r: any) => r.rating === selectedStarFilter);
  }, [ratings, selectedStarFilter]);

  const status = id ? (progressMap[id]?.status || 'not_yet') : 'not_yet';
  const unmetPrerequisites = prerequisites.filter(p => (progressMap[p.id]?.status || 'not_yet') !== 'done');
  const arePrerequisitesMet = unmetPrerequisites.length === 0;

  const handleStatusChange = async (newStatus: SubjectStatus) => {
    if (!subject) return;
    if (newStatus === 'done' && !arePrerequisitesMet) {
      toast.error('You cannot mark this subject as done until all prerequisites are completed.');
      return;
    }

    try {
      await saveProgress(subject.id, { status: newStatus });
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error('Failed to update progress');
    }
  };

  const handleSubmitRating = async () => {
    if (!subject || !profile) return;
    
    if (userRating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setIsSubmittingRating(true);
    try {
      await addDoc(collection(db, 'ratings'), {
        subjectId: subject.id,
        userId: profile.uid,
        userName: isAnonymous ? 'Anonymous Student' : profile.fullName,
        userAvatar: isAnonymous ? null : (profile.photoURL || null),
        rating: userRating,
        feedback: feedback || "",
        isAnonymous: isAnonymous,
        likes: 0,
        likedBy: [],
        createdAt: serverTimestamp()
      });
      
      toast.success('Thank you for your feedback!');
      setIsRatingModalOpen(false);
      setUserRating(0);
      setFeedback('');
      setIsAnonymous(false);
      fetchSubjectData();
    } catch (error) {
      console.error("Rating submission error:", error);
      toast.error('Failed to submit rating. Please try again.');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const handleLikeReview = async (reviewId: string) => {
    if (isLikeLoading || !profile) return;
    
    const review = ratings.find(r => r.id === reviewId);
    if (!review) return;

    const hasLiked = review.likedBy?.includes(profile.uid);
    setIsLikeLoading(reviewId);

    try {
      const reviewRef = doc(db, 'ratings', reviewId);
      const newLikedBy = hasLiked 
        ? review.likedBy.filter((uid: string) => uid !== profile.uid)
        : [...(review.likedBy || []), profile.uid];
      
      await updateDoc(reviewRef, {
        likedBy: newLikedBy,
        likes: newLikedBy.length
      });

      // Update local state
      setRatings(prev => prev.map(r => 
        r.id === reviewId 
          ? { ...r, likedBy: newLikedBy, likes: newLikedBy.length } 
          : r
      ));

      toast.success(hasLiked ? 'Vote removed' : 'Helpful vote recorded!');
    } catch (error) {
      console.error("Error liking review:", error);
      toast.error('Failed to update vote');
    } finally {
      setIsLikeLoading(null);
    }
  };

  const handleDeleteRating = async (ratingId: string) => {
    if (!window.confirm('Are you sure you want to delete your rating? This action cannot be undone.')) return;
    
    setIsDeleteLoading(ratingId);
    try {
      await deleteDoc(doc(db, 'ratings', ratingId));
      toast.success('Rating deleted successfully');
      setRatings(prev => prev.filter(r => r.id !== ratingId));
      fetchSubjectData(); // Refresh aggregate data
    } catch (error) {
      console.error("Error deleting rating:", error);
      toast.error('Failed to delete rating');
    } finally {
      setIsDeleteLoading(null);
    }
  };

  const handleUpload = (newResource: Resource) => {
    fetchSubjectData(); // refresh everything to ensure sync with Firestore
    toast.success('Resource shared successfully!');
    setIsUploadModalOpen(false);
    setSelectedFile(null);
  };

  const handleQuickUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File is too large. Please keep it under 2MB.');
        return;
      }
      setSelectedFile(file);
      setIsUploadModalOpen(true);
    }
  };

  const handleOpenSyllabusDialog = () => {
    setSyllabusUrlInput(subject?.syllabusUrl || '');
    setIsSyllabusDialogOpen(true);
  };

  const handleSaveSyllabus = async () => {
    if (!subject || !syllabusUrlInput.trim()) return;

    setIsSavingSyllabus(true);
    try {
      const subjectRef = doc(db, 'subjects', subject.id);
      await updateDoc(subjectRef, {
        syllabusUrl: syllabusUrlInput,
        isAvailable: true,
        updatedAt: serverTimestamp()
      });

      setSubject(prev => prev ? { ...prev, syllabusUrl: syllabusUrlInput, isAvailable: true } : null);
      toast.success("Syllabus updated successfully!");
      setIsSyllabusDialogOpen(false);
    } catch (error) {
      console.error("Error updating syllabus:", error);
      toast.error("Failed to update syllabus.");
    } finally {
      setIsSavingSyllabus(false);
    }
  };

  if (authLoading || loading || !profile || !subject) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={profile} />
      
      <main className="flex-1 p-6 lg:p-10 pb-32 lg:pb-10 overflow-x-hidden">
        {/* Back Button */}
        <button 
          onClick={() => navigate('/catalog')}
          className="flex items-center gap-2 text-foreground/40 hover:text-foreground mb-8 transition-colors group font-bold text-sm uppercase tracking-widest"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Back to Catalog
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left Column: Subject Info */}
          <div className="lg:col-span-2 space-y-10">
            {/* Header Section */}
            <section>
              <div className="flex flex-wrap gap-3 mb-6">
                <Badge className="bg-ctu-maroon text-white border-none px-4 py-1 rounded-full text-[10px] font-bold uppercase">{subject.yearLevel} Year</Badge>
                <Badge className="bg-ctu-gold text-white border-none px-4 py-1 rounded-full text-[10px] font-bold uppercase">{subject.semester} Semester</Badge>
                <Badge className="neumorphic-pressed text-foreground/60 border-none px-4 py-1 rounded-full text-[10px] font-bold uppercase">{subject.units} Units</Badge>
              </div>
              
              <h1 className="text-7xl md:text-8xl frosted-header font-black mb-4 tracking-tighter leading-[0.9] py-2">{subject.name}</h1>
              <p className="text-ctu-gold font-black text-3xl mb-10 tracking-[0.2em]">{subject.code}</p>

              <div className="flex flex-wrap items-center gap-8 p-6 neumorphic-card w-fit">
                <div className="flex items-center gap-3">
                  <Star size={28} className="text-ctu-gold fill-ctu-gold" />
                  <span className="text-3xl font-bold text-foreground">{averageRating}</span>
                  <span className="text-foreground/40 text-xs font-bold uppercase tracking-widest">({ratings.length} ratings)</span>
                </div>
                <div className="hidden md:block w-px h-10 bg-foreground/5" />
                <div className="flex gap-3">
                  {[
                    { val: 'not_yet', icon: Circle, label: 'Not Yet' },
                    { val: 'in_progress', icon: Clock, label: 'In Progress' },
                    { val: 'done', icon: CheckCircle2, label: 'Done' }
                  ].map((s) => {
                    const isDisabled = s.val === 'done' && !arePrerequisitesMet;
                    return (
                      <button
                        key={s.val}
                        onClick={() => handleStatusChange(s.val as SubjectStatus)}
                        disabled={isDisabled}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all",
                          status === s.val 
                            ? "neumorphic-pressed text-ctu-gold" 
                            : "text-foreground/40 hover:text-foreground neumorphic-raised hover:neumorphic-pressed",
                          isDisabled && "opacity-50 cursor-not-allowed grayscale"
                        )}
                      >
                        <s.icon size={14} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {!arePrerequisitesMet && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-start gap-3 p-5 rounded-2xl bg-ctu-maroon/5 border border-ctu-maroon/20"
                >
                  <AlertCircle size={20} className="text-ctu-maroon shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-ctu-maroon uppercase tracking-wider mb-1">Prerequisites Incomplete</p>
                    <p className="text-xs text-foreground/60 font-medium">
                      You must complete the following subjects before you can rate or mark this as done:
                      <span className="block mt-2 font-bold text-foreground">
                        {unmetPrerequisites.map(p => `${p.code} - ${p.name}`).join(', ')}
                      </span>
                    </p>
                  </div>
                </motion.div>
              )}
            </section>

            {/* Description */}
            <section className="space-y-6">
              <h2 className="text-4xl font-display font-black text-foreground tracking-tight border-b-4 border-ctu-gold pb-4 w-fit">Course Narrative</h2>
              <div className="neumorphic-card p-8">
                <p className="text-foreground/70 leading-relaxed text-lg font-medium">
                  {subject.description}
                </p>
                <div className="mt-8 space-y-4">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-ctu-gold rounded-full" />
                    Learning Outcomes:
                  </h3>
                  <ul className="space-y-3 ml-4">
                    {[
                      `Understand the core principles of ${subject.name.toLowerCase()}.`,
                      'Apply theoretical knowledge to real-world industrial problems.',
                      'Develop critical thinking and analytical skills relevant to IE.'
                    ].map((outcome, i) => (
                      <li key={i} className="flex items-start gap-3 text-foreground/60 font-medium">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ctu-gold shrink-0" />
                        {outcome}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Prerequisite Chain */}
            <section className="space-y-6">
              <h2 className="text-4xl font-display font-black text-foreground tracking-tight border-b-4 border-ctu-maroon pb-4 w-fit">Prerequisite Flow</h2>
              <div className="p-8 neumorphic-card rounded-[2.5rem] bg-foreground/[0.02]">
                {prerequisites.length > 0 ? (
                  <div className="flex flex-col md:flex-row flex-wrap items-center gap-8 md:gap-4">
                    {prerequisites.map((prereq, i) => {
                      const preStatus = progressMap[prereq.id]?.status || 'not_yet';
                      return (
                        <React.Fragment key={prereq.id}>
                          <Link to={`/catalog/${prereq.id}`} className="w-full md:w-auto">
                            <motion.div
                              whileHover={{ scale: 1.05 }}
                              className={cn(
                                "relative p-1 rounded-3xl transition-all duration-500",
                                preStatus === 'done' ? "bg-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]" : 
                                preStatus === 'in_progress' ? "bg-ctu-gold/20 shadow-[0_0_20px_rgba(212,160,23,0.1)]" : 
                                "bg-foreground/5"
                              )}
                            >
                              <div className="bg-background rounded-[1.4rem] p-5 neumorphic-raised border border-white/10 flex items-center gap-4 min-w-[220px]">
                                <div className={cn(
                                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors shadow-sm",
                                  preStatus === 'done' ? "bg-green-500 text-white" : 
                                  preStatus === 'in_progress' ? "bg-ctu-gold text-white" : 
                                  "bg-foreground/5 text-foreground/20"
                                )}>
                                  {preStatus === 'done' ? <CheckCircle2 size={20} /> : 
                                   preStatus === 'in_progress' ? <Clock size={20} /> : 
                                   <Circle size={20} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <p className={cn(
                                      "text-[10px] font-bold uppercase tracking-widest",
                                      preStatus === 'done' ? "text-green-500" : 
                                      preStatus === 'in_progress' ? "text-ctu-gold" : 
                                      "text-foreground/40"
                                    )}>
                                      {prereq.code}
                                    </p>
                                    <Badge variant="ghost" className={cn(
                                      "text-[8px] px-1.5 py-0 h-4 rounded-full font-black uppercase tracking-tighter",
                                      preStatus === 'done' ? "bg-green-500/10 text-green-600" : 
                                      preStatus === 'in_progress' ? "bg-ctu-gold/10 text-ctu-gold" : 
                                      "bg-foreground/10 text-foreground/40"
                                    )}>
                                      {preStatus.replace('_', ' ')}
                                    </Badge>
                                  </div>
                                  <p className="text-sm font-bold text-foreground truncate max-w-[140px]">{prereq.name}</p>
                                </div>
                              </div>
                            </motion.div>
                          </Link>
                          <div className="flex md:block items-center justify-center">
                            <ChevronRight className="text-foreground/10 rotate-90 md:rotate-0" size={24} />
                          </div>
                        </React.Fragment>
                      );
                    })}
                    
                    <motion.div
                      animate={{ scale: [1, 1.02, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="p-1 rounded-3xl bg-ctu-maroon/20 shadow-[0_0_25px_rgba(146,18,34,0.15)] w-full md:w-auto"
                    >
                      <div className="bg-background rounded-[1.4rem] p-5 neumorphic-pressed border-2 border-ctu-maroon/10 flex items-center gap-4 min-w-[220px]">
                        <div className="w-10 h-10 rounded-xl bg-ctu-maroon text-white flex items-center justify-center shrink-0 shadow-lg shadow-ctu-maroon/20">
                          <Star size={20} className="fill-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-ctu-maroon mb-0.5 uppercase tracking-widest">Current Subject</p>
                          <p className="text-sm font-bold text-foreground truncate max-w-[140px]">{subject.name}</p>
                        </div>
                      </div>
                    </motion.div>
                  </div>
                ) : (
                  <div className="p-8 text-center text-foreground/40 italic font-medium">
                    <p className="text-lg">No direct prerequisites required for this course.</p>
                    <p className="text-xs mt-2 uppercase tracking-widest text-ctu-gold font-bold">You can start this subject immediately!</p>
                  </div>
                )}
              </div>
            </section>

            {/* Syllabus */}
            <section className="space-y-8">
              <div className="flex items-center justify-between pb-6 border-b border-foreground/5">
                <h2 className="text-4xl font-display font-black text-foreground tracking-tight border-b-4 border-blue-500 pb-4 w-fit">Curriculum Syllabus</h2>
                {isAdmin && (
                  <button 
                    onClick={handleOpenSyllabusDialog}
                    className="px-4 py-3 border border-ctu-gold/20 hover:bg-ctu-gold/5 rounded-2xl flex items-center gap-2 text-ctu-gold font-bold text-xs uppercase tracking-widest transition-all"
                  >
                    <UploadIcon size={16} />
                    Update Syllabus
                  </button>
                )}
              </div>

              {subject.isAvailable && subject.syllabusUrl ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    className="relative aspect-[3/4] max-w-[320px] mx-auto md:mx-0 neumorphic-card overflow-hidden group cursor-pointer"
                    onClick={() => window.open(subject.syllabusUrl!, '_blank')}
                  >
                    {/* Stylized Document Preview */}
                    <div className="absolute inset-0 bg-white p-8">
                      <div className="w-full h-full border-2 border-slate-100 rounded-lg p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
                            <FileText size={32} className="text-blue-500" />
                          </div>
                          <div className="text-right">
                            <div className="h-3 w-20 bg-slate-100 rounded ml-auto mb-2" />
                            <div className="h-2 w-12 bg-slate-50 rounded ml-auto" />
                          </div>
                        </div>
                        <div className="space-y-2 mt-4">
                          <div className="h-4 w-full bg-slate-200 rounded" />
                          <div className="h-4 w-3/4 bg-slate-200 rounded" />
                        </div>
                        <div className="space-y-2 mt-4">
                          <div className="h-2 w-full bg-slate-50 rounded" />
                          <div className="h-2 w-full bg-slate-50 rounded" />
                          <div className="h-2 w-full bg-slate-50 rounded" />
                          <div className="h-2 w-2/3 bg-slate-50 rounded" />
                        </div>
                        <div className="mt-auto space-y-2">
                          <div className="h-3 w-1/2 bg-slate-100 rounded" />
                          <div className="h-2 w-1/3 bg-slate-50 rounded" />
                        </div>
                      </div>
                    </div>
                    {/* Overlay with Action */}
                    <div className="absolute inset-0 bg-blue-900/0 group-hover:bg-blue-900/40 transition-all duration-300 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                        <div className="bg-white text-blue-600 px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2">
                          <Download size={18} />
                          Open Document
                        </div>
                      </div>
                    </div>
                    {/* Ribbon */}
                    <div className="absolute top-4 right-[-35px] rotate-45 bg-blue-500 text-white px-10 py-1 text-[10px] font-black uppercase tracking-widest shadow-lg">
                      Official
                    </div>
                  </motion.div>

                  <div className="space-y-6">
                    <div>
                      <Badge className="bg-blue-500/10 text-blue-600 border-none px-3 py-1 mb-3 text-[10px] font-bold uppercase">Syllabus Available</Badge>
                      <h3 className="text-2xl font-bold mb-2">Subject Mastery Curriculum</h3>
                      <p className="text-foreground/60 leading-relaxed font-medium">
                        The full syllabus for {subject.name} ({subject.code}) is ready for extraction. Download the official PDF to view detailed modules, grading systems, and weekly schedules.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => window.open(subject.syllabusUrl!, '_blank')}
                        className="w-full md:w-fit px-8 py-4 bg-blue-600 text-white rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                      >
                        <Download size={20} />
                        Download Syllabus (PDF)
                      </button>
                      
                      {subject.updatedAt && (
                        <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest flex items-center gap-2">
                          <Clock size={12} />
                          Final Revision: {(subject.updatedAt as any)?.toDate?.()?.toLocaleDateString() || 'Recently'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="aspect-video neumorphic-pressed rounded-[2.5rem] flex flex-col items-center justify-center text-foreground/20 p-8 text-center">
                  <div className="w-24 h-24 rounded-3xl bg-foreground/5 flex items-center justify-center mb-6 relative">
                     <FileText size={48} className="opacity-20" />
                     <div className="absolute bottom-[-5px] right-[-5px] w-10 h-10 bg-ctu-maroon/10 rounded-full flex items-center justify-center">
                        <AlertCircle size={20} className="text-ctu-maroon" />
                     </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground/40 mb-2">Syllabus In Progress</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest max-w-[280px]">
                    Technical details for this course are currently being digitized by the IE department.
                  </p>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: Resources & Reviews */}
          <div className="space-y-10">
            {/* Study Resources */}
            <section className="space-y-8">
              <div className="flex items-center justify-between pb-6 border-b border-foreground/5">
                <h2 className="text-4xl font-display font-black text-foreground tracking-tight border-b-4 border-orange-500 pb-4 w-fit">Study Vault</h2>
                <div className="flex items-center gap-2">
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange}
                    accept=".pdf,.ppt,.pptx,.jpg,.jpeg,.png,.doc,.docx,.txt,.mp4"
                  />
                  <button 
                    onClick={handleQuickUploadClick}
                    className="p-3 neumorphic-raised hover:neumorphic-pressed rounded-xl text-ctu-maroon transition-all group relative"
                    title="Quick File Upload"
                  >
                    <UploadIcon size={20} />
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold uppercase tracking-widest pointer-events-none">Quick Upload</span>
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedFile(null);
                      setIsUploadModalOpen(true);
                    }}
                    className="p-3 neumorphic-raised hover:neumorphic-pressed rounded-xl text-ctu-gold transition-all group relative"
                    title="Add Custom Resource"
                  >
                    <Plus size={20} />
                    <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold uppercase tracking-widest pointer-events-none">Add Resource</span>
                  </button>
                </div>
              </div>
              <div className="space-y-4">
                {resources.length > 0 ? (
                  resources.map((res) => (
                    <Card 
                      key={res.id} 
                      onClick={() => {
                        if (res.url && res.url !== '#') window.open(res.url, '_blank');
                        else toast.info('No direct link available');
                      }}
                      className="neumorphic-card border-none hover:scale-[1.02] transition-all cursor-pointer group"
                    >
                      <CardContent className="p-6 flex items-center gap-5">
                        <div className="p-3 rounded-2xl neumorphic-pressed text-foreground/40 group-hover:text-ctu-gold transition-colors">
                          {res.type === 'notes' ? <FileText size={20} /> : 
                           res.type === 'video' ? <Video size={20} /> : 
                           res.type === 'youtube' ? <Youtube size={20} /> :
                           res.type === 'presentation' ? <FilePieChart size={20} /> :
                           res.type === 'document' ? <FileBarChart size={20} /> :
                           <LinkIcon size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate group-hover:text-ctu-gold transition-colors">{res.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="w-4 h-4 rounded-full neumorphic-pressed flex items-center justify-center text-[7px] font-bold text-ctu-gold">
                              {res.userName[0]}
                            </div>
                            <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest">By {res.userName}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {res.url && res.url.startsWith('data:') && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const link = document.createElement('a');
                                link.href = res.url;
                                link.download = res.fileName || 'resource';
                                link.click();
                              }}
                              className="p-2 rounded-lg text-ctu-gold hover:neumorphic-pressed transition-all"
                              title="Download"
                            >
                              <UploadIcon size={14} className="rotate-180" />
                            </button>
                          )}
                          <ExternalLink size={16} className="text-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="p-8 neumorphic-pressed rounded-3xl text-center text-foreground/20 italic text-sm font-medium">
                    No resources shared for this subject yet.
                  </div>
                )}
              </div>
            </section>

            {/* Ratings Summary */}
            <section className="space-y-6">
              <h2 className="text-4xl font-display font-black text-foreground tracking-tight">Ratings</h2>
              <Card className="neumorphic-card border-none">
                <CardContent className="p-8">
                  {ratings.length > 0 ? (
                    <>
                      <div className="flex items-center gap-6 mb-8">
                        <div className="text-5xl font-bold text-foreground">{averageRating}</div>
                        <div className="flex flex-col">
                          <div className="flex text-ctu-gold">
                            {[1, 2, 3, 4, 5].map(i => <Star key={i} size={18} fill={i <= Math.round(Number(averageRating)) ? "currentColor" : "none"} />)}
                          </div>
                          <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest mt-1">Based on {ratings.length} reviews</span>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        {ratingCounts.map(({ stars, count, percentage }) => (
                          <button 
                            key={stars} 
                            onClick={() => setSelectedStarFilter(selectedStarFilter === stars ? null : stars)}
                            className={cn(
                              "w-full flex items-center gap-4 text-[10px] font-bold transition-all hover:bg-foreground/5 p-1 rounded-lg",
                              selectedStarFilter === stars && "bg-ctu-gold/10 text-ctu-gold"
                            )}
                          >
                            <span className={cn("w-4", selectedStarFilter === stars ? "text-ctu-gold" : "text-foreground/40")}>{stars}</span>
                            <div className="flex-1 h-2 neumorphic-pressed rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full rounded-full transition-all duration-500",
                                  selectedStarFilter === stars ? "bg-ctu-gold shadow-[0_0_8px_rgba(212,160,23,0.6)]" : "bg-ctu-gold/60"
                                )}
                                style={{ width: `${percentage}%` }} 
                              />
                            </div>
                            <span className={cn("w-10 text-right", selectedStarFilter === stars ? "text-ctu-gold" : "text-foreground/40")}>{Math.round(percentage)}%</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-foreground/30 font-bold uppercase tracking-widest text-xs italic">No ratings yet</p>
                    </div>
                  )}

                  <div className="mt-8 pt-8 border-t border-foreground/5 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm flex items-center gap-2">
                        <MessageSquare size={16} className="text-ctu-gold" />
                        Student Reviews
                      </h3>
                      {selectedStarFilter && (
                        <Badge variant="outline" className="text-[10px] font-bold border-ctu-gold text-ctu-gold flex items-center gap-1.5 h-6">
                          {selectedStarFilter} Stars
                          <button onClick={() => setSelectedStarFilter(null)} className="hover:text-ctu-maroon">
                            <X size={10} />
                          </button>
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {filteredRatings.length > 0 ? (
                        filteredRatings.map((review: any) => (
                          <div key={review.id} className="p-4 rounded-2xl neumorphic-pressed space-y-3 group relative">
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full neumorphic-raised flex items-center justify-center overflow-hidden bg-background/50">
                                  {review.userAvatar ? (
                                    <img src={review.userAvatar} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <UserIcon size={14} className="text-foreground/20" />
                                  )}
                                </div>
                                <div>
                                  <p className={cn("text-xs font-bold flex items-center gap-2", review.userId === profile.uid ? "text-ctu-gold" : "text-foreground")}>
                                    {review.userName}
                                    {review.userId === profile.uid && <span className="text-[8px] uppercase tracking-widest text-ctu-gold/50">(You)</span>}
                                    {review.isLive && <Badge className="bg-blue-500/10 text-blue-500 border-none text-[8px] px-1.5 py-0 h-4 font-black uppercase">Live</Badge>}
                                    {review.isImported && <Badge className="bg-green-500/10 text-green-500 border-none text-[8px] px-1.5 py-0 h-4 font-black uppercase">Verified Source</Badge>}
                                  </p>
                                  <p className="text-[9px] text-foreground/40 font-bold uppercase tracking-widest">
                                    {(review.createdAt as any)?.toDate ? (review.createdAt as any).toDate().toLocaleDateString() : 'Just now'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex text-ctu-gold gap-0.5">
                                {[1, 2, 3, 4, 5].map(i => (
                                  <Star key={i} size={10} fill={i <= review.rating ? "currentColor" : "none"} strokeWidth={3} />
                                ))}
                              </div>
                            </div>
                            
                            {review.feedback && (
                              <p className="text-xs text-foreground/70 font-medium leading-relaxed italic">
                                "{review.feedback}"
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-2">
                              <button 
                                onClick={() => handleLikeReview(review.id)}
                                className={cn(
                                  "flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest transition-all",
                                  review.likedBy?.includes(profile.uid) ? "text-ctu-gold" : "text-foreground/20 hover:text-ctu-gold"
                                )}
                              >
                                <ThumbsUp size={12} fill={review.likedBy?.includes(profile.uid) ? "currentColor" : "none"} />
                                Helpful ({review.likes || 0})
                              </button>

                              {review.userId === profile.uid && (
                                <button
                                  onClick={() => handleDeleteRating(review.id)}
                                  disabled={isDeleteLoading === review.id}
                                  className="p-2 text-foreground/20 hover:text-red-500 transition-colors disabled:opacity-50"
                                  title="Delete Rating"
                                >
                                  {isDeleteLoading === review.id ? (
                                    <div className="w-3 h-3 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <Trash2 size={12} />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 text-foreground/20 italic text-xs font-bold">
                          No reviews match your filter.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-10">
                    <button 
                      onClick={() => setIsRatingModalOpen(true)}
                      className="w-full py-4 neumorphic-raised hover:neumorphic-pressed rounded-2xl text-foreground font-bold transition-all"
                    >
                      Rate this Subject
                    </button>
                  </div>

                  <Dialog open={isRatingModalOpen} onOpenChange={setIsRatingModalOpen}>
                    <DialogContent className="neumorphic-card border-none text-foreground max-w-md p-0 overflow-hidden">
                      <div className="p-10 space-y-8">
                        <DialogHeader>
                          <ModalTitle className="text-3xl font-bold text-foreground">Rate {subject.name}</ModalTitle>
                          <ModalDescription className="text-foreground/60 font-medium">
                            Share your experience with this subject to help other IE students.
                          </ModalDescription>
                        </DialogHeader>

                          <div className="space-y-6">
                            <div className="flex flex-col items-center gap-4">
                              <p className="text-[10px] font-bold text-ctu-gold uppercase tracking-[2px]">Your Rating</p>
                              <div className="flex gap-3">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    onClick={() => setUserRating(star)}
                                    className="transition-transform hover:scale-110 active:scale-95 p-1"
                                  >
                                    <Star 
                                      size={40} 
                                      className={cn(
                                        "transition-colors",
                                        star <= userRating ? "text-ctu-gold fill-ctu-gold" : "text-foreground/10"
                                      )} 
                                    />
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <p className="text-xs font-bold text-foreground/60 uppercase tracking-widest">Feedback (Optional)</p>
                              <Textarea 
                                placeholder="What did you think about the course content, difficulty, or faculty?"
                                value={feedback}
                                onChange={(e) => setFeedback(e.target.value)}
                                className="neumorphic-pressed border-none text-foreground min-h-[140px] focus:ring-ctu-gold rounded-2xl p-5 placeholder:text-foreground/20"
                              />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl neumorphic-pressed">
                              <div className="space-y-0.5">
                                <p className="text-xs font-bold">Anonymous Review</p>
                                <p className="text-[10px] text-foreground/40">Keep your identity hidden from other students</p>
                              </div>
                              <Switch 
                                checked={isAnonymous}
                                onCheckedChange={setIsAnonymous}
                              />
                            </div>
                          </div>

                        <div className="pt-4">
                          <button 
                            onClick={handleSubmitRating}
                            disabled={isSubmittingRating}
                            className={cn(
                              "w-full py-4 neumorphic-raised hover:neumorphic-pressed rounded-2xl text-foreground font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                              isSubmittingRating && "neumorphic-pressed"
                            )}
                          >
                            {isSubmittingRating ? (
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-ctu-gold border-t-transparent rounded-full animate-spin" />
                                Submitting...
                              </div>
                            ) : "Submit Rating"}
                          </button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Admin Upload Dialog */}
      <Dialog open={isSyllabusDialogOpen} onOpenChange={setIsSyllabusDialogOpen}>
        <DialogContent className="sm:max-w-md bg-background border border-foreground/5 rounded-[32px] overflow-hidden">
          <DialogHeader>
            <ModalTitle className="text-2xl font-bold flex items-center gap-2">
              <div className="p-2 bg-ctu-gold/10 rounded-xl">
                <FileText className="text-ctu-gold" size={20} />
              </div>
              Update Syllabus
            </ModalTitle>
            <ModalDescription className="text-foreground/40">
              Update the syllabus for <span className="text-foreground font-bold">{subject?.code}</span>
            </ModalDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest text-foreground/40 ml-1">
                Google Drive Preview Link
              </p>
              <textarea
                placeholder="Paste preview link here..."
                value={syllabusUrlInput}
                onChange={(e) => setSyllabusUrlInput(e.target.value)}
                className="w-full bg-foreground/5 border-none min-h-[100px] rounded-xl focus:ring-ctu-gold p-4 text-sm font-medium focus:outline-none"
              />
              <p className="text-[10px] text-foreground/30 italic ml-1">
                Tip: Link should end in /preview for best embedding
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={() => setIsSyllabusDialogOpen(false)}
              className="px-4 py-2 rounded-xl font-bold text-sm hover:bg-foreground/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSyllabus}
              disabled={isSavingSyllabus || !syllabusUrlInput.trim()}
              className="bg-ctu-gold hover:bg-ctu-gold/90 text-white rounded-xl px-8 py-2 font-bold text-sm shadow-lg shadow-ctu-gold/20 disabled:opacity-50"
            >
              {isSavingSyllabus ? "Saving..." : "Save Syllabus"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <UploadResourceModal 
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setSelectedFile(null);
        }}
        onUpload={handleUpload}
        initialSubjectId={subject.id}
        initialFile={selectedFile}
      />
    </div>
  );
}
