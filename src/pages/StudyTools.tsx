import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  MessageSquare, 
  Layers, 
  BookOpen, 
  BrainCircuit,
  Plus,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  Award,
  Clock,
  Calendar,
  ChevronRight,
  Sparkles,
  HelpCircle,
  Info,
  X,
  ChevronLeft,
  ChevronUp,
  Flag,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  MoreVertical,
  FolderOpen,
  Maximize,
  Zap,
  Target,
  AlertCircle,
  Lock,
  Loader2,
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
  User as UserIcon,
  Music,
  Variable,
  Settings,
  Factory,
  Beaker,
  Table,
  Globe,
  Lightbulb,
  Trophy,
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
  Megaphone,
  BookText,
  Leaf,
  Building,
  ClipboardCheck,
  Truck,
  Share2,
  Box,
  Waves,
  Book,
  UserPlus,
  Compass,
  Copyright,
  Palette,
  Atom
} from 'lucide-react';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User, StudyGroup, StudyPost, Quiz, Subject, Progress as ProgressType, QuizResult } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { generateStudyPlan, generateQuiz, askQuestion, isAIAvailable } from '@/src/lib/gemini';
import { db, auth as firebaseAuth } from '@/src/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, where, getDocs, getDoc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '@/src/lib/firestoreErrorHandler';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { GlowCard } from '@/components/ui/spotlight-card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn, anonymizeName } from '@/src/lib/utils';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/src/context/AuthContext';
import { useProgress } from '@/src/hooks/useProgress';
import NotebookList from '@/src/components/notebook/NotebookList';
import NotebookWorkspace from '@/src/components/notebook/NotebookWorkspace';
import ReactMarkdown from 'react-markdown';

// Session Types
type Flashcard = { front: string; back: string };
type QuizQuestion = { question: string; options: string[]; answerIndex: number; explanation: string };


