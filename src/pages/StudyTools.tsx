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
  Flag,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  MoreVertical,
  FolderOpen,
  Maximize,
  Zap
} from 'lucide-react';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User, StudyGroup, StudyPost, Quiz, Subject, Progress as ProgressType } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { generateStudyPlan, generateQuiz, askQuestion } from '@/src/lib/gemini';
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
import { cn } from '@/lib/utils';
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

    return () => {
      unsubscribeQA();
      unsubscribeGroups();
      unsubscribeDecks();
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
    setIsGenerating(true);
    
    try {
      const plan = await generateStudyPlan(progressMap, IE_SUBJECTS);
      setRoadmap(plan);
      localStorage.setItem('ctu_hub_roadmap', JSON.stringify(plan));
      toast.success("Personalized roadmap generated!");
    } catch (error) {
      toast.error("Failed to generate advisor advice.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAdvisorChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advisorInput.trim() || isAdvisorLoading) return;

    const userMsg = { role: 'user' as const, content: advisorInput };
    const chatHistory = advisorChat.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    setAdvisorChat(prev => [...prev, userMsg]);
    setAdvisorInput('');
    setIsAdvisorLoading(true);

    try {
      const fullContext = `
        Curriculum: ${JSON.stringify(IE_SUBJECTS.map(s => ({ code: s.code, name: s.name })))}
        Progress: ${JSON.stringify(progressMap)}
        Roadmap: ${JSON.stringify(roadmap)}
        Previous Chat: ${chatHistory}
      `;
      const response = await askQuestion(advisorInput, fullContext);
      setAdvisorChat(prev => [...prev, { role: 'ai' as const, content: response }]);
    } catch (error) {
      toast.error("AI Advisor is currently unavailable.");
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
    setIsSessionLoading(true);
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

                  <GlowCard className="p-4 sm:p-8" glowColor="blue">
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
                    onClick={() => setActiveSession(null)}
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
      
      <main className="flex-1 p-3 sm:p-6 lg:p-10 pb-40 lg:pb-10 pb-safe overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 md:gap-6 mb-6 lg:mb-12">
            <div>
              <h1 className="text-2xl sm:text-5xl md:text-7xl lg:text-8xl frosted-header font-black tracking-tighter leading-[0.9] py-1 flex items-center flex-wrap gap-2 sm:gap-4 uppercase">
                Study HUB <Sparkles className="text-ctu-gold shrink-0 scale-90 sm:scale-125" size={24} />
              </h1>
              <p className="text-[9px] sm:text-sm md:text-xl text-foreground/40 mt-1 sm:mt-3 font-medium tracking-tight uppercase">
                Elevate your learning with AI guidance and community support.
              </p>
            </div>
        </div>

        <Tabs defaultValue="advisor" value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-10">
          <div className="sticky top-0 z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 bg-background/95 backdrop-blur-2xl overflow-x-auto no-scrollbar border-b border-foreground/5 shadow-sm">
            <TabsList className="bg-transparent h-auto p-0 gap-2 inline-flex min-w-max pb-1">
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
                    "relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap tap-target border border-transparent shadow-sm",
                    activeTab === tab.id 
                      ? "bg-gradient-to-br from-ctu-maroon to-ctu-gold text-white shadow-xl shadow-ctu-gold/30 scale-[1.05]" 
                      : "bg-foreground/5 text-foreground/40 hover:bg-foreground/10 hover:text-foreground/70 neumorphic-raised"
                  )}
                >
                  <tab.icon size={14} />
                  <span>{tab.label}</span>
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="tab-underline"
                      className="absolute -bottom-1 left-4 right-4 h-0.5 rounded-full bg-white/50" 
                    />
                  )}
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
                  <GlowCard className="lg:col-span-2 p-4 sm:p-8 overflow-visible" glowColor="orange">
                        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4 mb-4 sm:mb-10">
                          <div className="text-center sm:text-left">
                            <h2 className="text-xl sm:text-4xl font-display font-black flex items-center flex-wrap gap-2 sm:gap-3 tracking-tight justify-center sm:justify-start">
                               Roadmap <TrendingUp className="text-ctu-gold animate-bounce" size={20} />
                            </h2>
                            <p className="text-[10px] sm:text-base text-foreground/40 mt-1 font-medium">AI-generated sequence based on your IE data.</p>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <Button 
                              onClick={() => setIsAdvisorChatOpen(true)}
                              className="flex-1 neumorphic-raised text-ctu-gold font-black uppercase tracking-wider border-none h-11 sm:h-12 rounded-xl text-[9px] sm:text-[10px] hover:scale-[1.02] active:scale-95 transition-all"
                            >
                               Adviser
                            </Button>
                            <Button 
                              onClick={handleGenerateRoadmap} 
                              disabled={isGenerating}
                              className="flex-1 bg-ctu-gold text-white font-black uppercase tracking-wider rounded-xl px-4 h-11 sm:h-12 text-[9px] sm:text-[10px] shadow-xl shadow-ctu-gold/20 hover:scale-[1.05] active:scale-95 transition-all"
                            >
                              {isGenerating ? "Compiling..." : "Generate"}
                            </Button>
                          </div>
                        </div>

                    <div className="space-y-0 relative">
                      {roadmap.length > 0 ? (
                          <div className="mt-4 sm:mt-8 space-y-4 sm:space-y-8">
                            <div className="flex flex-col gap-3 mb-4 sm:mb-8 p-3 sm:p-4 rounded-2xl bg-foreground/5 neumorphic-pressed">
                              <div className="flex items-center gap-2">
                                <Filter size={12} className="text-ctu-gold" />
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/40">Filters</span>
                              </div>
                              <div className="grid grid-cols-2 lg:flex lg:flex-wrap gap-2">
                                <Select value={roadmapStatusFilter} onValueChange={setRoadmapStatusFilter}>
                                  <SelectTrigger className="h-10 rounded-xl bg-background neumorphic-raised border-none text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-2xl border-none shadow-2xl bg-background/95 backdrop-blur-xl">
                                    <SelectItem value="all" className="text-[10px] font-bold uppercase py-3">All Status</SelectItem>
                                    <SelectItem value="todo" className="text-[10px] font-bold uppercase py-3">To Do</SelectItem>
                                    <SelectItem value="in_progress" className="text-[10px] font-bold uppercase py-3">In Progress</SelectItem>
                                    <SelectItem value="done" className="text-[10px] font-bold uppercase py-3">Done</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Select value={roadmapPriorityFilter} onValueChange={setRoadmapPriorityFilter}>
                                  <SelectTrigger className="h-10 rounded-xl bg-background neumorphic-raised border-none text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                                    <SelectValue placeholder="Priority" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-2xl border-none shadow-2xl bg-background/95 backdrop-blur-xl">
                                    <SelectItem value="all" className="text-[10px] font-bold uppercase py-3">All Priority</SelectItem>
                                    <SelectItem value="high" className="text-[10px] font-bold uppercase py-3">High</SelectItem>
                                    <SelectItem value="medium" className="text-[10px] font-bold uppercase py-3">Medium</SelectItem>
                                    <SelectItem value="low" className="text-[10px] font-bold uppercase py-3">Low</SelectItem>
                                  </SelectContent>
                                </Select>

                                <Select value={roadmapSortBy} onValueChange={setRoadmapSortBy}>
                                  <SelectTrigger className="h-10 rounded-xl bg-background neumorphic-raised border-none text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                                    <SelectValue placeholder="Sort" />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-2xl border-none shadow-2xl bg-background/95 backdrop-blur-xl">
                                    <SelectItem value="order" className="text-[10px] font-bold uppercase py-3">Original Order</SelectItem>
                                    <SelectItem value="priority" className="text-[10px] font-bold uppercase py-3">By Priority</SelectItem>
                                    <SelectItem value="difficulty" className="text-[10px] font-bold uppercase py-3">By Difficulty</SelectItem>
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

                                          <div className="grid grid-cols-2 sm:flex items-center sm:items-end justify-center sm:justify-end gap-2 shrink-0">
                                            <Select 
                                              value={step.status} 
                                              onValueChange={(val) => updateRoadmapStep(step.originalIndex, { status: val })}
                                            >
                                              <SelectTrigger className="w-full sm:w-[110px] h-10 sm:h-9 rounded-xl bg-foreground/5 border-none text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="rounded-xl border-none shadow-xl">
                                                <SelectItem value="todo">To Do</SelectItem>
                                                <SelectItem value="in_progress">In Progress</SelectItem>
                                                <SelectItem value="done">Done</SelectItem>
                                              </SelectContent>
                                            </Select>

                                            <Select 
                                              value={step.priority} 
                                              onValueChange={(val) => updateRoadmapStep(step.originalIndex, { priority: val })}
                                            >
                                              <SelectTrigger className="w-full sm:w-[110px] h-10 sm:h-9 rounded-xl bg-foreground/5 border-none text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent className="rounded-xl border-none shadow-xl">
                                                <SelectItem value="high">High Priority</SelectItem>
                                                <SelectItem value="medium">Mid Priority</SelectItem>
                                                <SelectItem value="low">Low Priority</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        <p className="text-[11px] sm:text-base text-foreground/60 leading-relaxed mb-4 sm:mb-6 font-medium max-w-2xl">{step.description}</p>
                                        
                                        {step.breakdown && step.breakdown.length > 0 && (
                                          <div className="mb-4 sm:mb-8 space-y-2 sm:space-y-3 bg-foreground/5 p-3 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-white/5">
                                            <h6 className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-ctu-gold flex items-center gap-2 mb-2 sm:mb-4">
                                              <Layers size={12} className="sm:size-4" /> Requirements
                                            </h6>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
                                              {step.breakdown.map((item: string, i: number) => (
                                                <div key={i} className="flex items-start gap-2 group/item text-left">
                                                  <div className="w-1 h-1 rounded-full bg-ctu-gold mt-1.5 shrink-0 group-hover/item:scale-150 transition-transform" />
                                                  <span className="text-[9px] sm:text-xs font-medium text-foreground/70 leading-relaxed">{item}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                                          {step.subjects?.map((sCode: string) => {
                                            const subjectInfo = getSubjectInfo(sCode);
                                            return (
                                              <Badge 
                                                key={sCode} 
                                                onClick={() => navigate(`/catalog/${subjectInfo?.id || sCode.toLowerCase()}`)}
                                                className="bg-foreground/[0.03] text-foreground/50 hover:bg-ctu-gold hover:text-white transition-all cursor-pointer border border-foreground/5 text-[8px] sm:text-[9px] font-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl backdrop-blur-md uppercase tracking-wider flex items-center gap-1.5 sm:gap-2"
                                                title={subjectInfo?.name}
                                              >
                                                <BookOpen size={10} />
                                                <span>{subjectInfo ? subjectInfo.code : sCode}</span>
                                                {subjectInfo && <span className="opacity-40 font-bold ml-1 sm:ml-1.5 border-l border-foreground/10 pl-1 sm:pl-1.5 hidden xs:inline">{subjectInfo.name}</span>}
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
                        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
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

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 items-start">
                      {/* Current Focus */}
                      <div className="space-y-4 sm:space-y-6">
                        <h4 className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                          <Clock size={12} className="text-ctu-maroon" /> Current Focus
                        </h4>
                        {roadmap.length > 0 ? (
                          <Card 
                            className="relative p-4 sm:p-6 rounded-2xl sm:rounded-3xl border backdrop-blur-sm overflow-hidden min-h-[120px] sm:min-h-[140px] flex flex-col justify-center cursor-pointer group hover:scale-[1.02] transition-all"
                            style={{ background: 'linear-gradient(135deg, rgba(var(--color-ctu-gold)/0.05), rgba(var(--color-ctu-maroon)/0.03))' }}
                            onClick={() => setActiveTab('advisor')}
                          >
                            <div className="absolute -right-4 -bottom-4 text-ctu-gold opacity-10 rotate-12 shrink-0 group-hover:scale-110 transition-transform">
                              <BrainCircuit size={60} className="sm:size-[100px]" />
                            </div>
                            <div className="relative z-10 flex items-start gap-3 sm:gap-4 min-w-0">
                              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-ctu-gold/10 flex items-center justify-center text-ctu-gold shrink-0">
                                <TrendingUp size={20} className="sm:size-[24px]" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h5 className="text-sm sm:text-lg font-bold text-foreground leading-tight line-clamp-2">
                                  {roadmap[0].subjects?.[0] || 'Curriculum Path'}
                                </h5>
                                <p className="text-[9px] sm:text-xs text-foreground/40 mt-1 font-medium line-clamp-1">{roadmap[0].title}</p>
                              </div>
                            </div>
                          </Card>
                        ) : (
                          <div className="neumorphic-pressed rounded-2xl sm:rounded-3xl p-6 sm:p-8 text-center min-h-[120px] sm:min-h-[140px] flex items-center justify-center">
                            <p className="text-[10px] sm:text-xs text-foreground/40 leading-relaxed font-medium">
                              Initialization required. Click Analyze to synthesize subject data.
                            </p>
                          </div>
                        )}
                      </div>

                    <Card className="neumorphic-card border-none p-4 sm:p-6 bg-ctu-maroon/5 border border-ctu-maroon/10">
                      <h3 className="font-bold text-sm sm:text-base text-foreground mb-2 flex items-center gap-2">
                        <Info size={14} className="text-ctu-maroon" /> AI Insight
                      </h3>
                      <p className="text-[10px] sm:text-xs text-foreground/60 leading-relaxed font-medium">
                        Focus on <b className="text-foreground">IE 311: Production Systems</b> next semester to advance your specialization.
                      </p>
                    </Card>
                  </div>
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
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6 mb-8 sm:mb-12">
                  <div>
                    <h2 className="text-2xl sm:text-4xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 sm:py-2">
                       Matrix Map
                    </h2>
                    <p className="text-[10px] sm:text-base md:text-xl text-foreground/40 font-medium mt-1 sm:mt-2 tracking-tight">Interactive dependency graph of the IE curriculum.</p>
                  </div>
                  <Button variant="outline" className="h-10 sm:h-12 rounded-xl border-none neumorphic-raised text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-ctu-gold w-full md:w-auto">
                    <Maximize size={16} className="mr-2" /> Expand Data Map
                  </Button>
                </div>
                <GlowCard className="p-4 sm:p-10 flex flex-col gap-4 sm:gap-8 relative overflow-hidden" glowColor="blue">
                  <div className="relative z-20 text-left px-2">
                    <h2 className="text-2xl sm:text-4xl font-display font-black mb-2 tracking-tight">Academic Matrix Map</h2>
                    <p className="text-sm text-foreground/40 max-w-xs sm:max-w-sm font-medium">
                      Visualizing the flow of Industrial Engineering subjects from fundamentals to specialization.
                    </p>
                  </div>

                  <div className="w-full flex flex-col items-center gap-12 relative z-10">
                    {/* Visualizing Year Progress */}
                    {['1st', '2nd', '3rd', '4th'].map((year, yIdx) => (
                      <div key={year} className="w-full flex flex-col items-center gap-6">
                        <div className="flex flex-wrap justify-center gap-3 sm:gap-6 w-full">
                          {IE_SUBJECTS.filter(s => s.yearLevel === year).slice(0, 4).map((subject) => {
                            const isDone = progressMap[subject.id]?.status === 'done';
                            const isPrep = progressMap[subject.id]?.status === 'in_progress';
                            
                            return (
                              <div 
                                key={subject.id}
                                className={cn(
                                  "w-full max-w-[180px] p-3 sm:p-4 rounded-2xl transition-all border flex flex-col justify-between min-h-[100px] cursor-pointer",
                                  isDone ? "bg-emerald-500/10 border-emerald-500/20" : 
                                  isPrep ? "bg-ctu-gold/10 border-ctu-gold/20" : "bg-background neumorphic-raised border-foreground/5 shadow-sm"
                                )}
                                onClick={() => navigate(`/catalog/${subject.id}`)}
                              >
                                <div>
                                  <div className="flex justify-between items-center mb-2">
                                    <span className={cn(
                                      "text-[8px] font-black uppercase",
                                      isDone ? "text-emerald-500" : isPrep ? "text-ctu-gold" : "text-foreground/30"
                                    )}>
                                      {subject.code}
                                    </span>
                                    {isDone && <Award size={12} className="text-emerald-500" />}
                                  </div>
                                  <h5 className="text-[11px] sm:text-xs font-bold leading-tight text-clamp-1">{subject.name}</h5>
                                </div>
                                <Progress value={isDone ? 100 : isPrep ? 40 : 0} className="h-1 mt-3" />
                              </div>
                            );
                          })}
                        </div>
                        {yIdx < 3 && (
                          <div className="flex flex-col items-center py-4">
                            <motion.div
                              initial={{ scaleY: 0 }}
                              whileInView={{ scaleY: 1 }}
                              transition={{ duration: 0.8, ease: "easeOut" }}
                              className="w-0.5 h-12 bg-gradient-to-b from-ctu-gold/60 to-ctu-maroon/20 origin-top"
                            />
                            <div className="w-2 h-2 rounded-full bg-ctu-gold animate-pulse" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </GlowCard>
            </motion.div>
          </TabsContent>

          <TabsContent value="groups" className="mt-0 space-y-6 sm:space-y-12 outline-none">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-8">
                  <div>
                    <h2 className="text-xl sm:text-5xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 flex items-center gap-2 uppercase">
                       Active Squads <Users size={20} className="text-ctu-gold sm:size-16" />
                    </h2>
                    <p className="text-[10px] sm:text-xl text-foreground/40 font-medium mt-1 tracking-tight uppercase">Peer-to-peer intelligence networks.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-72">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" size={14} />
                      <Input 
                        placeholder="Scan Squads..." 
                        className="pl-12 neumorphic-pressed border-none h-11 sm:h-14 rounded-xl sm:rounded-2xl text-[10px] sm:text-sm font-medium"
                        value={groupSearchQuery}
                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                      />
                    </div>
                    <Dialog open={isNewGroupModalOpen} onOpenChange={setIsNewGroupModalOpen}>
                      <DialogTrigger 
                        render={
                          <Button className="rounded-xl sm:rounded-2xl bg-ctu-maroon text-white font-black uppercase tracking-widest text-[9px] sm:text-[11px] gap-2 h-11 sm:h-14 px-4 sm:px-8 shadow-xl w-full">
                            <Plus size={16} /> New Squad
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

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                      <GlowCard className="p-5 sm:p-8 h-full flex flex-col justify-between group neumorphic-raised border-foreground/5 hover:border-blue-500/30 transition-all duration-500 rounded-3xl sm:rounded-[2.5rem]" glowColor="blue">
                        <div>
                          <div className="flex items-center justify-between mb-4 sm:mb-8">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shadow-inner group-hover:rotate-12 transition-transform">
                                 <Users size={20} />
                               </div>
                               <Badge className="bg-foreground/[0.03] text-foreground/40 border-none text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-md">{group.subjectCode}</Badge>
                            </div>
                            <div className="flex -space-x-2 sm:-space-x-3">
                              {(group.members || []).slice(0, 3).map((mId: string, i: number) => (
                                <div key={i} className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 sm:border-[3px] border-background bg-foreground/5 flex items-center justify-center text-[8px] sm:text-[10px] font-black ring-1 ring-foreground/5 shadow-md">
                                  {mId.slice(0, 2).toUpperCase()}
                                </div>
                              ))}
                              {(group.members || []).length > 3 && (
                                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-full border-2 sm:border-[3px] border-background bg-gradient-to-br from-ctu-gold to-ctu-maroon flex items-center justify-center text-[8px] sm:text-[10px] font-black text-white shadow-lg ring-1 ring-ctu-gold/20">
                                  +{(group.members || []).length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                          <h3 className="text-xl sm:text-2xl font-black text-foreground mb-2 leading-tight group-hover:text-blue-500 transition-colors uppercase tracking-tighter truncate">{group.name}</h3>
                          <p className="text-[11px] sm:text-sm font-medium text-foreground/40 leading-relaxed line-clamp-2 mb-4 sm:mb-8">{group.description || "Mission brief encrypted. Join to decrypt."}</p>
                        </div>
                        
                        <div className="mt-auto pt-4 sm:pt-8 border-t border-foreground/5 flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] sm:text-[10px] font-black text-foreground/20 uppercase tracking-[0.2em]">Intel</span>
                            <span className="text-xs font-black text-foreground/60 tracking-tight">{(group.members || []).length} / 50</span>
                          </div>
                          <div className="flex gap-2">
                            {group.members?.includes(user?.uid) ? (
                              <Button 
                                onClick={() => setActiveChatGroup(group)}
                                className="bg-blue-500 text-white rounded-xl sm:rounded-2xl h-10 sm:h-12 px-4 sm:px-6 font-black text-[9px] sm:text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.05] active:scale-95 transition-all"
                              >
                                Hub
                              </Button>
                            ) : (
                              <Button 
                                onClick={() => handleJoinGroup(group.id)}
                                className="neumorphic-raised hover:neumorphic-pressed text-ctu-gold border-none rounded-xl sm:rounded-2xl h-10 sm:h-12 px-4 sm:px-8 font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all gap-1 sm:gap-2 hover:scale-[1.05] active:scale-95"
                              >
                                Join Squad
                              </Button>
                            )}
                          </div>
                        </div>
                      </GlowCard>
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

          <TabsContent value="qa" className="mt-0 space-y-4 sm:space-y-12 outline-none">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-6">
                  <div>
                    <h2 className="text-xl sm:text-4xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 flex items-center gap-2 uppercase">
                       Forum Hub <MessageSquare size={20} className="text-ctu-gold shrink-0 sm:size-16" />
                    </h2>
                    <p className="text-[10px] sm:text-base md:text-xl text-foreground/40 font-medium mt-1 tracking-tight uppercase">Collective intelligence pool.</p>
                  </div>
                  <Dialog open={isAskQuestionModalOpen} onOpenChange={setIsAskQuestionModalOpen}>
                    <DialogTrigger
                      render={
                        <Button 
                          className="h-11 sm:h-14 px-6 sm:px-8 rounded-xl sm:rounded-2xl bg-ctu-maroon text-white font-black uppercase tracking-widest text-[9px] sm:text-[11px] gap-2 shadow-xl w-full md:w-auto"
                        >
                          <Plus size={16} /> Signal Question
                        </Button>
                      }
                    />
                    <DialogContent className="sm:max-w-[425px] neumorphic-card border-none p-6 sm:p-8">
                      <DialogHeader>
                        <DialogTitle className="text-xl sm:text-2xl font-black italic tracking-tight">TRANSMIT INQUIRY</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 sm:gap-6 py-2 sm:py-4">
                        <div className="space-y-1.5">
                          <Label htmlFor="q-title" className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Question Headline</Label>
                          <Input id="q-title" value={newQuestion.title} onChange={e => setNewQuestion({...newQuestion, title: e.target.value})} className="neumorphic-pressed border-none h-11 sm:h-12 rounded-xl text-xs" placeholder="Headline..." />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="q-subject" className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Target Topic</Label>
                          <Select onValueChange={(val: string) => setNewQuestion({...newQuestion, subjectTag: val})}>
                            <SelectTrigger className="neumorphic-pressed border-none h-11 sm:h-12 rounded-xl text-xs">
                              <SelectValue placeholder="Select topic" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                              {IE_SUBJECTS.map(s => <SelectItem key={s.id} value={s.code} className="text-xs uppercase font-bold">{s.code}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="q-content" className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground/30">Full Context</Label>
                          <Textarea id="q-content" value={newQuestion.content} onChange={e => setNewQuestion({...newQuestion, content: e.target.value})} className="neumorphic-pressed border-none h-24 sm:h-32 rounded-xl text-xs p-3" placeholder="Context..." />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAskQuestion} className="bg-ctu-maroon text-white font-black uppercase tracking-widest w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl shadow-lg shadow-ctu-maroon/20 text-[10px]">Post Question</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" size={14} />
                    <Input 
                      placeholder="Search matrix data..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-background border-none neumorphic-pressed pl-10 pr-10 h-11 sm:h-14 rounded-xl sm:rounded-2xl focus:ring-ctu-gold text-[10px] sm:text-sm text-foreground font-medium"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-full hover:bg-foreground/5 text-foreground/40 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
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
                        className="neumorphic-card border-none p-3 sm:p-8 hover:shadow-2xl transition-all cursor-pointer group rounded-2xl sm:rounded-[2.5rem]"
                      >
                        <div className="flex gap-3 sm:gap-8">
                          <div className="flex flex-col items-center gap-1 shrink-0 neumorphic-pressed px-1.5 sm:px-3 py-2 sm:py-4 rounded-xl sm:rounded-3xl h-fit border border-white/5">
                            <Button 
                              variant="ghost" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVote(q.id, q.votes || 0);
                              }}
                              className="p-1 h-9 w-9 sm:h-auto sm:w-auto hover:bg-transparent group-hover:scale-125 transition-transform"
                            >
                              <TrendingUp size={20} className={cn("text-foreground/10 hover:text-ctu-gold transition-colors sm:size-4", (q.votes || 0) > 0 && "text-ctu-gold")} />
                            </Button>
                            <span className="font-black text-xs sm:text-xl tracking-tighter">{(q.votes || 0)}</span>
                            <span className="text-[6px] sm:text-[9px] font-black text-foreground/20 uppercase tracking-widest leading-[0.5]">Votes</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-3">
                               <div className="flex items-center gap-2">
                                 <Badge className="bg-blue-500/10 text-blue-500 border-none text-[7px] sm:text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md">{q.subjectTag || 'General'}</Badge>
                                 <span className="text-[7px] sm:text-[10px] font-black text-foreground/20 uppercase tracking-widest hidden sm:inline">{q.createdAt ? (q.createdAt.toDate ? new Date(q.createdAt.toDate()).toLocaleDateString() : 'Just now') : 'Just now'}</span>
                               </div>
                               {(user?.role === 'admin' || (user && user.uid !== q.userId)) && (
                                 <Button 
                                   variant="ghost" 
                                   size="sm"
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     handleReportQuestion(q);
                                   }}
                                   className="h-6 w-6 sm:h-10 sm:w-10 p-0 rounded-full text-foreground/10 hover:text-red-500 hover:bg-red-500/5 transition-all"
                                 >
                                   <Flag size={12} />
                                 </Button>
                               )}
                            </div>
                            <h3 className="text-sm sm:text-2xl font-black text-foreground mb-1 sm:mb-3 leading-tight group-hover:text-ctu-gold transition-colors tracking-tight line-clamp-1 uppercase truncate">{q.title}</h3>
                            <p className="text-[10px] sm:text-base text-foreground/50 line-clamp-2 mb-3 sm:mb-6 font-medium leading-relaxed">{q.content}</p>
                            <div className="flex items-center gap-2 sm:gap-6 text-[7px] sm:text-[10px] font-black text-foreground/30 uppercase tracking-widest">
                              <span className="flex items-center gap-1 sm:gap-2 bg-foreground/5 px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl"><MessageSquare size={10} className="text-ctu-gold sm:size-3" /> {q.answerCount || 0}</span>
                              <span className="flex items-center gap-1 sm:gap-2 bg-foreground/5 px-2 sm:px-4 py-1 sm:py-2 rounded-lg sm:rounded-xl"><Users size={10} className="text-blue-500 sm:size-3" /> {q.userName?.split(' ')[0] || 'Member'}</span>
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
                          <h2 className="text-3xl sm:text-5xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-2">
                             Flash Decks
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

                  <div className="flex flex-col md:flex-row gap-4 mb-4 sm:mb-8">
                      <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" size={16} />
                        <Input 
                          placeholder="Search decks..." 
                          className="pl-12 neumorphic-pressed border-none h-12 sm:h-14 rounded-2xl text-xs sm:text-sm font-medium"
                          value={deckSearchQuery}
                          onChange={(e) => setDeckSearchQuery(e.target.value)}
                        />
                      </div>
                      <Select value={deckSubjectFilter} onValueChange={setDeckSubjectFilter}>
                        <SelectTrigger className="w-full sm:w-[180px] neumorphic-pressed border-none h-12 sm:h-14 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                          <SelectValue placeholder="All Subjects" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                          <SelectItem value="all">ALL SECTORS</SelectItem>
                          {IE_SUBJECTS.map(s => (
                            <SelectItem key={s.code} value={s.code}>{s.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-8">
                      <AnimatePresence mode="popLayout">
                        {filteredDecks.length > 0 ? filteredDecks.map((deck, i) => (
                          <motion.div
                            key={deck.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            whileHover={{ y: -10 }}
                            transition={{ 
                              delay: i * 0.05,
                              type: "spring",
                              stiffness: 200,
                              damping: 20
                            }}
                          >
                            <GlowCard 
                              className="p-5 sm:p-8 text-center cursor-pointer hover:shadow-3xl transition-all h-full neumorphic-raised border-foreground/5 rounded-[1.5rem] sm:rounded-[2.5rem]" 
                              glowColor={deck.color as any || 'maroon'}
                              onClick={() => setSelectedDeck(deck)}
                            >
                              <div className={cn(
                                "w-14 h-14 sm:w-20 sm:h-20 rounded-[1.25rem] sm:rounded-[2rem] neumorphic-pressed flex items-center justify-center mx-auto mb-4 sm:mb-8 transition-transform group-hover:scale-110 shadow-inner",
                                deck.color === 'maroon' ? 'text-ctu-maroon' : 
                                deck.color === 'gold' ? 'text-ctu-gold' :
                                deck.color === 'blue' ? 'text-blue-500' : 'text-green-500'
                              )}>
                                <Layers size={30} className="sm:size-[40px] drop-shadow-sm" />
                              </div>
                              <h3 className="text-lg sm:text-xl font-black text-foreground mb-1 line-clamp-1 truncate uppercase tracking-tighter">{deck.name}</h3>
                              {deck.subjectId && (
                                <Badge variant="secondary" className="mb-3 sm:mb-4 text-[8px] sm:text-[10px] h-5 font-black bg-foreground/5 text-foreground/40 px-3 tracking-[0.2em] rounded-lg">{deck.subjectId}</Badge>
                              )}
                              <p className="text-[8px] sm:text-[10px] text-foreground/40 font-black uppercase tracking-[0.3em] bg-foreground/5 py-1.5 sm:py-2 rounded-xl mb-6 sm:mb-8">{deck.cardCount || 0} Retention Units</p>
                              <div className="flex gap-3">
                                <Button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startFlashcardSession(deck);
                                  }}
                                  className={cn(
                                    "flex-1 rounded-xl sm:rounded-2xl h-10 sm:h-12 text-[9px] sm:text-[10px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95",
                                    deck.color === 'maroon' ? 'bg-ctu-maroon text-white shadow-ctu-maroon/20' : 
                                    deck.color === 'gold' ? 'bg-ctu-gold text-white shadow-ctu-gold/20' :
                                    deck.color === 'blue' ? 'bg-blue-500 text-white shadow-blue-500/20' : 'bg-green-500 text-white shadow-green-500/20'
                                  )}
                                >
                                  Deploy Study
                                </Button>
                              </div>
                            </GlowCard>
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
                    <h2 className="text-2xl sm:text-4xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 sm:py-2">
                       AI Quizzes
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-8">
                  {/* Gen Quiz Card */}
                  <GlowCard className="p-6 sm:p-10 flex flex-col justify-between min-h-0" glowColor="orange">
                    <div>
                      <h3 className="text-2xl sm:text-4xl font-black mb-4 tracking-tight">Start Quiz Session</h3>
                      <p className="text-sm text-foreground/60 leading-relaxed mb-8 font-medium">
                        Generate a unique Industrial Engineering quiz powered by AI to test your knowledge in real-time.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <Label className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/40 ml-1">Select Domain</Label>
                      <Select onValueChange={(val: string) => startQuizSession(val)}>
                        <SelectTrigger className="h-14 rounded-2xl bg-white/5 border-white/10 text-foreground font-medium px-6">
                          <SelectValue placeholder="Choose a subject sector..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-2xl">
                          {IE_SUBJECTS.slice(0, 10).map(s => (
                            <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={() => startQuizSession("General IE")}
                        disabled={isSessionLoading}
                        className="w-full h-14 bg-ctu-gold text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-ctu-gold/20 hover:scale-[1.02] active:scale-95 transition-all mt-4"
                      >
                        {isSessionLoading ? "Analyzing Syllabi..." : "Initiate AI Quiz"}
                      </Button>
                    </div>
                  </GlowCard>

                  {/* Achievements Card */}
                  <GlowCard className="p-8 sm:p-10 flex flex-col" glowColor="blue">
                    <h3 className="text-xl font-bold mb-8 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-ctu-gold/10 text-ctu-gold">
                        <Award size={20} />
                      </div>
                      Your Achievements
                    </h3>
                    <div className="grid grid-cols-4 gap-6">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="group relative flex flex-col items-center">
                          <motion.div 
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            className="relative w-14 h-14 sm:w-20 sm:h-20 rounded-full p-1"
                          >
                            <div className={cn(
                              "absolute inset-0 rounded-full transition-all duration-500",
                              i <= 3 ? "bg-gradient-to-br from-ctu-gold via-white to-ctu-maroon shadow-lg" : "bg-foreground/5 opacity-50"
                            )} />
                            <div className="absolute inset-1 rounded-full bg-background neumorphic-pressed flex items-center justify-center">
                              <Award size={24} className={cn("transition-all duration-700", i <= 3 ? "text-ctu-gold drop-shadow-[0_0_8px_rgba(var(--color-ctu-gold)/0.5)]" : "text-foreground/10 grayscale")} />
                            </div>
                            {i <= 3 && (
                              <motion.div 
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-ctu-gold border-2 border-background flex items-center justify-center shadow-xl ring-2 ring-ctu-gold/20"
                              >
                                <Sparkles size={10} className="text-white animate-pulse" />
                              </motion.div>
                            )}
                          </motion.div>
                          <span className="text-[9px] font-black text-foreground/20 uppercase tracking-widest mt-4 text-center group-hover:text-ctu-gold transition-colors">{i <= 3 ? `Elite Tier ${i}` : 'LOCKED'}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-auto pt-8 border-t border-foreground/5">
                      <div className="flex justify-between items-center mb-6">
                        <span className="text-[10px] font-black text-foreground/30 uppercase tracking-[0.2em]">Recent Performance</span>
                        <div className="flex items-center gap-1">
                          <TrendingUp size={12} className="text-green-500" />
                          <span className="text-[10px] text-green-500 font-black">TOP TIERO</span>
                        </div>
                      </div>
                      <div className="space-y-5">
                        {[
                          { label: 'Work Measurement', score: 92 },
                          { label: 'Industrial Safety', score: 78 }
                        ].map((s, i) => (
                          <div key={i} className="space-y-2">
                            <div className="flex justify-between text-[11px] font-bold">
                              <span className="text-foreground/60">{s.label}</span>
                              <span className={cn(s.score >= 80 ? "text-green-500" : "text-ctu-gold")}>{s.score}%</span>
                            </div>
                            <Progress value={s.score} className="h-2 rounded-full bg-foreground/5" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </GlowCard>
                </div>
              </motion.div>
              </TabsContent>

            <TabsContent value="notebooks" className="mt-0 space-y-6 md:space-y-12 outline-none">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
                  <div>
                    <h2 className="text-2xl sm:text-4xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-1 sm:py-2">
                       AI Notebooks
                    </h2>
                    <p className="text-[10px] sm:text-base md:text-xl text-foreground/40 font-medium mt-1 sm:mt-2 tracking-tight">Structured knowledge repositories enhanced by AI analysis.</p>
                  </div>
                  <Button className="h-10 sm:h-14 px-6 sm:px-8 rounded-xl sm:rounded-2xl bg-foreground text-background font-black uppercase tracking-widest text-[9px] sm:text-[11px] gap-2 sm:gap-3 w-full md:w-auto">
                    <Plus size={16} /> Create Terminal
                  </Button>
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
                      <span className="text-[9px] font-bold uppercase text-foreground/40">{msg.userName}</span>
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
                    <span className="text-sm font-black text-foreground/80 tracking-tight">{selectedQuestion?.userName || 'Anonymous'}</span>
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
                          <span className="text-[10px] font-black text-ctu-gold uppercase tracking-[0.2em]">{selectedQuestion.latestAnswer.userName}</span>
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
          <DialogContent className="max-w-md w-[95vw] h-[85dvh] flex flex-col bg-background rounded-3xl border-none p-0 overflow-hidden overscroll-contain">
            <DialogHeader className="p-4 sm:p-6 border-b border-foreground/5 bg-background z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full neumorphic-raised flex items-center justify-center text-ctu-gold">
                  <BrainCircuit size={20} />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold">Academic Assistant</DialogTitle>
                  <p className="text-[10px] font-bold text-ctu-gold uppercase tracking-widest">Powered by Matrix AI</p>
                </div>
              </div>
            </DialogHeader>
            
            <ScrollArea className="flex-1 p-6">
              <div className="flex flex-col gap-6">
                {advisorChat.length === 0 && (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-ctu-gold/5 flex items-center justify-center mx-auto text-ctu-gold animate-bounce">
                      <Sparkles size={32} />
                    </div>
                    <p className="text-sm text-foreground/40 font-medium">Ask me about your roadmap, elective choices,<br/>or specialization tracks!</p>
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
            </ScrollArea>

            <form onSubmit={handleAdvisorChat} className="p-6 border-t border-foreground/5 shrink-0 bg-background">
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