export default function StudyTools() {
  const { profile: user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('advisor');
  const [roadmap, setRoadmap] = useState<any[]>(() => {
    const saved = localStorage.getItem('ctu_hub_roadmap');
    return saved ? JSON.parse(saved) : [];
  });
  const { progressMap, loading: progressLoading } = useProgress();
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [studyGroups, setStudyGroups] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [isAskQuestionModalOpen, setIsAskQuestionModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null);
  const [isAnswering, setIsAnswering] = useState(false);
  const [newAnswer, setNewAnswer] = useState('');
  const [isAdvisorChatOpen, setIsAdvisorChatOpen] = useState(false);
  const [advisorChat, setAdvisorChat] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [advisorInput, setAdvisorInput] = useState('');
  const [isAdvisorLoading, setIsAdvisorLoading] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', subjectCode: '' });
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [newQuestion, setNewQuestion] = useState({ title: '', content: '', subjectTag: '' });
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [quizResults, setQuizResults] = useState<QuizResult[]>([]);
  const [quizSubject, setQuizSubject] = useState<string>('Industrial Engineering');

  // Roadmap Filtering & Status state
  const [roadmapStatusFilter, setRoadmapStatusFilter] = useState<string>('all');
  const [roadmapPriorityFilter, setRoadmapPriorityFilter] = useState<string>('all');
  const [roadmapSortBy, setRoadmapSortBy] = useState<string>('order');

  const filteredRoadmap = useMemo(() => {
    let result = roadmap.map((step, index) => ({ 
      ...step, 
      originalIndex: index,
      status: step.status || 'todo',
      priority: step.priority || (step.difficulty === 'hard' ? 'high' : step.difficulty === 'medium' ? 'medium' : 'low')
    }));

    if (roadmapStatusFilter !== 'all') {
      result = result.filter(step => step.status === roadmapStatusFilter);
    }

    if (roadmapPriorityFilter !== 'all') {
      result = result.filter(step => step.priority === roadmapPriorityFilter);
    }

    // Sort logic
    if (roadmapSortBy === 'priority') {
      const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
      result.sort((a, b) => (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0));
    } else if (roadmapSortBy === 'difficulty') {
      const diffWeight: Record<string, number> = { hard: 3, medium: 2, easy: 1 };
      result.sort((a, b) => (diffWeight[b.difficulty] || 0) - (diffWeight[a.difficulty] || 0));
    } else {
      result.sort((a, b) => a.originalIndex - b.originalIndex);
    }

    return result;
  }, [roadmap, roadmapStatusFilter, roadmapPriorityFilter, roadmapSortBy]);

  const updateRoadmapStep = (index: number, updates: any) => {
    const newRoadmap = [...roadmap];
    newRoadmap[index] = { ...newRoadmap[index], ...updates };
    setRoadmap(newRoadmap);
    localStorage.setItem('ctu_hub_roadmap', JSON.stringify(newRoadmap));
  };

  // Flashcards state
  const [decks, setDecks] = useState<any[]>([]);
  const [deckSearchQuery, setDeckSearchQuery] = useState('');
  const [deckSubjectFilter, setDeckSubjectFilter] = useState('all');
  
  const [selectedDeck, setSelectedDeck] = useState<any | null>(null);
  const [cardSearchQuery, setCardSearchQuery] = useState('');
  
  const [deckCards, setDeckCards] = useState<any[]>([]);
  const [isNewDeckModalOpen, setIsNewDeckModalOpen] = useState(false);
  const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
  const [newDeck, setNewDeck] = useState({ name: '', description: '', subjectId: '', color: 'maroon' });
  const [newCard, setNewCard] = useState({ front: '', back: '' });
  
  const filteredDecks = decks.filter(deck => {
    const matchesSearch = deck.name?.toLowerCase().includes(deckSearchQuery.toLowerCase()) || 
                          deck.description?.toLowerCase().includes(deckSearchQuery.toLowerCase());
    const matchesSubject = deckSubjectFilter === 'all' || deck.subjectId === deckSubjectFilter;
    return matchesSearch && matchesSubject;
  });

  const filteredCards = deckCards.filter(card => {
    return card.front?.toLowerCase().includes(cardSearchQuery.toLowerCase()) || 
           card.back?.toLowerCase().includes(cardSearchQuery.toLowerCase());
  });

  const filteredStudyGroups = studyGroups.filter(group => {
    const matchesSearch = group.name?.toLowerCase().includes(groupSearchQuery.toLowerCase()) || 
                          group.description?.toLowerCase().includes(groupSearchQuery.toLowerCase());
    const matchesSubject = group.subjectCode?.toLowerCase().includes(groupSearchQuery.toLowerCase());
    return matchesSearch || matchesSubject;
  });
  const [activeChatGroup, setActiveChatGroup] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Quiz/Flashcard Session State
  const [activeSession, setActiveSession] = useState<{ type: 'quiz' | 'flashcards', data: any } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [isQuizComplete, setIsQuizComplete] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(false);

  const navigate = useNavigate();
  const aiAvailable = isAIAvailable();
  
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

  const getSubjectInfo = useCallback((code: string) => {
    return IE_SUBJECTS.find(s => s.code.toLowerCase() === code.toLowerCase() || s.id.toLowerCase() === code.toLowerCase());
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    }

    // Real-time forum questions
    const q = query(collection(db, 'questions'), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribeQA = onSnapshot(q, (snapshot) => {
      const qs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setQuestions(qs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'questions');
    });

    // Real-time study groups
    const g = query(collection(db, 'studyGroups'), limit(12));
    const unsubscribeGroups = onSnapshot(g, (snapshot) => {
      const gs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudyGroups(gs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'studyGroups');
    });

    // Real-time flashcard decks
    const d = query(collection(db, 'flashcardDecks'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubscribeDecks = onSnapshot(d, (snapshot) => {
      const ds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDecks(ds);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'flashcardDecks');
    });
    
    // Real-time quiz results
    const qr = query(collection(db, 'quizResults'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(10));
    const unsubscribeQuizResults = onSnapshot(qr, (snapshot) => {
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuizResult));
      setQuizResults(results);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'quizResults');
    });

    return () => {
      unsubscribeQA();
      unsubscribeGroups();
      unsubscribeDecks();
      unsubscribeQuizResults();
    };
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!selectedDeck || !user) {
      setDeckCards([]);
      return;
    }

    const c = query(collection(db, 'flashcardDecks', selectedDeck.id, 'cards'), orderBy('createdAt', 'asc'));
    const unsubscribeCards = onSnapshot(c, (snapshot) => {
      const cs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeckCards(cs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `flashcardDecks/${selectedDeck.id}/cards`);
    });

    return () => unsubscribeCards();
  }, [selectedDeck, user]);

  useEffect(() => {
    if (!activeChatGroup) {
      setChatMessages([]);
      return;
    }

    const q = query(
      collection(db, 'studyGroups', activeChatGroup.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChatMessages(msgs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `studyGroups/${activeChatGroup.id}/messages`);
    });

    return () => unsubscribe();
  }, [activeChatGroup]);

  const handleGenerateRoadmap = async () => {
    if (!aiAvailable) {
      toast.error("AI is not configured. Add an AI API Key to your environment.");
      return;
    }
    setIsGenerating(true);
    
    try {
      const plan = await generateStudyPlan(progressMap, IE_SUBJECTS);
      if (plan && Array.isArray(plan) && plan.length > 0) {
        setRoadmap(plan);
        localStorage.setItem('ctu_hub_roadmap', JSON.stringify(plan));
        toast.success("Personalized roadmap generated by IE Matrix AI Advisor!");
      } else {
        toast.error("Could not generate roadmap. Please try again.");
      }
    } catch (error) {
      console.error("Roadmap generation failed:", error);
      toast.error("Failed to generate advisor advice.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdvisorChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advisorInput.trim() || isAdvisorLoading) return;

    if (!aiAvailable) {
      toast.error("AI Advisor requires an AI API Key. Please configure your environment.");
      return;
    }

    const userMsg = { role: 'user' as const, content: advisorInput };
    setAdvisorChat(prev => [...prev, userMsg]);
    const currentInput = advisorInput;
    setAdvisorInput('');
    setIsAdvisorLoading(true);

    try {
      // Build a comprehensive context for the advisor
      const chatHistory = advisorChat.slice(-6).map(m => `${m.role === 'user' ? 'STUDENT' : 'ADVISOR'}: ${m.content}`).join('\n');
      
      const fullContext = `
        CTU IE CURRICULUM OVERVIEW: ${IE_SUBJECTS.length} Subjects.
        STUDENT CURRENT PROGRESS: ${JSON.stringify(progressMap)}
        CURRENT ROADMAP STEPS: ${JSON.stringify(roadmap.map(r => ({ title: r.title, status: r.status })))}
        CHAT HISTORY SUMMARY:
        ${chatHistory}
      `;
      
      const response = await askQuestion(currentInput, fullContext);
      setAdvisorChat(prev => [...prev, { role: 'ai' as const, content: response }]);
    } catch (error) {
      console.error("Advisor Chat Error:", error);
      toast.error("AI Advisor is currently unavailable. Please try again later.");
    } finally {
      setIsAdvisorLoading(false);
    }
  };

  const handlePostAnswer = async (questionId: string) => {
    if (!user || !newAnswer.trim()) return;
    setIsAnswering(true);
    try {
      const qRef = doc(db, 'questions', questionId);
      await updateDoc(qRef, {
        answerCount: (selectedQuestion.answerCount || 0) + 1,
        latestAnswer: {
          content: newAnswer,
          userName: user.fullName,
          createdAt: new Date().toISOString()
        }
      });
      setNewAnswer('');
      toast.success("Your answer has been posted!");
    } catch (error) {
      toast.error("Failed to post answer.");
    } finally {
      setIsAnswering(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'studyGroups', groupId), {
        members: arrayUnion(user.uid)
      });
      toast.success("Joined study group!");
    } catch (error) {
      toast.error("Failed to join group.");
    }
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroup.name || !newGroup.subjectCode) {
      toast.error("Please fill in the required fields");
      return;
    }
    try {
      await addDoc(collection(db, 'studyGroups'), {
        ...newGroup,
        creatorId: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp()
      });
      setIsNewGroupModalOpen(false);
      setNewGroup({ name: '', description: '', subjectCode: '' });
      toast.success("Study group created!");
    } catch (error) {
      toast.error("Failed to create group.");
    }
  };

  const handleAskQuestion = async () => {
    if (!user || !newQuestion.title) {
      toast.error("Please provide a title for your question");
      return;
    }
    try {
      await addDoc(collection(db, 'questions'), {
        ...newQuestion,
        userId: user.uid,
        userName: user.fullName,
        votes: 0,
        answerCount: 0,
        createdAt: serverTimestamp()
      });
      setIsAskQuestionModalOpen(false);
      setNewQuestion({ title: '', content: '', subjectTag: '' });
      toast.success("Question posted!");
    } catch (error) {
      toast.error("Failed to post question.");
    }
  };

  const handleVote = async (questionId: string, currentVotes: number) => {
    try {
      await updateDoc(doc(db, 'questions', questionId), {
        votes: currentVotes + 1
      });
    } catch (error) {
      toast.error("Failed to register vote.");
    }
  };

  const handleReportQuestion = async (q: any) => {
    try {
      await updateDoc(doc(db, 'questions', q.id), {
        reportCount: (q.reportCount || 0) + 1
      });
      toast.success("Question reported. Moderation will review it soon.");
    } catch (error) {
      toast.error("Failed to report.");
    }
  };

  const handleFlagQuestion = async (q: any) => {
    try {
      await updateDoc(doc(db, 'questions', q.id), {
        isFlagged: !q.isFlagged
      });
      toast.success(q.isFlagged ? "Flag removed" : "Question flagged");
      if (selectedQuestion?.id === q.id) {
        setSelectedQuestion({ ...selectedQuestion, isFlagged: !q.isFlagged });
      }
    } catch (error) {
      toast.error("Failed to update status.");
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!window.confirm("Permanently delete this question?")) return;
    try {
      await deleteDoc(doc(db, 'questions', qId));
      setSelectedQuestion(null);
      toast.success("Question removed from forum.");
    } catch (error) {
      toast.error("Deletion failed.");
    }
  };

  const handleFlagAnswer = async (q: any) => {
    if (!q.latestAnswer) return;
    try {
      await updateDoc(doc(db, 'questions', q.id), {
        'latestAnswer.isFlagged': !q.latestAnswer.isFlagged
      });
      toast.success(q.latestAnswer.isFlagged ? "Flag removed from answer" : "Answer flagged");
      if (selectedQuestion?.id === q.id) {
        setSelectedQuestion({ 
          ...selectedQuestion, 
          latestAnswer: { ...selectedQuestion.latestAnswer, isFlagged: !q.latestAnswer.isFlagged }
        });
      }
    } catch (error) {
      toast.error("Failed to flag answer.");
    }
  };

  const handleDeleteAnswer = async (q: any) => {
    if (!window.confirm("Remove this answer?")) return;
    try {
      await updateDoc(doc(db, 'questions', q.id), {
        latestAnswer: null,
        answerCount: Math.max(0, (q.answerCount || 1) - 1)
      });
      toast.success("Answer removed.");
      if (selectedQuestion?.id === q.id) {
        setSelectedQuestion({ 
          ...selectedQuestion, 
          latestAnswer: null, 
          answerCount: Math.max(0, (q.answerCount || 1) - 1)
        });
      }
    } catch (error) {
      toast.error("Failed to remove answer.");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChatGroup || !chatInput.trim()) return;

    try {
      await addDoc(collection(db, 'studyGroups', activeChatGroup.id, 'messages'), {
        text: chatInput,
        userId: user.uid,
        userName: user.fullName,
        createdAt: serverTimestamp()
      });
      setChatInput('');
    } catch (error) {
      toast.error("Failed to send message.");
    }
  };

  const handleCreateDeck = async () => {
    if (!user || !newDeck.name) {
      toast.error("Please provide a name for the deck");
      return;
    }
    try {
      await addDoc(collection(db, 'flashcardDecks'), {
        ...newDeck,
        userId: user.uid,
        cardCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsNewDeckModalOpen(false);
      setNewDeck({ name: '', description: '', subjectId: '', color: 'maroon' });
      toast.success("Flashcard deck created!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'flashcardDecks');
      toast.error("Failed to create deck.");
    }
  };

  const handleAddCard = async () => {
    if (!user || !selectedDeck || !newCard.front || !newCard.back) {
      toast.error("Please fill in both sides of the card");
      return;
    }
    try {
      await addDoc(collection(db, 'flashcardDecks', selectedDeck.id, 'cards'), {
        ...newCard,
        deckId: selectedDeck.id,
        userId: user.uid,
        status: 'learning',
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        nextReview: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      // Update card count in deck
      const deckRef = doc(db, 'flashcardDecks', selectedDeck.id);
      await updateDoc(deckRef, {
        cardCount: (selectedDeck.cardCount || 0) + 1,
        updatedAt: serverTimestamp()
      });

      setNewCard({ front: '', back: '' });
      toast.success("Card added!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `flashcardDecks/${selectedDeck.id}/cards`);
      toast.error("Failed to add card.");
    }
  };

  const handleMarkCardKnown = async (cardId: string) => {
    if (!selectedDeck) return;
    try {
      const cardRef = doc(db, 'flashcardDecks', selectedDeck.id, 'cards', cardId);
      await updateDoc(cardRef, {
        status: 'known'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `flashcardDecks/${selectedDeck.id}/cards/${cardId}`);
      toast.error("Failed to update card status.");
    }
  };

  const handleRateCard = async (cardId: string, quality: number) => {
    if (!selectedDeck) return;
    try {
      const card = deckCards.find(c => c.id === cardId);
      if (!card) return;

      let { interval, easeFactor, repetitions } = card;
      interval = interval || 0;
      easeFactor = easeFactor || 2.5;
      repetitions = repetitions || 0;

      if (quality < 3) {
        repetitions = 0;
        interval = 1;
      } else {
        if (repetitions === 0) {
          interval = 1;
        } else if (repetitions === 1) {
          interval = 6;
        } else {
          interval = Math.round(interval * easeFactor);
        }
        repetitions += 1;
      }

      easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
      if (easeFactor < 1.3) easeFactor = 1.3;

      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + interval);

      const cardRef = doc(db, 'flashcardDecks', selectedDeck.id, 'cards', cardId);
      await updateDoc(cardRef, {
        interval,
        easeFactor,
        repetitions,
        nextReview: nextReview.toISOString(),
        status: quality >= 4 ? 'known' : 'learning'
      });

      toast.success("Card updated!");
      
      // Move to next card or end session
      if (currentStep < activeSession.data.length - 1) {
        setCurrentStep(prev => prev + 1);
        setIsFlipped(false);
      } else {
        setActiveSession(null);
        toast("Session completed!");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `flashcardDecks/${selectedDeck.id}/cards/${cardId}`);
    }
  };

  const startFlashcardSession = (deck: any) => {
    if (deckCards.length === 0) {
      toast.error("This deck has no cards yet!");
      return;
    }
    
    // Sort deckCards: Due cards first
    const sortedCards = [...deckCards].sort((a, b) => {
      const aDue = !a.nextReview || new Date(a.nextReview) <= new Date();
      const bDue = !b.nextReview || new Date(b.nextReview) <= new Date();
      if (aDue && !bDue) return -1;
      if (!aDue && bDue) return 1;
      return 0;
    });

    setActiveSession({ type: 'flashcards', data: sortedCards });
    setCurrentStep(0);
    setIsFlipped(false);
  };

  const startQuizSession = async (subjectName: string) => {
    if (!aiAvailable) {
      toast.error("AI is not configured. Start Quiz is disabled.");
      return;
    }
    setIsSessionLoading(true);
    setQuizSubject(subjectName);
    try {
      const questions = await generateQuiz(subjectName);
      if (questions.length === 0) throw new Error("No questions generated");
      setActiveSession({ type: 'quiz', data: questions });
      setCurrentStep(0);
      setQuizScore(0);
      setIsQuizComplete(false);
    } catch (error) {
      toast.error("Failed to load quiz. Try again.");
    } finally {
      setIsSessionLoading(false);
    }
  };

  const handleFinishQuiz = async () => {
    if (!user) return;
    
    try {
      await addDoc(collection(db, 'quizResults'), {
        userId: user.uid,
        subjectName: quizSubject,
        score: quizScore,
        total: 5,
        createdAt: serverTimestamp()
      });
      toast.success("Result saved to your history!");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'quizResults');
    } finally {
      setActiveSession(null);
    }
  };

  const filteredQuestions = questions.filter(q => 
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    q.subjectTag?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || (activeTab === 'advisor' && progressLoading && roadmap.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loader"></div>
      </div>
    );
  }

  if (activeSession) {
    return (
      <div className="min-h-screen bg-background text-foreground p-3 sm:p-6 lg:p-10 flex flex-col items-center justify-center relative overflow-x-hidden">
        <Button 
          variant="ghost" 
          onClick={() => setActiveSession(null)}
          className="absolute top-4 sm:top-10 left-4 sm:left-10 neumorphic-raised rounded-xl h-10 sm:h-auto text-[10px] sm:text-sm"
        >
          <ChevronLeft size={16} className="mr-1" /> Exit Session
        </Button>

        <div className="max-w-xl w-full pt-12 sm:pt-0">
          {activeSession.type === 'flashcards' ? (
            <div className="space-y-8">
              <div className="text-center">
                <Badge className="bg-ctu-gold text-white font-bold mb-4">FLASHCARD {currentStep + 1}/{activeSession.data.length}</Badge>
                <div className="h-2 bg-foreground/5 rounded-full overflow-hidden w-full">
                  <div className="h-full bg-ctu-gold transition-all duration-300" style={{ width: `${((currentStep + 1) / activeSession.data.length) * 100}%` }} />
                </div>
              </div>

              <div className="perspective-1000 h-[350px] md:h-[450px]">
                <motion.div 
                  key={currentStep}
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.7, type: "spring", stiffness: 200, damping: 25 }}
                  className="relative w-full h-full cursor-pointer preserve-3d"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  {/* Front */}
                  <div className="absolute inset-0 backface-hidden flex items-center justify-center p-10 text-center bg-white rounded-[3rem] neumorphic-raised border border-white/20 shadow-2xl">
                    <div className="space-y-4 sm:space-y-6">
                      <div className="w-12 h-1 sm:w-16 sm:h-1 bg-ctu-gold/20 rounded-full mx-auto" />
                      <span className="text-[8px] sm:text-[10px] font-black text-foreground/20 uppercase tracking-[0.4em]">Inquiry Segment</span>
                      <h2 className="text-xl sm:text-3xl md:text-4xl font-black text-foreground leading-[1.1] tracking-tighter uppercase">
                        {activeSession.data[currentStep].front}
                      </h2>
                    </div>
                  </div>
                  
                  {/* Back */}
                  <div 
                    className="absolute inset-0 backface-hidden flex items-center justify-center p-6 sm:p-10 text-center bg-background rounded-[2rem] sm:rounded-[3rem] neumorphic-pressed border border-foreground/5 rotate-y-180 shadow-inner"
                  >
                    <div className="space-y-4 sm:space-y-6">
                      <div className="w-12 h-1 sm:w-16 sm:h-1 bg-ctu-maroon/20 rounded-full mx-auto" />
                      <span className="text-[8px] sm:text-[10px] font-black text-ctu-maroon/40 uppercase tracking-[0.4em]">Response Synthesis</span>
                      <p className="text-sm sm:text-xl md:text-2xl font-black text-foreground/80 tracking-tight leading-relaxed uppercase">
                        {activeSession.data[currentStep].back}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="flex flex-col gap-4 sm:gap-6">
                {!isFlipped ? (
                  <Button 
                    onClick={() => setIsFlipped(true)}
                    className="w-full h-12 sm:h-16 rounded-[1.5rem] sm:rounded-[2rem] bg-ctu-maroon text-white font-black uppercase tracking-widest text-[9px] sm:text-sm shadow-2xl shadow-ctu-maroon/30 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Decrypt Answer
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                    {[
                      { label: 'Again', quality: 0, color: 'bg-red-500 hover:bg-red-600 shadow-red-500/20' },
                      { label: 'Hard', quality: 2, color: 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/20' },
                      { label: 'Good', quality: 4, color: 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/20' },
                      { label: 'Easy', quality: 5, color: 'bg-green-500 hover:bg-green-600 shadow-green-500/20' }
                    ].map((btn) => (
                      <Button
                        key={btn.label}
                        onClick={() => handleRateCard(activeSession.data[currentStep].id, btn.quality)}
                        className={cn("h-11 sm:h-14 rounded-xl sm:rounded-2xl text-white font-black uppercase tracking-wider text-[8px] sm:text-[11px] shadow-lg hover:scale-105 active:scale-95 transition-all", btn.color)}
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-between items-center px-2">
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      if (currentStep > 0) {
                        setCurrentStep(currentStep - 1);
                        setIsFlipped(false);
                      }
                    }}
                    disabled={currentStep === 0}
                    className="text-xs font-bold text-foreground/40"
                  >
                    <ChevronLeft size={14} className="mr-1" /> Previous
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => {
                      if (currentStep < activeSession.data.length - 1) {
                        setCurrentStep(currentStep + 1);
                        setIsFlipped(false);
                      }
                    }}
                    disabled={currentStep === activeSession.data.length - 1}
                    className="text-xs font-bold text-foreground/40"
                  >
                    Next <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {!isQuizComplete ? (
                <>
                  <div className="text-center">
                    <Badge className="bg-ctu-maroon text-white font-black uppercase tracking-widest mb-3 sm:mb-4 px-3 py-1 text-[8px] sm:text-[10px]">UNIT {currentStep + 1} / 5</Badge>
                    <div className="h-1.5 sm:h-2 bg-foreground/5 rounded-full overflow-hidden w-full">
                      <div className="h-full bg-ctu-maroon transition-all duration-300" style={{ width: `${((currentStep + 1) / 5) * 100}%` }} />
                    </div>
                  </div>

                  <GlowCard className="w-full h-auto p-4 sm:p-8" glowColor="blue" customSize>
                    <h3 className="text-lg sm:text-2xl font-black mb-6 sm:mb-8 leading-tight tracking-tight uppercase">{activeSession.data[currentStep].question}</h3>
                    <div className="grid gap-2 sm:gap-4">
                      {activeSession.data[currentStep].options.map((opt: string, idx: number) => (
                        <button 
                           key={idx}
                           onClick={() => {
                             if (idx === activeSession.data[currentStep].answerIndex) {
                               setQuizScore(prev => prev + 1);
                               toast.success("Correct!", { duration: 1000 });
                             } else {
                               toast.error("Incorrect!", { duration: 1000 });
                             }
                             
                             if (currentStep < 4) {
                               setCurrentStep(prev => prev + 1);
                             } else {
                               setIsQuizComplete(true);
                             }
                           }}
                           className="w-full text-left p-3 sm:p-5 rounded-xl sm:rounded-2xl neumorphic-raised border-none text-[10px] sm:text-base font-bold text-foreground hover:bg-foreground/5 hover:scale-[1.01] active:scale-95 transition-all flex items-start gap-3 sm:gap-4 shrink-0"
                        >
                           <div className="w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-foreground/5 flex items-center justify-center shrink-0 text-ctu-maroon font-black text-xs sm:text-base">
                             {String.fromCharCode(65 + idx)}
                           </div>
                           <span className="pt-1">{opt}</span>
                        </button>
                      ))}
                    </div>
                  </GlowCard>
                </>
              ) : (
                <div className="text-center py-20 space-y-8">
                  <div className="w-32 h-32 rounded-full neumorphic-raised flex items-center justify-center mx-auto bg-background border-4 border-ctu-gold">
                    <Award size={64} className="text-ctu-gold" />
                  </div>
                  <div>
                    <h2 className="text-4xl font-bold mb-2">Quiz Complete!</h2>
                    <p className="text-foreground/60">You scored {quizScore} out of 5</p>
                  </div>
                  <Button 
                    onClick={handleFinishQuiz}
                    className="h-14 px-12 rounded-2xl bg-ctu-gold text-white font-bold text-lg"
                  >
                    Back to Hub
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={user} />
      
      <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 pb-safe overflow-x-hidden">
        
        {/* AI Availability Banner */}
        {!aiAvailable && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-3 sm:p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3"
          >
            <AlertCircle size={20} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-amber-500">
                AI features require a Gemini API key (an AI API Key). 
              </p>
              <p className="text-[10px] sm:text-xs text-amber-500/70 font-medium">
                Non-AI features like flashcards and forums are fully available.
              </p>
            </div>
          </motion.div>
        )}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-8 lg:mb-16">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl frosted-header font-black tracking-tighter leading-[0.9] py-2 flex items-center flex-wrap gap-2 sm:gap-4">
                Study Hub <Sparkles className="text-ctu-gold shrink-0 sm:size-20" size={24} />
              </h1>
              <p className="text-foreground/40 mt-2 sm:mt-3 text-sm sm:text-base md:text-xl font-medium tracking-tight">
                Elevate your learning with AI guidance and community support.
              </p>
            </motion.div>
        </div>

        <Tabs defaultValue="advisor" value={activeTab} onValueChange={setActiveTab} className="space-y-6 sm:space-y-12">
          <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4 bg-background/90 backdrop-blur-3xl overflow-x-auto no-scrollbar border-b border-foreground/5 shadow-md">
            <TabsList className="bg-transparent h-auto p-0 gap-2.5 inline-flex min-w-max">
              {[
                { id: 'advisor', icon: BrainCircuit, label: 'Advisor' },
                { id: 'map', icon: Layers, label: 'Matrix' },
                { id: 'groups', icon: Users, label: 'Squads' },
                { id: 'qa', icon: MessageSquare, label: 'Forum' },
                { id: 'flashcards', icon: BookOpen, label: 'Recall' },
                { id: 'quizzes', icon: Award, label: 'Quizzes' },
                { id: 'notebooks', icon: FolderOpen, label: 'Vault' },
              ].map(tab => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "relative flex items-center gap-2.5 px-5 py-3 rounded-2xl text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap tap-target border border-transparent",
                    activeTab === tab.id 
                      ? "bg-ctu-maroon text-white shadow-xl shadow-ctu-maroon/20 scale-[1.05]" 
                      : "bg-background/50 text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70 neumorphic-raised border-foreground/5"
                  )}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none md:hidden" />
          </div>

          <TabsContent value="advisor" className="mt-0 space-y-8 outline-none">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <GlowCard className="w-full h-auto lg:col-span-2 p-4 sm:p-8" glowColor="orange" customSize>
                        <div className="flex flex-col gap-6 mb-8 sm:mb-10">
                          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
                            <div className="text-center sm:text-left">
                              <h2 className="text-2xl sm:text-4xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 sm:py-2 flex items-center flex-wrap gap-2 sm:gap-3 justify-center sm:justify-start">
                                 Roadmap <TrendingUp className="text-ctu-gold animate-bounce" size={24} />
                              </h2>
                              <p className="text-xs sm:text-base text-foreground/40 mt-1 font-medium italic">AI-generated sequence based on your IE data.</p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                              <Button 
                                onClick={() => setIsAdvisorChatOpen(true)}
                                className="neumorphic-raised text-ctu-gold font-black uppercase tracking-wider border-none h-12 rounded-xl text-[10px] hover:scale-[1.02] active:scale-95 transition-all w-full sm:w-32"
                              >
                                 Advisor
                              </Button>
                              <Button 
                                onClick={handleGenerateRoadmap} 
                                disabled={isGenerating}
                                className="bg-ctu-gold text-white font-black uppercase tracking-wider rounded-xl px-4 h-12 text-[10px] shadow-xl shadow-ctu-gold/20 hover:scale-[1.05] active:scale-95 transition-all w-full sm:w-32"
                              >
                                 {isGenerating ? "Processing..." : "Generate"}
                              </Button>
                            </div>
                          </div>
                        </div>

                    <div className="space-y-0 relative">
                      {roadmap.length > 0 ? (
                          <div className="mt-4 sm:mt-8 space-y-6 sm:space-y-12">
                            <div className="flex flex-col gap-4 mb-6 sm:mb-10 p-4 sm:p-6 rounded-[2rem] bg-foreground/[0.03] neumorphic-pressed border border-foreground/5 overflow-hidden relative">
                              <div className="absolute top-0 right-0 w-32 h-32 bg-ctu-gold/5 blur-3xl rounded-full" />
                              <div className="flex items-center gap-3 relative z-10">
                                <div className="w-8 h-8 rounded-full bg-ctu-gold/20 flex items-center justify-center text-ctu-gold">
                                  <Filter size={14} />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-foreground/60 italic">Matrix Filters</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap gap-3 relative z-10">
                                <Select value={roadmapStatusFilter} onValueChange={setRoadmapStatusFilter}>
                                  <SelectTrigger className="h-12 rounded-xl bg-background/80 backdrop-blur-sm neumorphic-raised border-none text-[9px] font-black uppercase tracking-widest px-4 active:neumorphic-pressed transition-all">
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-2xl border border-foreground/5 shadow-2xl bg-background/98 backdrop-blur-3xl">
                                    <SelectItem value="all" className="text-[10px] font-bold uppercase py-3 cursor-pointer">All Operational States</SelectItem>
                                    <SelectItem value="todo" className="text-[10px] font-bold uppercase py-3 cursor-pointer">Pending Execution</SelectItem>
                                    <SelectItem value="in_progress" className="text-[10px] font-bold uppercase py-3 cursor-pointer">Active Processing</SelectItem>
                                    <SelectItem value="done" className="text-[10px] font-bold uppercase py-3 cursor-pointer">Task Terminated</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Select value={roadmapPriorityFilter} onValueChange={setRoadmapPriorityFilter}>
                                  <SelectTrigger className="h-12 rounded-xl bg-background/80 backdrop-blur-sm neumorphic-raised border-none text-[9px] font-black uppercase tracking-widest px-4 active:neumorphic-pressed transition-all">
                                    <SelectValue placeholder="Priority" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-2xl border border-foreground/5 shadow-2xl bg-background/98 backdrop-blur-3xl">
                                    <SelectItem value="all" className="text-[10px] font-bold uppercase py-3 cursor-pointer">Unfiltered Priority</SelectItem>
                                    <SelectItem value="high" className="text-[10px] font-bold uppercase py-3 cursor-pointer">Critical Path</SelectItem>
                                    <SelectItem value="medium" className="text-[10px] font-bold uppercase py-3 cursor-pointer">Sub-Critical</SelectItem>
                                    <SelectItem value="low" className="text-[10px] font-bold uppercase py-3 cursor-pointer">Standard Cycle</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Select value={roadmapSortBy} onValueChange={setRoadmapSortBy}>
                                  <SelectTrigger className="h-12 rounded-xl bg-background/80 backdrop-blur-sm neumorphic-raised border-none text-[9px] font-black uppercase tracking-widest px-4 active:neumorphic-pressed transition-all">
                                    <SelectValue placeholder="Sort" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-2xl border border-foreground/5 shadow-2xl bg-background/98 backdrop-blur-3xl">
                                    <SelectItem value="order" className="text-[10px] font-bold uppercase py-3 cursor-pointer">Matrix Sequence</SelectItem>
                                    <SelectItem value="priority" className="text-[10px] font-bold uppercase py-3 cursor-pointer">Priority Hierarchy</SelectItem>
                                    <SelectItem value="difficulty" className="text-[10px] font-bold uppercase py-3 cursor-pointer">Difficulty Grading</SelectItem>
                                  </SelectContent>
                                </Select>

                                {(roadmapStatusFilter !== 'all' || roadmapPriorityFilter !== 'all') && (
                                  <Button 
                                    variant="ghost" 
                                    onClick={() => {
                                      setRoadmapStatusFilter('all');
                                      setRoadmapPriorityFilter('all');
                                    }}
                                    className="h-9 sm:h-10 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-ctu-maroon hover:bg-ctu-maroon/5 col-span-2 sm:col-span-1"
                                  >
                                    Reset
                                  </Button>
                                )}
                              </div>
                            </div>

                            <AnimatePresence mode="popLayout">
                              {filteredRoadmap.map((step, fIdx) => (
                                <motion.div 
                                  key={`roadmap-step-${step.originalIndex}`} 
                                  layout
                                  initial={{ opacity: 0, y: 30 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ 
                                    duration: 0.5, 
                                    delay: fIdx * 0.05,
                                    type: "spring",
                                    stiffness: 100
                                  }}
                                  className="relative group mb-8"
                                >
                                  <Card 
                                    className={cn(
                                      "relative p-4 sm:p-8 rounded-3xl sm:rounded-[2.5rem] border backdrop-blur-sm overflow-hidden transition-all duration-500",
                                      step.status === 'done' ? "bg-emerald-500/[0.02] border-emerald-500/10 grayscale-[0.5] opacity-80" : "neumorphic-raised border-foreground/5 hover:shadow-2xl hover:shadow-ctu-gold/5"
                                    )}
                                  >
                                    <span className="absolute -right-6 -bottom-6 text-[60px] sm:text-[140px] font-black opacity-[0.05] select-none text-foreground rotate-12 group-hover:rotate-6 transition-transform duration-700">{step.originalIndex + 1}</span>
                                    
                                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-8 relative z-10">
                                      <div className={cn(
                                        "w-10 h-10 sm:w-16 sm:h-16 rounded-xl sm:rounded-[2rem] flex items-center justify-center font-black text-lg sm:text-2xl shrink-0 shadow-2xl transition-all duration-500 group-hover:scale-110",
                                        step.status === 'done' ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-gradient-to-br from-ctu-gold to-ctu-maroon text-white shadow-ctu-gold/30"
                                      )}>
                                        {step.status === 'done' ? '✓' : step.originalIndex + 1}
                                      </div>
                                      <div className="min-w-0 flex-1 text-center sm:text-left">
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 mb-2 sm:mb-4">
                                          <div className="space-y-1 sm:space-y-2">
                                            <h5 className={cn(
                                              "font-black text-base sm:text-xl uppercase tracking-tight transition-colors",
                                              step.status === 'done' ? "text-foreground/40 line-through decoration-ctu-gold/30" : "text-foreground group-hover:text-ctu-gold"
                                            )}>
                                              {step.title}
                                            </h5>
                                            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-3">
                                              <Badge variant="outline" className={cn(
                                                "font-black text-[7px] sm:text-[9px] border-none px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-widest",
                                                step.difficulty === 'hard' ? 'bg-ctu-maroon/10 text-ctu-maroon' : step.difficulty === 'medium' ? 'bg-ctu-gold/10 text-ctu-gold' : 'bg-green-500/10 text-green-500'
                                              )}>
                                                {step.difficulty}
                                              </Badge>
                                              
                                              <Badge variant="outline" className={cn(
                                                "font-black text-[7px] sm:text-[9px] border-none px-2 py-0.5 sm:py-1 rounded-full uppercase tracking-widest",
                                                step.priority === 'high' ? 'bg-ctu-maroon text-white animate-pulse' : step.priority === 'medium' ? 'bg-ctu-gold/20 text-ctu-gold' : 'bg-foreground/5 text-foreground/40'
                                              )}>
                                                {step.priority}
                                              </Badge>

                                              <div className="h-4 w-px bg-foreground/5 hidden sm:block" />

                                              {step.estimatedTime && (
                                                <span className="text-[7px] sm:text-[10px] font-black text-foreground/20 flex items-center gap-1 sm:gap-1.5 uppercase tracking-widest">
                                                  <Clock size={10} className="text-ctu-gold/50" /> {step.estimatedTime}
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex flex-col xs:flex-row items-center gap-3 w-full xl:w-auto shrink-0 mt-4 xl:mt-0">
                                            <div className="w-full xs:w-auto space-y-1">
                                              <span className="text-[8px] font-black uppercase tracking-widest text-foreground/20 px-1">Sync Status</span>
                                              <Select 
                                                value={step.status} 
                                                onValueChange={(val) => updateRoadmapStep(step.originalIndex, { status: val })}
                                              >
                                                <SelectTrigger className="w-full xs:w-[130px] h-12 rounded-xl bg-background/50 border-none text-[9px] sm:text-[10px] font-black uppercase tracking-widest neumorphic-raised active:neumorphic-pressed transition-all">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border border-foreground/5 shadow-2xl bg-background">
                                                  <SelectItem value="todo" className="text-[10px] font-bold uppercase py-3">Pending</SelectItem>
                                                  <SelectItem value="in_progress" className="text-[10px] font-bold uppercase py-3">In Sync</SelectItem>
                                                  <SelectItem value="done" className="text-[10px] font-bold uppercase py-3">Complete</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>

                                            <div className="w-full xs:w-auto space-y-1">
                                              <span className="text-[8px] font-black uppercase tracking-widest text-foreground/20 px-1">Priority</span>
                                              <Select 
                                                value={step.priority} 
                                                onValueChange={(val) => updateRoadmapStep(step.originalIndex, { priority: val })}
                                              >
                                                <SelectTrigger className="w-full xs:w-[130px] h-12 rounded-xl bg-background/50 border-none text-[9px] sm:text-[10px] font-black uppercase tracking-widest neumorphic-raised active:neumorphic-pressed transition-all">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl border border-foreground/5 shadow-2xl bg-background">
                                                  <SelectItem value="high" className="text-[10px] font-bold uppercase py-3">Critical</SelectItem>
                                                  <SelectItem value="medium" className="text-[10px] font-bold uppercase py-3">Medium</SelectItem>
                                                  <SelectItem value="low" className="text-[10px] font-bold uppercase py-3">Minor</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="bg-foreground/[0.01] p-4 sm:p-0 rounded-2xl sm:bg-transparent mt-6 sm:mt-0">
                                          <p className="text-[11px] sm:text-[15px] text-foreground/60 leading-relaxed font-bold italic tracking-tight max-w-2xl mx-auto sm:mx-0">{step.description}</p>
                                        </div>
                                        
                                        {step.breakdown && step.breakdown.length > 0 && (
                                          <div className="mb-6 sm:mb-12 space-y-4 sm:space-y-6 bg-foreground/[0.02] p-5 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] border border-foreground/10 shadow-inner">
                                            <h6 className="text-[8px] sm:text-[11px] font-black uppercase tracking-[0.3em] text-ctu-maroon flex items-center gap-3 mb-2 sm:mb-6">
                                              <Layers size={14} className="sm:size-5" /> Operational Requirements
                                            </h6>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                                              {step.breakdown.map((item: string, i: number) => (
                                                <div key={i} className="flex items-start gap-4 group/item text-left">
                                                  <div className="w-1.5 h-1.5 rounded-full bg-ctu-gold mt-1.5 shrink-0 group-hover/item:scale-150 transition-transform" />
                                                  <span className="text-[11px] sm:text-sm font-bold text-foreground/70 leading-relaxed tracking-tight">{item}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        <div className="flex flex-wrap justify-center sm:justify-start gap-2 sm:gap-3">
                                          {step.subjects?.map((sCode: string) => {
                                            const subjectInfo = getSubjectInfo(sCode);
                                            return (
                                              <Badge 
                                                key={sCode} 
                                                onClick={() => navigate(`/catalog/${subjectInfo?.id || sCode.toLowerCase()}`)}
                                                className="bg-background/50 hover:bg-ctu-maroon hover:text-white transition-all cursor-pointer border border-foreground/10 text-[9px] sm:text-[11px] font-black px-4 sm:px-6 py-2 sm:py-3 rounded-2xl backdrop-blur-md uppercase tracking-widest flex items-center gap-2 group/badge shadow-sm"
                                                title={subjectInfo?.name}
                                              >
                                                <BookOpen size={12} className="group-hover/badge:rotate-12 transition-transform" />
                                                <span className="text-foreground/80 group-hover:text-white">{subjectInfo ? subjectInfo.code : sCode}</span>
                                                {subjectInfo && <span className="opacity-40 font-bold ml-2 border-l border-foreground/20 pl-2 hidden xs:inline">{subjectInfo.name}</span>}
                                              </Badge>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </Card>
                                </motion.div>
                              ))}
                            </AnimatePresence>

                            {filteredRoadmap.length === 0 && (
                              <div className="text-center py-20 bg-foreground/5 rounded-[2.5rem] border border-dashed border-foreground/10">
                                <Filter size={48} className="mx-auto text-foreground/10 mb-4" />
                                <h4 className="text-xl font-black text-foreground/40 uppercase tracking-tighter">No tasks match these filters</h4>
                                <Button 
                                  variant="link" 
                                  onClick={() => { setRoadmapStatusFilter('all'); setRoadmapPriorityFilter('all'); }}
                                  className="text-ctu-gold text-xs font-black uppercase tracking-widest mt-2"
                                >
                                  Clear all filters
                                </Button>
                              </div>
                            )}
                          </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 sm:py-24 text-center space-y-6">
                           <div className="relative">
                             <div className="absolute inset-0 bg-ctu-gold/20 blur-3xl animate-pulse rounded-full" />
                             <BrainCircuit size={64} className="text-ctu-gold relative z-10" />
                           </div>
                           <div className="max-w-xs">
                             <h4 className="text-lg font-bold mb-2">Matrix Analysis Pending</h4>
                             <p className="text-xs text-foreground/40 font-medium leading-relaxed">
                               Initialization required. Click <span className="text-ctu-gold font-bold">Generate Plan</span> to synthesize subject data and academic flow.
                             </p>
                           </div>
                        </div>
                      )}
                    </div>
                  </GlowCard>

                  <div className="flex flex-col gap-6 sm:gap-8">
                    {/* Current Focus */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-foreground/40 flex items-center gap-3">
                        <TrendingUp size={16} className="text-ctu-gold" /> Strategic Focus
                      </h4>
                      {roadmap.length > 0 ? (
                        <Card 
                          className="relative p-6 sm:p-8 rounded-[2rem] border backdrop-blur-md overflow-hidden flex flex-col justify-center cursor-pointer group hover:scale-[1.02] transition-all duration-300 neumorphic-raised border-foreground/5 min-h-[120px]"
                          style={{ background: 'linear-gradient(135deg, rgba(var(--color-ctu-gold)/0.05), rgba(var(--color-ctu-maroon)/0.02))' }}
                          onClick={() => setActiveTab('advisor')}
                        >
                          <div className="relative z-10 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-ctu-gold/10 flex items-center justify-center text-ctu-gold shrink-0">
                              <Target size={24} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-lg font-black text-foreground leading-none uppercase tracking-tight line-clamp-1 mb-1">
                                {roadmap[0].subjects?.[0] || 'Path Ready'}
                              </h5>
                              <p className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest line-clamp-1">Active Objective</p>
                            </div>
                          </div>
                        </Card>
                      ) : (
                        <div className="neumorphic-pressed rounded-[2rem] p-6 text-center border border-dashed border-foreground/10 min-h-[100px] flex items-center justify-center">
                          <p className="text-[9px] text-foreground/30 font-black uppercase tracking-[0.2em]">Ready for Sync</p>
                        </div>
                      )}
                    </div>

                    <Card className="neumorphic-card border-none p-5 bg-ctu-maroon/[0.03] border border-ctu-maroon/5 rounded-[2rem] shadow-sm">
                      <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-ctu-maroon mb-3 flex items-center gap-2">
                        <BrainCircuit size={14} /> AI Insight
                      </h3>
                      <p className="text-xs text-foreground/60 leading-relaxed font-bold italic">
                        Focus on <b className="text-ctu-maroon">IE 311: Production Systems</b> next semester to advance your specialization path.
                      </p>
                    </Card>
                  </div>
                </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="map" className="mt-0 focus:outline-none">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10 sm:mb-16">
                  <div className="flex-1">
                    <h2 className="text-3xl sm:text-5xl md:text-8xl frosted-header font-black tracking-tighter leading-[0.85] py-2 flex items-center flex-wrap gap-4 sm:gap-8">
                       Matrix <Layers size={28} className="text-ctu-gold sm:size-24 shrink-0" />
                    </h2>
                    <p className="text-xs sm:text-sm md:text-xl text-foreground/40 font-bold mt-4 tracking-[0.2em] uppercase">Interactive curriculum flow analysis.</p>
                  </div>
                  
                  <div className="w-full lg:w-96 space-y-4">
                    <div className="relative group">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-ctu-gold transition-colors" size={18} />
                      <Input 
                        placeholder="SEARCH THE MATRIX..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-12 h-14 rounded-2xl bg-foreground/[0.03] border-none neumorphic-pressed text-[10px] font-black uppercase tracking-widest focus-visible:ring-1 focus-visible:ring-ctu-gold/30"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      className="h-14 rounded-2xl border-none neumorphic-raised text-[10px] font-black uppercase tracking-widest text-ctu-gold w-full shadow-lg hover:bg-ctu-gold hover:text-white transition-all active:neumorphic-pressed"
                      onClick={() => navigate('/catalog')}
                    >
                      <Maximize size={18} className="mr-2" /> Extended Catalog
                    </Button>
                  </div>
                </div>

                <GlowCard className="w-full h-auto p-4 sm:p-14 flex flex-col gap-12 sm:gap-20 relative overflow-hidden" glowColor="blue" customSize>
                  <div className="relative z-20 text-center sm:text-left px-4">
                    <h2 className="text-3xl sm:text-5xl md:text-7xl font-display font-black mb-4 tracking-tighter uppercase leading-[0.9]">Curriculum Flow</h2>
                    <p className="text-xs sm:text-lg text-foreground/40 max-w-lg font-medium mx-auto sm:mx-0 leading-relaxed italic">
                      Visualizing your academic trajectory. Filter and explore subject dependencies across four years of IE training.
                    </p>
                  </div>

                  <div className="w-full flex flex-col items-center gap-12 sm:gap-24 relative z-10 px-1 sm:px-4">
                    {/* Visualizing Year Progress */}
                    {['1st', '2nd', '3rd', '4th'].map((year, yIdx) => (
                      <div key={year} className="w-full flex flex-col items-center gap-8 sm:gap-16">
                        <div className="w-full text-center">
                          <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.5em] text-foreground/20 mb-3">{year} Year Matrix Status</h4>
                          <div className="h-0.5 w-16 bg-ctu-gold/30 mx-auto rounded-full" />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-8 w-full max-w-7xl">
                          {IE_SUBJECTS.filter(s => 
                            s.yearLevel === year && 
                            (searchQuery === '' || 
                             s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             s.code.toLowerCase().includes(searchQuery.toLowerCase()))
                          ).map((subject) => {
                            const isDone = progressMap[subject.id]?.status === 'done';
                            const isPrep = progressMap[subject.id]?.status === 'in_progress';
                            
                            return (
                              <div 
                                key={subject.id}
                                className={cn(
                                  "w-full p-6 sm:p-8 rounded-[2rem] transition-all border flex flex-col justify-between min-h-[180px] cursor-pointer group relative overflow-hidden",
                                  isDone ? "bg-emerald-500/[0.03] border-emerald-500/20 shadow-lg" : 
                                  isPrep ? "bg-ctu-gold/[0.03] border-ctu-gold/20 shadow-lg" : "bg-background neumorphic-raised border-foreground/5 shadow-sm hover:shadow-xl"
                                )}
                                onClick={() => navigate(`/catalog/${subject.id}`)}
                              >
                                <div className="absolute -right-4 -top-4 w-16 h-16 bg-foreground/[0.02] rounded-full group-hover:scale-150 transition-transform" />
                                
                                <div className="relative z-10">
                                  <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-2">
                                      <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                        isDone ? "bg-emerald-500/10 text-emerald-500" : isPrep ? "bg-ctu-gold/10 text-ctu-gold" : "bg-foreground/5 text-foreground/20"
                                      )}>
                                        <SubjectIcon iconName={subject.icon} className="w-4 h-4" />
                                      </div>
                                      <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-foreground/[0.03]",
                                        isDone ? "text-emerald-500" : isPrep ? "text-ctu-gold" : "text-foreground/20"
                                      )}>
                                        {subject.code}
                                      </span>
                                    </div>
                                    {isDone && <Award size={18} className="text-emerald-500" />}
                                  </div>
                                  <h5 className={cn(
                                    "text-sm sm:text-base md:text-lg font-black leading-tight uppercase tracking-tight line-clamp-3 transition-colors",
                                    isDone ? "text-emerald-500/80" : isPrep ? "text-ctu-gold" : "text-foreground group-hover:text-ctu-gold"
                                  )}>
                                    {subject.name}
                                  </h5>
                                </div>
                                <div className="mt-8 relative z-10">
                                  <div className="flex justify-between items-end mb-2">
                                    <span className="text-[8px] font-black uppercase text-foreground/20 tracking-widest">Mastery</span>
                                    <span className="text-[10px] font-black text-foreground/40">{isDone ? '100%' : isPrep ? '40%' : '0%'}</span>
                                  </div>
                                  <Progress value={isDone ? 100 : isPrep ? 40 : 0} className={cn(
                                    "h-2 rounded-full",
                                    isDone ? "bg-emerald-500/10 [&>div]:bg-emerald-500" : isPrep ? "bg-ctu-gold/10 [&>div]:bg-ctu-gold" : "bg-foreground/5 [&>div]:bg-foreground/10"
                                  )} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {yIdx < 3 && (
                          <div className="flex flex-col items-center py-6">
                            <motion.div
                              initial={{ scaleY: 0 }}
                              whileInView={{ scaleY: 1 }}
                              transition={{ duration: 1.2, ease: "easeInOut" }}
                              className="w-1 h-16 sm:h-24 bg-gradient-to-b from-ctu-gold via-ctu-maroon to-transparent origin-top rounded-full relative"
                            >
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-ctu-maroon blur-sm animate-ping" />
                            </motion.div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </GlowCard>
            </motion.div>
          </TabsContent>

          <TabsContent value="groups" className="mt-0 space-y-8 sm:space-y-16 outline-none">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sm:gap-10">
                  <div>
                    <h2 className="text-2xl sm:text-4xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 sm:py-2 flex items-center flex-wrap gap-3 sm:gap-6">
                       Active Squads <Users size={24} className="text-ctu-gold sm:size-20 shrink-0" />
                    </h2>
                    <p className="text-sm sm:text-base md:text-xl text-foreground/40 font-medium mt-1 sm:mt-2 tracking-tight">Peer-to-peer intelligence networks and collaborative study groups.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <div className="relative w-full md:w-80">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/20" size={16} />
                      <Input 
                        placeholder="Scan Squads..." 
                        className="pl-14 neumorphic-pressed border-none h-14 sm:h-16 rounded-2xl sm:rounded-3xl text-[10px] sm:text-sm font-black uppercase tracking-widest placeholder:text-foreground/20 transition-all focus:shadow-xl focus:shadow-ctu-gold/5"
                        value={groupSearchQuery}
                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                      />
                    </div>
                    <Dialog open={isNewGroupModalOpen} onOpenChange={setIsNewGroupModalOpen}>
                      <DialogTrigger 
                        render={
                          <Button className="h-14 sm:h-16 px-8 sm:px-12 rounded-2xl sm:rounded-3xl bg-ctu-maroon text-white font-black uppercase tracking-widest text-[10px] sm:text-[11px] gap-3 shadow-xl w-full md:w-auto hover:scale-[1.02] active:scale-100 transition-all">
                            <Plus size={18} /> Assemble Squad
                          </Button>
                        }
                      />
                      <DialogContent className="sm:max-w-[425px] neumorphic-card border-none p-8">
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-black italic tracking-tight">FORM NEW SQUAD</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-6 py-4">
                          <div className="space-y-2">
                            <Label htmlFor="group-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Squad Name</Label>
                            <Input id="group-name" value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})} className="neumorphic-pressed border-none h-12 rounded-xl" placeholder="e.g., OR-1 Mastermind" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="subject-code" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Target Subject</Label>
                            <Select onValueChange={(val: string) => setNewGroup({...newGroup, subjectCode: val})}>
                              <SelectTrigger className="neumorphic-pressed border-none h-12 rounded-xl">
                                <SelectValue placeholder="Select a subject" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-none shadow-2xl">
                                {IE_SUBJECTS.map(s => <SelectItem key={s.id} value={s.code}>{s.code} - {s.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="group-desc" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Mission Briefing</Label>
                            <Textarea id="group-desc" value={newGroup.description} onChange={e => setNewGroup({...newGroup, description: e.target.value})} className="neumorphic-pressed border-none min-h-[100px] rounded-xl" placeholder="What's this group about?" />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleCreateGroup} className="bg-ctu-gold text-white font-black uppercase tracking-widest w-full h-14 rounded-2xl shadow-lg shadow-ctu-gold/20">Establish Group</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-12">
                  {filteredStudyGroups.length > 0 ? filteredStudyGroups.map((group, idx) => (
                    <motion.div
                      key={group.id}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ y: -8 }}
                      transition={{ 
                        delay: idx * 0.05,
                        type: "spring",
                        stiffness: 150,
                        damping: 15
                      }}
                      className="h-full"
                    >
                      <Card className="p-6 sm:p-10 h-full flex flex-col justify-between group neumorphic-raised border-foreground/5 hover:border-ctu-maroon/20 transition-all duration-500 rounded-[2.5rem] sm:rounded-[3.5rem] relative overflow-hidden" 
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 bg-ctu-maroon/[0.03] blur-3xl rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-1000" />
                        
                        <div className="relative z-10 flex flex-col h-full">
                          <div className="flex items-center justify-between mb-6 sm:mb-10">
                            <div className="flex items-center gap-4">
                               <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-ctu-maroon to-ctu-gold/60 flex items-center justify-center text-white shadow-xl shadow-ctu-maroon/20 group-hover:rotate-12 transition-transform">
                                 <SubjectIcon iconName={getSubjectInfo(group.subjectCode)?.icon || 'Users'} className="w-6 h-6 sm:w-8 sm:h-8" />
                               </div>
                               <Badge className="bg-foreground/[0.03] text-foreground/40 border-none text-[9px] sm:text-[11px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full shadow-sm">
                                 {group.subjectCode}
                               </Badge>
                            </div>
                            <div className="flex -space-x-3 sm:-space-x-4">
                              {(group.members || []).slice(0, 3).map((mId: string, i: number) => (
                                <div key={i} className="w-8 h-8 sm:w-11 sm:h-11 rounded-full border-2 sm:border-4 border-background bg-foreground/10 flex items-center justify-center text-[10px] sm:text-xs font-black ring-1 ring-foreground/5 shadow-md uppercase">
                                  {mId.slice(0, 2)}
                                </div>
                              ))}
                              {(group.members || []).length > 3 && (
                                <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-full border-2 sm:border-4 border-background bg-gradient-to-br from-ctu-gold to-ctu-maroon flex items-center justify-center text-[10px] sm:text-xs font-black text-white shadow-lg ring-1 ring-ctu-gold/20">
                                  +{(group.members || []).length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <h3 className="text-2xl sm:text-4xl font-black text-foreground mb-3 leading-[0.9] group-hover:text-ctu-maroon transition-colors uppercase tracking-tighter truncate">{group.name}</h3>
                          <p className="text-xs sm:text-lg font-bold text-foreground/40 leading-relaxed line-clamp-2 mb-8 sm:mb-12 italic tracking-tight">{group.description || "Mission brief encrypted. Join to decrypt."}</p>
                          
                          <div className="mt-auto pt-6 sm:pt-10 border-t border-foreground/5 flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                              <span className="text-[8px] sm:text-[10px] font-black text-foreground/20 uppercase tracking-[0.3em]">Operational Strength</span>
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] sm:text-sm font-black text-foreground/60 tracking-widest uppercase">{(group.members || []).length} / 50 Agents</span>
                              </div>
                            </div>
                            <div className="flex gap-3">
                              {group.members?.includes(user?.uid) ? (
                                <Button 
                                  onClick={() => setActiveChatGroup(group)}
                                  className="bg-emerald-500 text-white rounded-2xl sm:rounded-3xl h-12 sm:h-16 px-6 sm:px-10 font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:scale-[1.05] active:scale-95 transition-all gap-2"
                                >
                                  Nexus <ChevronRight size={16} />
                                </Button>
                              ) : (
                                <Button 
                                  onClick={() => handleJoinGroup(group.id)}
                                  className="bg-ctu-maroon text-white rounded-2xl sm:rounded-3xl h-12 sm:h-16 px-6 sm:px-10 font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] shadow-xl shadow-ctu-maroon/20 hover:scale-[1.05] active:scale-95 transition-all gap-2"
                                >
                                  Deploy <Plus size={16} />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )) : (
                    Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="h-64 rounded-[2rem] border-2 border-dashed border-foreground/5 flex flex-col items-center justify-center text-center p-8">
                         <Users className="text-foreground/10 mb-4" size={48} />
                         <span className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.3em]">Sector Empty</span>
                         <p className="text-xs font-medium text-foreground/30 mt-2">Initialize your own study squad to connect with peers.</p>
                      </div>
                    ))
                  )}
                </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="qa" className="mt-0 space-y-8 sm:space-y-16 outline-none">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sm:gap-10">
                  <div>
                    <h2 className="text-2xl sm:text-4xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 sm:py-2 flex items-center flex-wrap gap-3 sm:gap-6">
                       Forum Hub <MessageSquare size={24} className="text-ctu-gold shrink-0 sm:size-20" />
                    </h2>
                    <p className="text-sm sm:text-base md:text-xl text-foreground/40 font-medium mt-1 sm:mt-2 tracking-tight">Collective intelligence pool for query resolution.</p>
                  </div>
                  <Dialog open={isAskQuestionModalOpen} onOpenChange={setIsAskQuestionModalOpen}>
                    <DialogTrigger
                      render={
                        <Button 
                          className="h-14 sm:h-16 px-8 sm:px-12 rounded-2xl sm:rounded-3xl bg-ctu-maroon text-white font-black uppercase tracking-widest text-[9px] sm:text-[11px] gap-3 shadow-xl w-full md:w-auto hover:scale-[1.02] active:scale-100 transition-all"
                        >
                          <Plus size={18} /> Signal Question
                        </Button>
                      }
                    />
                    <DialogContent className="max-w-[95vw] w-full h-[85dvh] md:h-auto overflow-y-auto overscroll-contain bg-background rounded-[2rem] sm:rounded-[3rem] border-none shadow-3xl p-8 sm:p-12">
                      <DialogHeader>
                        <DialogTitle className="text-3xl sm:text-4xl font-black uppercase tracking-tighter leading-none mb-2">Initialize Question</DialogTitle>
                        <p className="text-xs sm:text-sm font-bold text-foreground/40 italic tracking-tight">Signal your query to the collective intelligence network.</p>
                      </DialogHeader>
                      <div className="grid gap-6 sm:gap-10 py-8">
                        <div className="space-y-3">
                          <Label htmlFor="q-title" className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-foreground/20 ml-2">Question Headline</Label>
                          <Input id="q-title" value={newQuestion.title} onChange={e => setNewQuestion({...newQuestion, title: e.target.value})} className="neumorphic-pressed border-none h-14 sm:h-16 rounded-2xl sm:rounded-3xl text-sm font-bold uppercase tracking-tight placeholder:text-foreground/10" placeholder="e.g. Ergonomic Analysis Bottleneck..." />
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="q-subject" className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-foreground/20 ml-2">Topic Sector</Label>
                          <Select onValueChange={(val: string) => setNewQuestion({...newQuestion, subjectTag: val})}>
                            <SelectTrigger className="neumorphic-pressed border-none h-14 sm:h-16 rounded-2xl sm:rounded-3xl text-sm font-bold uppercase tracking-tight">
                              <SelectValue placeholder="Select topic sector" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border border-foreground/5 shadow-22 bg-background/95 backdrop-blur-xl">
                              {IE_SUBJECTS.map(s => <SelectItem key={s.id} value={s.code} className="text-xs uppercase font-black py-4">{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="q-content" className="text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] text-foreground/20 ml-2">Intelligence Brief (Details)</Label>
                          <Textarea id="q-content" value={newQuestion.content} onChange={e => setNewQuestion({...newQuestion, content: e.target.value})} className="neumorphic-pressed border-none min-h-[120px] rounded-2xl sm:rounded-3xl text-sm font-bold p-6 tracking-tight leading-relaxed placeholder:text-foreground/10" placeholder="Explain the context of your inquiry..." />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAskQuestion} className="bg-ctu-maroon text-white font-black uppercase tracking-[0.2em] w-full h-14 sm:h-18 rounded-2xl sm:rounded-[2.5rem] shadow-2xl shadow-ctu-maroon/30 text-xs sm:text-sm hover:scale-[1.02] active:scale-95 transition-all">Transmit Inquiry</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/20" size={16} />
                    <Input 
                      placeholder="Search matrix data..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-background border-none neumorphic-pressed pl-14 pr-12 h-14 sm:h-16 rounded-2xl sm:rounded-3xl focus:ring-ctu-gold text-[10px] sm:text-sm text-foreground font-black uppercase tracking-widest placeholder:text-foreground/20"
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
                </div>

                <div className="space-y-6 sm:space-y-10">
                  {filteredQuestions.length > 0 ? filteredQuestions.map((q, idx) => (
                    <motion.div
                      key={q.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      whileHover={{ x: 5 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <Card 
                        onClick={() => setSelectedQuestion(q)}
                        className="p-6 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] neumorphic-raised border-foreground/5 overflow-hidden relative transition-all duration-500 hover:shadow-2xl hover:border-ctu-gold/20 cursor-pointer group"
                      >
                        <div className="flex flex-col sm:flex-row gap-6 sm:gap-12 relative z-10">
                          <div className="flex sm:flex-col items-center justify-between sm:justify-start gap-4 sm:gap-6 bg-foreground/[0.03] p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2.5rem] border border-foreground/5 min-w-[80px] sm:min-w-[120px]">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVote(q.id, q.votes || 0);
                              }}
                              className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-background hover:bg-ctu-gold hover:text-white flex items-center justify-center transition-all neumorphic-raised border-none"
                            >
                              <ChevronUp size={24} className="sm:size-8" />
                            </button>
                            <div className="flex flex-col items-center">
                              <span className={cn("text-xl sm:text-4xl font-black italic transition-colors", (q.votes || 0) > 0 ? "text-ctu-gold" : "text-ctu-maroon")}>
                                {(q.votes || 0)}
                              </span>
                              <span className="text-[6px] sm:text-[9px] font-black text-foreground/20 uppercase tracking-widest leading-[0.5]">Intel</span>
                            </div>
                            <Button 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReportQuestion(q);
                              }}
                              className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-background hover:bg-red-500/10 hover:text-red-500 flex items-center justify-center transition-all neumorphic-raised border-none p-0"
                            >
                              <Flag size={14} className="sm:size-6" />
                            </Button>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-4 sm:mb-8">
                              <Badge className="bg-ctu-gold text-white border-none px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-ctu-gold/20">
                                {q.subjectTag || 'General'}
                              </Badge>
                              <span className="text-[10px] font-black text-foreground/40 uppercase tracking-widest flex items-center gap-2">
                                <Clock size={14} className="text-ctu-gold/40" /> {q.createdAt ? (q.createdAt.toDate ? new Date(q.createdAt.toDate()).toLocaleDateString() : 'Just now') : 'Just now'}
                              </span>
                            </div>
                            
                            <h4 className="text-xl sm:text-3xl font-black text-foreground group-hover:text-ctu-gold transition-colors uppercase tracking-tighter leading-[0.9] mb-4 sm:mb-6 truncate">
                              {q.title}
                            </h4>
                            <p className="text-xs sm:text-lg text-foreground/50 font-bold italic line-clamp-2 sm:line-clamp-3 leading-relaxed mb-8 sm:mb-12 tracking-tight">
                              {q.content}
                            </p>
                            
                            <div className="flex flex-wrap items-center justify-between gap-6 pt-6 sm:pt-10 border-t border-foreground/5">
                              <div className="flex items-center gap-4 sm:gap-6 text-foreground/40 text-[10px] sm:text-xs font-black uppercase tracking-widest">
                                <span className="flex items-center gap-2.5 bg-foreground/[0.03] px-5 py-2.5 rounded-full border border-foreground/5">
                                  <MessageSquare size={16} className="text-ctu-maroon" /> {q.answerCount || 0} Responses
                                </span>
                                <span className="flex items-center gap-2.5 bg-foreground/[0.03] px-5 py-2.5 rounded-full border border-foreground/5">
                                  <Users size={16} className="text-blue-500" /> {anonymizeName(q.userName)?.split(' ')[0] || 'Member'}
                                </span>
                              </div>
                              <Button className="rounded-2xl bg-foreground/5 hover:bg-foreground/10 text-foreground h-11 sm:h-14 px-8 sm:px-12 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] neumorphic-raised border-none transition-all flex items-center gap-3">
                                Review Query <ArrowRight size={16} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                      <HelpCircle size={48} className="mb-4" />
                      <p className="font-bold">No questions found matching your search.</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </TabsContent>

          <TabsContent value="flashcards" className="mt-0 space-y-6 md:space-y-12 outline-none">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
                {!selectedDeck ? (
                  <>
                    <div className="space-y-6 md:space-y-12">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8">
                        <div>
                          <h2 className="text-2xl sm:text-4xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 sm:py-2 flex items-center flex-wrap gap-3 sm:gap-6">
                             Flash Decks <BookOpen size={24} className="text-ctu-gold sm:size-20 shrink-0" />
                          </h2>
                          <p className="text-sm sm:text-base md:text-xl text-foreground/40 font-medium mt-2 sm:mt-3 tracking-tight">Accelerate mastery through strategic retention cycles.</p>
                        </div>
                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                          <Dialog open={isNewDeckModalOpen} onOpenChange={setIsNewDeckModalOpen}>
                            <DialogTrigger 
                              render={
                                <Button className="h-12 sm:h-14 px-6 sm:px-8 rounded-2xl bg-ctu-maroon text-white font-black uppercase tracking-widest text-[9px] sm:text-[11px] flex items-center gap-2 sm:gap-3 shadow-xl">
                                  <Plus size={16} /> New Deck
                                </Button>
                              }
                            />
                            <DialogContent className="max-w-[95vw] w-full h-[85dvh] overflow-y-auto overscroll-contain neumorphic-card border-none p-6 sm:p-8">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-black italic tracking-tight">INITIALIZE DECK</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-6 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="deck-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Deck Codename</Label>
                                <Input id="deck-name" value={newDeck.name} onChange={e => setNewDeck({...newDeck, name: e.target.value})} className="neumorphic-pressed border-none h-12 rounded-xl" placeholder="e.g., Ergonomics Mastery" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Target Subject</Label>
                                <Select value={newDeck.subjectId} onValueChange={(val) => setNewDeck({...newDeck, subjectId: val})}>
                                  <SelectTrigger className="neumorphic-pressed border-none h-12 rounded-xl">
                                    <SelectValue placeholder="Select Subject" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-none shadow-2xl">
                                    {IE_SUBJECTS.map(s => (
                                      <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="deck-desc" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Intelligence Summary</Label>
                                <Textarea id="deck-desc" value={newDeck.description} onChange={e => setNewDeck({...newDeck, description: e.target.value})} className="neumorphic-pressed border-none min-h-[80px] rounded-xl" placeholder="What will you study in this deck?" />
                              </div>
                              <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Visual ID (Theme)</Label>
                                <div className="flex gap-4">
                                  {['maroon', 'gold', 'blue', 'green'].map(c => (
                                    <button
                                      key={c}
                                      onClick={() => setNewDeck({...newDeck, color: c})}
                                      className={cn(
                                        "w-10 h-10 rounded-full border-4 transition-all shadow-lg",
                                        newDeck.color === c ? "border-foreground scale-110 shadow-foreground/10" : "border-transparent opacity-40 hover:opacity-100",
                                        c === 'maroon' ? 'bg-ctu-maroon' : c === 'gold' ? 'bg-ctu-gold' : c === 'blue' ? 'bg-blue-500' : 'bg-green-500'
                                      )}
                                    />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button onClick={handleCreateDeck} className="bg-ctu-maroon text-white font-black uppercase tracking-widest w-full h-14 rounded-2xl shadow-xl shadow-ctu-maroon/20">Forge Deck</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-6 mb-8 sm:mb-16">
                      <div className="relative flex-1">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/20" size={16} />
                        <Input 
                          placeholder="Search database..." 
                          className="pl-14 neumorphic-pressed border-none h-14 sm:h-16 rounded-2xl sm:rounded-3xl text-[10px] sm:text-sm font-black uppercase tracking-[0.1em] placeholder:text-foreground/20"
                          value={deckSearchQuery}
                          onChange={(e) => setDeckSearchQuery(e.target.value)}
                        />
                      </div>
                      <Select value={deckSubjectFilter} onValueChange={setDeckSubjectFilter}>
                        <SelectTrigger className="w-full sm:w-[220px] neumorphic-pressed border-none h-14 sm:h-16 rounded-2xl sm:rounded-3xl text-[9px] sm:text-[11px] font-black uppercase tracking-widest px-6">
                          <SelectValue placeholder="All Subjects" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border border-foreground/5 shadow-22 bg-background/95 backdrop-blur-xl">
                          <SelectItem value="all" className="font-black text-[10px] uppercase py-3">ALL SECTORS</SelectItem>
                          {IE_SUBJECTS.map(s => (
                            <SelectItem key={s.code} value={s.code} className="font-black text-[10px] uppercase py-3">{s.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 sm:gap-12">
                      <AnimatePresence mode="popLayout">
                        {filteredDecks.length > 0 ? filteredDecks.map((deck, i) => (
                          <motion.div
                            key={deck.id}
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            whileHover={{ y: -10 }}
                            transition={{ 
                              delay: i * 0.05,
                              type: "spring",
                              stiffness: 200,
                              damping: 20
                            }}
                          >
                             <Card 
                              className="p-8 sm:p-12 text-center cursor-pointer hover:shadow-2xl transition-all duration-500 h-full neumorphic-raised border-foreground/5 rounded-[2.5rem] sm:rounded-[3.5rem] relative overflow-hidden group" 
                              onClick={() => setSelectedDeck(deck)}
                            >
                               <div className={cn(
                                 "absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full -mr-16 -mt-16 opacity-10 group-hover:scale-150 transition-transform duration-1000",
                                 deck.color === 'maroon' ? 'bg-ctu-maroon' : 
                                 deck.color === 'gold' ? 'bg-ctu-gold' :
                                 deck.color === 'blue' ? 'bg-blue-500' : 'bg-green-500'
                               )} />

                              <div className={cn(
                                "w-16 h-16 sm:w-24 sm:h-24 rounded-[1.5rem] sm:rounded-[2.5rem] neumorphic-pressed flex items-center justify-center mx-auto mb-6 sm:mb-10 transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 shadow-inner",
                                deck.color === 'maroon' ? 'text-ctu-maroon' : 
                                deck.color === 'gold' ? 'text-ctu-gold' :
                                deck.color === 'blue' ? 'text-blue-500' : 'text-green-500'
                              )}>
                                <Layers size={32} className="sm:size-[48px] drop-shadow-sm" />
                              </div>
                              <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground mb-2 line-clamp-1 truncate uppercase tracking-tighter group-hover:text-ctu-maroon transition-colors">{deck.name}</h3>
                              {deck.subjectId && (
                                <Badge variant="secondary" className="mb-4 sm:mb-6 text-[9px] sm:text-[11px] h-6 font-black bg-foreground/[0.03] text-foreground/40 px-4 tracking-[0.25em] rounded-full uppercase border-none shadow-sm">{deck.subjectId}</Badge>
                              )}
                              <p className="text-[9px] sm:text-[11px] text-foreground/40 font-black uppercase tracking-[0.4em] bg-foreground/[0.02] py-2 sm:py-3 rounded-2xl mb-8 sm:mb-12 border border-foreground/5">{deck.cardCount || 0} Retention Units</p>
                              
                              <div className="flex gap-4">
                                <Button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startFlashcardSession(deck);
                                  }}
                                  className={cn(
                                    "flex-1 rounded-[1.25rem] sm:rounded-[2rem] h-12 sm:h-16 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] shadow-xl transition-all hover:scale-[1.05] active:scale-95",
                                    deck.color === 'maroon' ? 'bg-ctu-maroon text-white shadow-ctu-maroon/20' : 
                                    deck.color === 'gold' ? 'bg-ctu-gold text-white shadow-ctu-gold/20' :
                                    deck.color === 'blue' ? 'bg-blue-500 text-white shadow-blue-500/20' : 'bg-green-500 text-white shadow-green-500/20'
                                  )}
                                >
                                  Deploy Study
                                </Button>
                              </div>
                            </Card>
                          </motion.div>
                        )) : (
                          <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            className="col-span-full py-20 text-center opacity-30"
                          >
                            <Layers size={48} className="mx-auto mb-4" />
                            <p className="font-bold">No decks found. {deckSearchQuery || deckSubjectFilter !== 'all' ? "Try adjusting your filters." : "Start by creating one!"}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </>
                ) : (
                  <div className="space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-4">
                          <div className="flex items-center gap-6">
                            <Button 
                              variant="ghost" 
                              onClick={() => {
                                setSelectedDeck(null);
                                setCardSearchQuery('');
                              }}
                              className="w-14 h-14 rounded-[1.5rem] p-0 hover:bg-foreground/5 neumorphic-raised border-none text-ctu-maroon"
                            >
                               <ChevronLeft size={28} />
                            </Button>
                            <div>
                               <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase text-foreground leading-none">{selectedDeck.name}</h2>
                               <p className="text-base sm:text-lg text-foreground/40 font-medium mt-2 tracking-tight line-clamp-2 max-w-2xl">{selectedDeck.description || 'Core Industrial Engineering concepts for deep retention.'}</p>
                            </div>
                          </div>
                       
                          <div className="flex flex-wrap gap-4 items-center">
                            <div className="relative w-full md:w-64">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" size={16} />
                              <Input 
                                placeholder="Filter units..." 
                                className="pl-10 neumorphic-pressed border-none h-12 rounded-2xl text-sm"
                                value={cardSearchQuery}
                                onChange={(e) => setCardSearchQuery(e.target.value)}
                              />
                            </div>

                            <div className="flex gap-6 neumorphic-card border-none px-6 py-2 items-center rounded-2xl">
                              <div className="text-center border-r border-foreground/5 pr-6">
                                <p className="text-[9px] font-black text-foreground/20 uppercase tracking-widest leading-tight">Units</p>
                                <p className="font-black text-lg leading-tight">{deckCards.length}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] font-black text-ctu-gold uppercase tracking-widest leading-tight">Due</p>
                                <p className="font-black text-lg leading-tight">
                                  {deckCards.filter(c => !c.nextReview || new Date(c.nextReview) <= new Date()).length}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-2 w-full sm:w-auto">
                              <Dialog open={isAddCardModalOpen} onOpenChange={setIsAddCardModalOpen}>
                                <DialogTrigger 
                                  render={
                                    <Button variant="outline" className="flex-1 sm:flex-none rounded-2xl font-black uppercase text-[10px] tracking-widest neumorphic-raised border-none h-12 px-6 whitespace-nowrap">
                                      <Plus size={16} /> NEW UNIT
                                    </Button>
                                  } 
                                />
                                <DialogContent className="max-w-[95vw] w-full h-[85dvh] overflow-y-auto overscroll-contain bg-background rounded-[1.5rem] sm:rounded-[2.5rem] border-none shadow-3xl p-6 sm:p-8">
                                  <DialogHeader>
                                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter">Initialize Card</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-6 py-6">
                                    <div className="space-y-3">
                                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30 ml-2">Front Side</Label>
                                      <div className="neumorphic-pressed p-2 rounded-2xl">
                                        <Textarea value={newCard.front} onChange={e => setNewCard({...newCard, front: e.target.value})} className="bg-transparent border-none focus-visible:ring-0 resize-none h-24 text-sm font-medium" placeholder="Operational term..." />
                                      </div>
                                    </div>
                                    <div className="space-y-3">
                                      <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30 ml-2">Back Side</Label>
                                      <div className="neumorphic-pressed p-2 rounded-2xl">
                                        <Textarea value={newCard.back} onChange={e => setNewCard({...newCard, back: e.target.value})} className="bg-transparent border-none focus-visible:ring-0 resize-none h-24 text-sm font-medium" placeholder="Synthetic response..." />
                                      </div>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button onClick={handleAddCard} className="bg-ctu-maroon text-white font-black w-full rounded-2xl h-14 shadow-xl shadow-ctu-maroon/20">DEPLOY</Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                              <Button 
                                onClick={() => startFlashcardSession(selectedDeck)}
                                className="flex-1 sm:flex-none rounded-2xl bg-ctu-gold text-white font-black uppercase text-[10px] tracking-widest h-12 px-8 whitespace-nowrap shadow-xl shadow-ctu-gold/20 hover:scale-[1.02] transition-all"
                              >
                                STUDY NOW
                              </Button>
                            </div>
                          </div>
                        </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <AnimatePresence mode="popLayout">
                        {filteredCards.length > 0 ? filteredCards.map((card, idx) => (
                          <motion.div
                            key={card.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ delay: idx * 0.05 }}
                          >
                            <Card className="neumorphic-card border-none p-8 relative group overflow-hidden h-full rounded-[2.5rem] flex flex-col justify-between hover:shadow-2xl transition-all duration-500">
                              <div className="space-y-6">
                                <div className="flex justify-between items-start">
                                  <Badge className={cn(
                                    "text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 border-none",
                                    card.status === 'known' ? "bg-green-500/10 text-green-500" : "bg-ctu-gold/10 text-ctu-gold"
                                  )}>
                                    {card.status?.toUpperCase() || 'LEARNING'}
                                  </Badge>
                                  {card.nextReview && (
                                    <span className="text-[10px] font-black text-foreground/20 uppercase tracking-widest flex items-center gap-2">
                                      <Calendar size={10} /> {new Date(card.nextReview).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-2">
                                   <p className="text-[9px] font-black text-foreground/10 uppercase tracking-[0.4em]">Inquiry</p>
                                   <p className="text-xl font-black text-foreground/80 tracking-tight leading-[1.2]">{card.front}</p>
                                </div>
                              </div>
                              
                              <div className="mt-10 pt-6 border-t border-foreground/5 flex justify-between items-center">
                                <p className="text-[10px] font-black text-foreground/40 italic line-clamp-1 flex-1 pr-4">{card.back}</p>
                                {card.status !== 'known' && (
                                  <Button 
                                    onClick={() => handleMarkCardKnown(card.id)}
                                    size="sm"
                                    variant="ghost" 
                                    className="h-8 rounded-lg text-[9px] font-black uppercase tracking-widest text-green-500 hover:bg-green-500/10 transition-colors whitespace-nowrap"
                                  >
                                    Mark Learned
                                  </Button>
                                )}
                              </div>
                            </Card>
                          </motion.div>
                        )) : (
                          <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            className="col-span-full py-20 text-center opacity-30 border-2 border-dashed border-foreground/10 rounded-3xl"
                          >
                            <Plus size={32} className="mx-auto mb-4" />
                            <p className="font-bold text-sm">No cards found in this deck.</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
            </motion.div>
          </TabsContent>
              
              <TabsContent value="quizzes" className="mt-0 focus:outline-none space-y-6 md:space-y-12 outline-none">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 mb-2 sm:mb-0">
                  <div>
                    <h2 className="text-2xl sm:text-4xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 sm:py-2 flex items-center flex-wrap gap-3 sm:gap-6">
                       AI Quizzes <Award size={24} className="text-ctu-gold sm:size-20 shrink-0" />
                    </h2>
                    <p className="text-[10px] sm:text-base md:text-xl text-foreground/40 font-medium mt-1 sm:mt-2 tracking-tight">Challenge yourself with dynamically generated assessments.</p>
                  </div>
                  <Button 
                    onClick={() => startQuizSession('Industrial Engineering')}
                    disabled={isGenerating}
                    className="h-10 sm:h-14 px-6 sm:px-8 rounded-xl sm:rounded-2xl bg-ctu-gold text-white font-black uppercase tracking-widest text-[9px] sm:text-[11px] gap-2 sm:gap-3 shadow-xl w-full md:w-auto mt-2 sm:mt-0"
                  >
                    <Zap size={16} /> {isGenerating ? "Synthesizing..." : "New Quick Quiz"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12">
                  {/* Gen Quiz Card */}
                  <Card className="p-8 sm:p-14 flex flex-col justify-between neumorphic-raised border-foreground/5 rounded-[2.5rem] sm:rounded-[4rem] group relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-ctu-gold/5 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-1000" />
                    
                    <div className="relative z-10">
                      <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-ctu-gold to-orange-500 shadow-xl shadow-ctu-gold/20 flex items-center justify-center text-white mb-8 group-hover:rotate-6 transition-transform">
                        <Zap size={28} className="sm:size-10" />
                      </div>
                      <h3 className="text-2xl sm:text-4xl md:text-5xl font-black mb-4 tracking-tighter uppercase leading-[0.9]">Start Quiz Session</h3>
                      <p className="text-xs sm:text-lg text-foreground/50 leading-relaxed mb-10 font-bold italic tracking-tight">
                        Generate a unique Industrial Engineering quiz powered by AI to test your knowledge in real-time.
                      </p>
                    </div>
                    <div className="space-y-6 relative z-10">
                      <div className="space-y-3">
                        <Label className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.3em] text-foreground/20 ml-2">Domain Sector</Label>
                        <Select onValueChange={(val: string) => startQuizSession(val)}>
                          <SelectTrigger className="h-14 sm:h-16 rounded-2xl sm:rounded-3xl bg-foreground/[0.03] border-none text-foreground font-black px-6 sm:px-8 text-[10px] sm:text-xs uppercase tracking-widest neumorphic-pressed">
                            <SelectValue placeholder="Choose a subject sector..." />
                          </SelectTrigger>
                          <SelectContent className="rounded-2xl border border-foreground/5 shadow-22 bg-background/95 backdrop-blur-xl">
                            {IE_SUBJECTS.slice(0, 10).map(s => (
                              <SelectItem key={s.id} value={s.name} className="font-bold text-[10px] uppercase py-3">{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={() => startQuizSession("General IE")}
                        disabled={isSessionLoading}
                        className="w-full h-14 sm:h-18 bg-ctu-gold text-white font-black uppercase tracking-[0.2em] rounded-2xl sm:rounded-[2rem] shadow-xl shadow-ctu-gold/30 hover:scale-[1.02] active:scale-95 transition-all text-xs sm:text-sm"
                      >
                        {isSessionLoading ? "Analyzing Syllabi..." : "Initiate AI Quiz"}
                      </Button>
                    </div>
                  </Card>

                  {/* Achievements Card */}
                  <Card className="p-8 sm:p-14 flex flex-col neumorphic-raised border-foreground/5 rounded-[2.5rem] sm:rounded-[4rem] group relative overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/5 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-1000" />
                    
                    <h3 className="text-xl sm:text-3xl font-black mb-10 flex items-center gap-4 relative z-10 uppercase tracking-tighter">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Award size={24} className="sm:size-8" />
                      </div>
                      Achievements
                    </h3>
                    
                    <div className="grid grid-cols-4 gap-4 sm:gap-8 relative z-10">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="group/item relative flex flex-col items-center">
                          <motion.div 
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            className="relative w-12 h-12 sm:w-18 sm:h-18 rounded-full p-1"
                          >
                            <div className={cn(
                              "absolute inset-0 rounded-full transition-all duration-700",
                              i <= 3 ? "bg-gradient-to-br from-ctu-gold via-white to-ctu-maroon shadow-lg" : "bg-foreground/5 opacity-50"
                            )} />
                            <div className="absolute inset-1 rounded-full bg-background neumorphic-pressed flex items-center justify-center">
                              <Award size={20} className={cn("transition-all duration-700 sm:size-8", i <= 3 ? "text-ctu-gold drop-shadow-[0_0_8px_rgba(var(--color-ctu-gold)/0.5)]" : "text-foreground/5 grayscale")} />
                            </div>
                            {i <= 3 && (
                              <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-ctu-gold border-2 border-background flex items-center justify-center shadow-lg ring-1 ring-ctu-gold/20"
                              >
                                <Sparkles size={8} className="text-white animate-pulse" />
                              </motion.div>
                            )}
                          </motion.div>
                          <span className="text-[7px] sm:text-[9px] font-black text-foreground/20 uppercase tracking-[0.2em] mt-3 sm:mt-5 text-center group-hover/item:text-ctu-gold transition-colors">{i <= 3 ? `Tier ${i}` : 'LOCKED'}</span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="mt-auto pt-8 sm:pt-14 border-t border-foreground/5 relative z-10">
                      <div className="flex justify-between items-center mb-6 sm:mb-10">
                        <span className="text-[9px] sm:text-[11px] font-black text-foreground/30 uppercase tracking-[0.3em]">Recent Performance</span>
                        <div className="flex items-center gap-2">
                          <TrendingUp size={14} className="text-emerald-500" />
                          <span className="text-[9px] sm:text-[11px] text-emerald-500 font-black uppercase tracking-widest">Efficiency ++</span>
                        </div>
                      </div>
                      <div className="space-y-6 sm:space-y-8">
                        {[
                          { label: 'Work Measurement', score: 92 },
                          { label: 'Industrial Safety', score: 78 }
                        ].map((s, i) => (
                          <div key={i} className="space-y-3">
                            <div className="flex justify-between text-[10px] sm:text-xs font-black uppercase tracking-widest">
                              <span className="text-foreground/40">{s.label}</span>
                              <span className={cn(s.score >= 80 ? "text-emerald-500" : "text-ctu-gold")}>{s.score}%</span>
                            </div>
                            <Progress value={s.score} className="h-2 sm:h-3 rounded-full bg-foreground/[0.03] shadow-inner" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Past Quiz Results Section */}
                <div className="space-y-8">
                  <div className="flex items-center gap-4">
                    <div className="w-1.5 h-10 bg-ctu-gold rounded-full" />
                    <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">Past Quiz Performance</h3>
                  </div>

                  {quizResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {quizResults.map((result) => (
                        <Card key={result.id} className="p-6 neumorphic-raised border-foreground/5 rounded-[2rem] relative overflow-hidden group">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-foreground/[0.02] rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-700" />
                          <div className="flex justify-between items-start mb-4 relative z-10">
                            <Badge className={cn(
                              "font-black text-[10px] uppercase tracking-widest px-3 py-1 rounded-full",
                              (result.score / result.total) >= 0.8 ? "bg-emerald-500 text-white" : 
                              (result.score / result.total) >= 0.6 ? "bg-ctu-gold text-white" : "bg-ctu-maroon text-white"
                            )}>
                              {Math.round((result.score / result.total) * 100)}%
                            </Badge>
                            <span className="text-[10px] font-black text-foreground/20 uppercase tracking-widest flex items-center gap-2">
                              <Calendar size={12} /> 
                              {result.createdAt?.toDate ? result.createdAt.toDate().toLocaleDateString() : 'Just now'}
                            </span>
                          </div>
                          
                          <h4 className="text-xl font-black text-foreground mb-1 uppercase tracking-tight line-clamp-1">{result.subjectName}</h4>
                          <p className="text-xs font-bold text-foreground/40 italic mb-4">AI-Generated Assessment</p>
                          
                          <div className="flex items-end justify-between">
                            <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-black text-foreground">{result.score}</span>
                              <span className="text-sm font-bold text-foreground/20 italic">/ {result.total}</span>
                            </div>
                            <div className="flex gap-1">
                              {Array.from({ length: result.total }).map((_, i) => (
                                <div key={i} className={cn(
                                  "w-2 h-2 rounded-full",
                                  i < result.score ? "bg-ctu-gold" : "bg-foreground/10"
                                )} />
                              ))}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-16 bg-foreground/[0.02] rounded-[3rem] border border-dashed border-foreground/10">
                      <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center mx-auto mb-4 text-foreground/20">
                        <Award size={32} />
                      </div>
                      <h4 className="text-lg font-black text-foreground/30 uppercase tracking-widest">No Intelligence Data Recorded</h4>
                      <p className="text-sm font-medium text-foreground/20 mt-2">Complete a quiz session to initiate performance tracking.</p>
                    </div>
                  )}
                </div>
              </motion.div>
              </TabsContent>

            <TabsContent value="notebooks" className="mt-0 space-y-8 sm:space-y-16 outline-none">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sm:gap-10">
                  <div>
                    <h2 className="text-2xl sm:text-4xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 sm:py-2 flex items-center flex-wrap gap-3 sm:gap-6">
                       AI Notebooks <BookOpen size={24} className="text-ctu-gold shrink-0 sm:size-20" />
                    </h2>
                    <p className="text-sm sm:text-base md:text-xl text-foreground/40 font-medium mt-1 sm:mt-2 tracking-tight">Structured knowledge repositories and smart study logs.</p>
                  </div>
                </div>
                {activeNotebookId ? (
                  <NotebookWorkspace 
                    notebookId={activeNotebookId} 
                    onBack={() => setActiveNotebookId(null)} 
                  />
                ) : (
                  <NotebookList onSelect={(id) => setActiveNotebookId(id)} />
                )}
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Group Chat Modal */}
        <Dialog open={!!activeChatGroup} onOpenChange={(open) => !open && setActiveChatGroup(null)}>
          <DialogContent className="max-w-md w-[95vw] h-[85dvh] bg-background rounded-3xl border-none p-0 overflow-hidden flex flex-col overscroll-contain">
            <DialogHeader className="p-4 sm:p-6 border-b border-foreground/5 bg-background/50 backdrop-blur-md shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl neumorphic-pressed flex items-center justify-center text-ctu-gold shrink-0">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">{activeChatGroup?.name}</DialogTitle>
                  <p className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">{activeChatGroup?.subjectCode} Study Room</p>
                </div>
              </div>
            </DialogHeader>
            <ScrollArea className="flex-1 p-6">
              <div className="space-y-4">
                {chatMessages.length > 0 ? chatMessages.map((msg, i) => (
                  <div key={msg.id || i} className={cn(
                    "flex flex-col max-w-[85%]",
                    msg.userId === user.uid ? "ml-auto items-end" : "items-start"
                  )}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-[9px] font-bold uppercase text-foreground/40">{anonymizeName(msg.userName)}</span>
                      <span className="text-[8px] font-medium text-foreground/20 italic">
                        {msg.createdAt ? (msg.createdAt.toDate ? new Date(msg.createdAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...') : '...'}
                      </span>
                    </div>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm font-medium",
                      msg.userId === user.uid 
                        ? "bg-ctu-gold text-white rounded-tr-none shadow-lg" 
                        : "neumorphic-pressed text-foreground rounded-tl-none"
                    )}>
                      {msg.text}
                    </div>
                  </div>
                )) : (
                  <div className="h-full flex flex-col items-center justify-center py-20 opacity-20 text-center">
                    <HelpCircle size={32} className="mb-2" />
                    <p className="text-xs font-bold uppercase tracking-widest">No messages yet.<br/>Start the session!</p>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="p-6 bg-background/50 backdrop-blur-md border-t border-foreground/5">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <Input 
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="bg-background border-none neumorphic-pressed rounded-xl h-12"
                />
                <Button 
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="w-12 h-12 rounded-xl bg-ctu-gold text-white shrink-0 shadow-lg p-0"
                >
                  <ArrowRight size={20} />
                </Button>
              </form>
            </div>
          </DialogContent>
        </Dialog>

        {/* Question Detail Modal */}
        <Dialog open={!!selectedQuestion} onOpenChange={(open) => !open && setSelectedQuestion(null)}>
          <DialogContent className="max-w-2xl w-[95vw] h-[85dvh] bg-background rounded-3xl border-none p-0 overflow-hidden flex flex-col overscroll-contain">
            <DialogHeader className="p-4 sm:p-8 border-b border-foreground/5 bg-background shadow-sm shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Badge className="bg-blue-500/10 text-blue-500 border-none text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg">{selectedQuestion?.subjectTag || 'General'}</Badge>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-foreground/40 uppercase tracking-[0.2em]">Intel by</span>
                    <span className="text-sm font-black text-foreground/80 tracking-tight">{anonymizeName(selectedQuestion?.userName) || 'Anonymous'}</span>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  {selectedQuestion?.isFlagged && (
                    <Badge className="bg-red-500/10 text-red-500 border-none text-[10px] font-black flex items-center gap-2 uppercase tracking-widest px-3 py-1.5 shadow-sm">
                      <ShieldAlert size={14} /> Critical Flag
                    </Badge>
                  )}
                  {user?.role === 'admin' && (
                    <div className="flex gap-2 neumorphic-pressed px-3 py-1.5 rounded-2xl">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleFlagQuestion(selectedQuestion)}
                        className={cn(
                          "h-8 w-8 p-0 rounded-xl transition-all",
                          selectedQuestion?.isFlagged ? "bg-red-500 text-white" : "text-red-500 hover:bg-red-500/10"
                        )}
                      >
                         <Flag size={14} />
                      </Button>
                      <div className="w-[1px] h-4 bg-foreground/5 self-center mx-1" />
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteQuestion(selectedQuestion.id)}
                        className="h-8 w-8 p-0 rounded-xl text-foreground/20 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              <DialogTitle className="text-3xl font-black tracking-tighter leading-tight text-foreground uppercase">{selectedQuestion?.title}</DialogTitle>
            </DialogHeader>
            <div className="py-8 p-8 space-y-10 overflow-y-auto max-h-[60vh] custom-scrollbar">
              <div className="p-8 rounded-[2.5rem] neumorphic-pressed relative group border border-foreground/5">
                <p className="text-foreground/70 leading-relaxed font-medium text-base sm:text-lg">{selectedQuestion?.content}</p>
                {selectedQuestion?.reportCount > 0 && user?.role === 'admin' && (
                  <div className="absolute -top-3 -right-3 flex items-center gap-2 bg-red-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-500/30">
                    <AlertTriangle size={12} /> {selectedQuestion.reportCount} Signal Intercepts
                  </div>
                )}
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.3em]">Knowledge Feed ({selectedQuestion?.answerCount || 0})</h4>
                  <div className="h-[1px] flex-1 bg-foreground/5 mx-6" />
                </div>
                
                {selectedQuestion?.latestAnswer ? (
                  <div className={cn(
                    "p-8 rounded-[2.5rem] transition-all relative group border",
                    selectedQuestion.latestAnswer.isFlagged ? "bg-red-500/5 border-red-500/20" : "neumorphic-raised border-foreground/5"
                  )}>
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-ctu-gold/10 flex items-center justify-center text-ctu-gold">
                           <Award size={20} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-ctu-gold uppercase tracking-[0.2em]">{anonymizeName(selectedQuestion.latestAnswer.userName)}</span>
                          <span className="text-[9px] font-bold text-foreground/20 uppercase">Core Contributor</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {user?.role === 'admin' ? (
                          <div className="flex gap-2 neumorphic-pressed px-2 py-1 rounded-xl">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleFlagAnswer(selectedQuestion)}
                              className="h-6 w-6 p-0 rounded-lg text-foreground/20 hover:text-red-500 transition-colors"
                            >
                              <Flag size={12} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteAnswer(selectedQuestion)}
                              className="h-6 w-6 p-0 rounded-lg text-foreground/20 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-10 w-10 p-0 rounded-full bg-foreground/5 text-foreground/20 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                            onClick={() => toast.success("Signal Reported.")}
                          >
                            <Flag size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className={cn(
                      "text-base font-medium leading-relaxed",
                      selectedQuestion.latestAnswer.isFlagged ? "text-foreground/40 italic" : "text-foreground/80"
                    )}>
                      {selectedQuestion.latestAnswer.content}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-foreground/5 rounded-[2rem]">
                    <p className="text-[10px] font-black text-foreground/20 uppercase tracking-[0.3em]">No knowledge transmitted yet</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/30 ml-2">Your Contribution</Label>
                <div className="neumorphic-pressed p-2 rounded-3xl">
                  <Textarea 
                    placeholder="Share your synthesis..."
                    value={newAnswer}
                    onChange={(e) => setNewAnswer(e.target.value)}
                    className="bg-transparent border-none focus-visible:ring-0 resize-none h-32 px-6 py-4 text-sm font-medium"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="p-8 pt-0">
              <Button 
                onClick={() => handlePostAnswer(selectedQuestion.id)}
                disabled={isAnswering}
                className="bg-ctu-maroon text-white font-black uppercase tracking-[0.2em] w-full h-16 rounded-2xl shadow-2xl shadow-ctu-maroon/30 hover:scale-[1.01] active:scale-95 transition-all text-xs"
              >
                {isAnswering ? "TRANSMITTING..." : "POST SYNTHESIS"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Advisor Chat Sidebar/Modal */}
        <Dialog open={isAdvisorChatOpen} onOpenChange={setIsAdvisorChatOpen}>
          <DialogContent className="max-w-md w-full sm:w-[500px] h-full sm:h-[85dvh] flex flex-col bg-background sm:rounded-3xl border-none p-0 overflow-hidden overscroll-contain">
            <DialogHeader className="p-5 sm:p-6 border-b border-foreground/5 bg-background z-20 shrink-0 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl neumorphic-raised flex items-center justify-center text-ctu-gold bg-background/50">
                    <BrainCircuit size={24} />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-black tracking-tight">Academic Advisor</DialogTitle>
                    <p className="text-[9px] font-black text-ctu-gold uppercase tracking-[0.2em]">Augmented Intelligence</p>
                  </div>
                </div>
              </div>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-6 custom-scrollbar bg-foreground/[0.01]">
              <div className="flex flex-col gap-8 pb-10">
                {advisorChat.length === 0 && (
                  <div className="text-center py-12 space-y-6">
                    <div className="w-16 h-16 rounded-full bg-ctu-gold/5 flex items-center justify-center mx-auto text-ctu-gold animate-bounce">
                      <Sparkles size={32} />
                    </div>
                    <div>
                      <p className="text-xs text-foreground font-black uppercase tracking-widest mb-1">Matrix Advisor AI</p>
                      <p className="text-[10px] text-foreground/40 font-medium">Ask me about your roadmap, elective choices,<br/>or specialization tracks!</p>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2">
                      {["Tell me about IE tracks", "What are my electives?", "Check my roadmap"].map(q => (
                        <button
                          key={q}
                          onClick={() => setAdvisorInput(q)}
                          className="text-[9px] font-bold uppercase tracking-widest px-3 py-2 rounded-full border border-foreground/5 hover:bg-foreground/5 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {advisorChat.map((msg, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={cn(
                      "flex flex-col",
                      msg.role === 'user' ? "items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[85%] p-5 rounded-[2rem] text-sm font-medium shadow-sm transition-all",
                      msg.role === 'user' 
                        ? "bg-ctu-maroon text-white rounded-tr-none shadow-xl shadow-ctu-maroon/20" 
                        : "neumorphic-card bg-background border border-foreground/5 text-foreground rounded-tl-none shadow-sm hover:shadow-md"
                    )}>
                      <div className={cn(
                        "prose prose-sm max-w-none",
                        msg.role === 'user' ? "prose-invert" : "prose-slate"
                      )}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isAdvisorLoading && (
                  <div className="flex justify-start">
                    <div className="neumorphic-card bg-background border border-foreground/5 text-foreground rounded-3xl rounded-tl-none p-4 w-16">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-ctu-gold rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-ctu-gold rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-ctu-gold rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleAdvisorChat} className="p-4 sm:p-6 border-t border-foreground/5 shrink-0 bg-background pb-safe">
              <div className="relative">
                <Input 
                  placeholder="Type your question..."
                  value={advisorInput}
                  onChange={(e) => setAdvisorInput(e.target.value)}
                  className="bg-background border-none neumorphic-pressed h-12 rounded-xl pr-12 text-sm"
                />
                <Button 
                  type="submit"
                  disabled={isAdvisorLoading}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 h-auto rounded-lg bg-ctu-gold hover:bg-ctu-gold/80"
                >
                  <ArrowRight size={16} className="text-white" />
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </main>

      <BottomNav />
    </div>
  );
}
