import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
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
  MoreVertical
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
    const updatedChat = [...advisorChat, userMsg];
    setAdvisorChat(updatedChat);
    setAdvisorInput('');
    setIsAdvisorLoading(true);

    try {
      const systemCtx = `You are an IE Matrix AI Tutor for Industrial Engineering students at Cebu Technological University.
Curriculum: ${JSON.stringify(IE_SUBJECTS.map(s => ({ code: s.code, name: s.name, year: s.yearLevel, prereqs: s.prerequisiteIds })))}
Student Progress: ${JSON.stringify(progressMap)}
Current Roadmap: ${JSON.stringify(roadmap)}
Be concise, helpful, and use markdown. Focus on IE academics.`;
      const history = updatedChat.map(m => `${m.role === 'user' ? 'Student' : 'Advisor'}: ${m.content}`).join('\n');
      const fullPrompt = `${systemCtx}\n\nConversation:\n${history}\n\nAdvisor:`;
      const response = await askQuestion(fullPrompt, '');
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
      <div className="min-h-screen bg-background text-foreground flex">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="skeleton h-16 w-48 rounded-xl mx-auto" />
          <div className="skeleton h-5 w-64 rounded-lg mx-auto" />
          <div className="mt-8 space-y-3 w-full max-w-lg px-8">
            <div className="skeleton h-12 w-full rounded-2xl" />
            <div className="skeleton h-12 w-full rounded-2xl" />
            <div className="skeleton h-12 w-3/4 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (activeSession) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 lg:p-10 flex flex-col items-center justify-center relative">
        <Button 
          variant="ghost" 
          onClick={() => setActiveSession(null)}
          className="absolute top-10 left-10 neumorphic-raised rounded-xl"
        >
          Exit Session
        </Button>

        <div className="max-w-xl w-full">
          {activeSession.type === 'flashcards' ? (
            <div className="space-y-8">
              <div className="text-center">
                <Badge className="bg-ctu-gold text-white font-bold mb-4">FLASHCARD {currentStep + 1}/{activeSession.data.length}</Badge>
                <div className="h-2 bg-foreground/5 rounded-full overflow-hidden w-full">
                  <div className="h-full bg-ctu-gold transition-all duration-300" style={{ width: `${((currentStep + 1) / activeSession.data.length) * 100}%` }} />
                </div>
              </div>

              <div className="perspective-1000 h-[300px] md:h-[400px]">
                <motion.div 
                  key={currentStep}
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                  className="relative w-full h-full cursor-pointer preserve-3d"
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  {/* Front */}
                  <div className="absolute inset-0 backface-hidden flex items-center justify-center p-8 text-center bg-white rounded-3xl neumorphic-raised border border-white/20">
                    <div className="space-y-4">
                      <span className="text-[10px] font-bold text-foreground/20 uppercase tracking-[0.2em]">Question</span>
                      <h2 className="text-2xl md:text-3xl font-bold text-foreground leading-tight">
                        {activeSession.data[currentStep].front}
                      </h2>
                    </div>
                  </div>
                  
                  {/* Back */}
                  <div 
                    className="absolute inset-0 backface-hidden flex items-center justify-center p-8 text-center bg-ctu-maroon/5 rounded-3xl neumorphic-pressed border border-ctu-maroon/10 rotate-y-180"
                  >
                    <div className="space-y-4">
                      <span className="text-[10px] font-bold text-ctu-maroon/40 uppercase tracking-[0.2em]">Answer</span>
                      <p className="text-lg md:text-xl font-medium text-foreground">
                        {activeSession.data[currentStep].back}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              <div className="flex flex-col gap-4">
                {!isFlipped ? (
                  <Button 
                    onClick={() => setIsFlipped(true)}
                    className="w-full h-14 rounded-2xl bg-ctu-maroon text-white font-bold text-lg shadow-lg"
                  >
                    Reveal Answer
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Again', quality: 0, color: 'bg-red-500 hover:bg-red-600' },
                      { label: 'Hard', quality: 2, color: 'bg-orange-500 hover:bg-orange-600' },
                      { label: 'Good', quality: 4, color: 'bg-blue-500 hover:bg-blue-600' },
                      { label: 'Easy', quality: 5, color: 'bg-green-500 hover:bg-green-600' }
                    ].map((btn) => (
                      <Button
                        key={btn.label}
                        onClick={() => handleRateCard(activeSession.data[currentStep].id, btn.quality)}
                        className={cn("h-12 rounded-xl text-white font-bold text-xs", btn.color)}
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
                    <Badge className="bg-ctu-maroon text-white font-bold mb-4">QUESTION {currentStep + 1}/5</Badge>
                    <div className="h-2 bg-foreground/5 rounded-full overflow-hidden w-full">
                      <div className="h-full bg-ctu-maroon transition-all duration-300" style={{ width: `${((currentStep + 1) / 5) * 100}%` }} />
                    </div>
                  </div>

                  <GlowCard className="p-8" glowColor="blue">
                    <h3 className="text-xl font-bold mb-8">{activeSession.data[currentStep].question}</h3>
                    <div className="grid gap-4">
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
                           className="w-full text-left p-4 rounded-xl neumorphic-raised hover:neumorphic-pressed transition-all text-sm font-medium"
                        >
                          {opt}
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
      
      <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 lg:mb-12">
          <div>
            <h1 className="text-4xl sm:text-6xl md:text-8xl frosted-header font-black tracking-tighter leading-[0.9] py-2 flex items-center gap-4">
              Study Hub <Sparkles className="text-ctu-gold shrink-0 scale-125" size={56} />
            </h1>
            <p className="text-foreground/40 mt-3 text-xl font-medium tracking-tight">Elevate your learning with AI guidance and community support.</p>
          </div>
        </div>

        <Tabs defaultValue="advisor" value={activeTab} onValueChange={setActiveTab} className="space-y-6 md:space-y-10">
          <div className="sticky top-0 z-30 -mx-6 px-6 py-2 bg-background/80 backdrop-blur-md overflow-x-auto no-scrollbar border-b border-foreground/5">
            <TabsList className="bg-transparent h-auto p-0 gap-3 md:gap-6 flex w-max">
              {[
                { id: 'advisor', label: 'AI Advisor', icon: BrainCircuit },
                { id: 'map', label: 'Matrix Map', icon: BookOpen },
                { id: 'groups', label: 'Study Groups', icon: Users },
                { id: 'qa', label: 'Q&A Forum', icon: MessageSquare },
                { id: 'flashcards', label: 'Flashcards', icon: Layers },
                { id: 'quizzes', label: 'Practice Quiz', icon: Award },
                { id: 'notebooks', label: 'AI Notebooks', icon: BookOpen },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-widest transition-all border-none whitespace-nowrap",
                    activeTab === tab.id 
                      ? "neumorphic-pressed text-ctu-gold translate-y-0.5" 
                      : "neumorphic-raised text-foreground/40 hover:text-foreground hover:translate-y-[-2px]"
                  )}
                >
                  <tab.icon size={16} className={activeTab === tab.id ? "text-ctu-gold" : "text-foreground/20"} />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="advisor" className="mt-0 space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <GlowCard className="lg:col-span-2 p-5 md:p-8" glowColor="orange">
                    <div className="flex items-start justify-between mb-8">
                      <div>
                        <h2 className="text-4xl font-display font-black flex items-center gap-4 tracking-tight">
                          Smart Study Roadmap <TrendingUp className="text-ctu-gold" size={32} />
                        </h2>
                        <p className="text-base text-foreground/40 mt-2 font-medium">AI-generated sequence based on your progress and subject difficulty.</p>
                      </div>
                      <div className="flex gap-4">
                        <Button 
                          onClick={() => setIsAdvisorChatOpen(true)}
                          variant="outline"
                          className="neumorphic-raised text-ctu-gold font-bold border-none"
                        >
                          Chat with AI
                        </Button>
                        <Button 
                          onClick={handleGenerateRoadmap} 
                          disabled={isGenerating}
                          className="bg-ctu-gold text-white font-bold rounded-xl px-6 py-2"
                        >
                          {isGenerating ? "Analyzing..." : "Generate Plan"}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-0 relative">
                      {roadmap.length > 0 ? (
                        <div className="mt-8 space-y-16">
                          {roadmap.map((step, idx) => (
                            <motion.div 
                              key={idx} 
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: idx * 0.15 }}
                              className="relative"
                            >
                              {/* Connector Line to Next Phase */}
                              {idx < roadmap.length - 1 && (
                                <div className="absolute left-1/2 -bottom-16 w-0.5 h-16 bg-gradient-to-b from-ctu-gold via-ctu-gold/20 to-transparent -translate-x-1/2 hidden md:block" />
                              )}
                              
                              <div className="flex flex-col items-center">
                                {/* Phase Header Node */}
                                <div className="z-20 mb-8 w-full max-w-sm">
                                  <div className={cn(
                                    "p-4 rounded-2xl border flex items-center gap-4 shadow-xl transition-all duration-500",
                                    step.difficulty === 'hard' 
                                      ? "bg-ctu-maroon/10 border-ctu-maroon/30 shadow-ctu-maroon/5" 
                                      : "bg-ctu-gold/10 border-ctu-gold/30 shadow-ctu-gold/5"
                                  )}>
                                    <div className={cn(
                                      "w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg",
                                      step.difficulty === 'hard' ? "bg-ctu-maroon text-white" : "bg-ctu-gold text-white"
                                    )}>
                                      {idx + 1}
                                    </div>
                                    <div>
                                      <h3 className="font-black text-foreground text-sm uppercase tracking-wider">{step.title}</h3>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className={cn(
                                          "text-[8px] font-black uppercase tracking-widest border-none px-2 py-0.5 h-auto",
                                          step.difficulty === 'hard' ? "bg-ctu-maroon/20 text-ctu-maroon" : "bg-green-500/20 text-green-500"
                                        )}>
                                          {step.difficulty} Phase
                                        </Badge>
                                        {step.estimatedTime && (
                                          <span className="text-[8px] font-bold text-foreground/30 uppercase flex items-center gap-1">
                                            <Clock size={10} /> {step.estimatedTime}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Subjects Grid (Interconnected Nodes) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                                  {step.subjects?.map((sCode: string, sIdx: number) => {
                                    const normalizeCode = (c: string) => c.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                                    const subjectInfo = IE_SUBJECTS.find(s => normalizeCode(s.code) === normalizeCode(sCode));
                                    const progress = subjectInfo ? progressMap[subjectInfo.id] : null;
                                    const isDone = progress?.status === 'done';
                                    const isInProgress = progress?.status === 'in_progress';
                                    
                                    return (
                                      <motion.div 
                                        key={sCode}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: (idx * 0.2) + (sIdx * 0.1) }}
                                        className="relative group"
                                      >
                                        <div className={cn(
                                          "p-5 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden",
                                          isDone 
                                            ? "bg-green-500/5 border-green-500/30" 
                                            : isInProgress 
                                              ? "bg-ctu-gold/5 border-ctu-gold/50 shadow-[0_0_15px_rgba(197,160,89,0.1)]"
                                              : "bg-background border-foreground/5 hover:border-ctu-gold/30"
                                        )}>
                                          {/* Background Pattern for 'Done' */}
                                          {isDone && (
                                            <div className="absolute top-0 right-0 p-2 text-green-500 opacity-20">
                                              <Award size={40} />
                                            </div>
                                          )}

                                          <div className="flex items-start justify-between mb-3">
                                            <span className={cn(
                                              "text-[9px] font-black tracking-tighter uppercase px-2 py-0.5 rounded-md",
                                              isDone ? "bg-green-500 text-white" : "bg-foreground/10 text-foreground/60"
                                            )}>
                                              {sCode}
                                            </span>
                                            {isDone ? (
                                              <Badge className="bg-green-500 text-white border-none text-[8px] font-bold">COMPLETED</Badge>
                                            ) : isInProgress ? (
                                              <Badge className="bg-ctu-gold text-white border-none text-[8px] font-bold animate-pulse">ACTIVE FOCUS</Badge>
                                            ) : null}
                                          </div>

                                          <h4 className="text-xs font-bold text-foreground mb-4 line-clamp-2 min-h-[2rem]">
                                            {subjectInfo?.name || sCode}
                                          </h4>

                                          {/* Prerequisite Tags */}
                                          {subjectInfo?.prerequisiteIds && subjectInfo.prerequisiteIds.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-auto">
                                              {subjectInfo.prerequisiteIds.map(pid => {
                                                const preCode = IE_SUBJECTS.find(s => s.id === pid)?.code || pid;
                                                return (
                                                  <span key={pid} className="text-[7px] font-black bg-foreground/5 text-foreground/40 px-1.5 py-0.5 rounded border border-foreground/5">
                                                    PRE: {preCode}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          )}
                                          
                                          <button 
                                            onClick={() => subjectInfo && navigate(`/catalog/${subjectInfo.id}`)}
                                            className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-ctu-gold"
                                          >
                                            <ChevronRight size={16} />
                                          </button>
                                        </div>

                                        {/* Dynamic SVG Connections (Simplified) */}
                                        {sIdx < (step.subjects?.length || 0) - 1 && (
                                          <div className="absolute -right-3 top-1/2 w-3 h-0.5 bg-foreground/5 hidden lg:block" />
                                        )}
                                      </motion.div>
                                    );
                                  })}
                                </div>
                              </div>
                            </motion.div>
                          ))}
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
                    <Card className="neumorphic-card border-none p-6">
                      <h3 className="font-bold text-foreground mb-4">Current Focus</h3>
                      <div className="space-y-4">
                        <div className="p-4 rounded-2xl neumorphic-pressed border border-ctu-gold/20">
                          <p className="text-[10px] font-bold text-ctu-gold uppercase tracking-widest mb-1">Target Subject</p>
                          <p className="font-bold text-foreground">Probability & Statistics</p>
                          <div className="mt-3 flex items-center justify-between text-[10px] font-bold">
                            <span className="text-foreground/40 uppercase">Difficulty</span>
                            <span className="text-ctu-maroon">Hard</span>
                          </div>
                          <Progress value={45} className="h-1.5 mt-2 bg-foreground/5" />
                        </div>
                      </div>
                    </Card>

                    <Card className="neumorphic-card border-none p-6 bg-ctu-maroon/5 border border-ctu-maroon/10">
                      <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                        <Info size={16} className="text-ctu-maroon" /> AI Insight
                      </h3>
                      <p className="text-xs text-foreground/60 leading-relaxed font-medium">
                        Based on your interest in "Manufacturing," we suggest focusing on <b className="text-foreground">IE 311: Production Systems</b> next semester.
                      </p>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="map" className="mt-0">
                <GlowCard className="p-6 md:p-10 min-h-[600px] flex flex-col items-center relative overflow-hidden" glowColor="blue">
                  <div className="absolute top-6 left-6 md:top-10 md:left-10 text-left z-20">
                    <h2 className="text-4xl font-display font-black mb-2 tracking-tight">Academic Matrix Map</h2>
                    <p className="text-base text-foreground/40 max-w-md font-medium tracking-tight">Visualizing the flow of Industrial Engineering subjects from fundamentals to specialization.</p>
                  </div>

                  <div className="w-full flex flex-col items-center gap-20 mt-32 relative z-10">
                    {/* Year Flow */}
                    <div className="flex flex-col items-center gap-16 w-full">
                       {/* Year 1 Row */}
                       <div className="flex flex-wrap justify-center gap-8">
                         {IE_SUBJECTS.filter(s => s.yearLevel === '1st' && (s.code.includes('IE') || s.code.includes('MATH'))).slice(0, 3).map(s => (
                           <button 
                             key={s.id} 
                             onClick={() => navigate(`/catalog/${s.id}`)}
                             className={cn(
                             "w-48 p-4 rounded-xl neumorphic-raised border-b-4 text-center group hover:scale-105 transition-all cursor-pointer",
                             progressMap[s.id]?.status === 'done' ? "border-green-500" : "border-ctu-gold/20"
                           )}>
                             <p className="text-[10px] font-bold text-foreground/40 uppercase mb-1">{s.code}</p>
                             <p className="text-xs font-bold text-foreground line-clamp-1">{s.name}</p>
                             {s.prerequisiteIds.length > 0 && <Clock size={12} className="mx-auto mt-2 text-ctu-gold animate-pulse" />}
                           </button>
                         ))}
                       </div>

                       <div className="w-1 h-12 bg-foreground/5 rounded-full" />

                       {/* Year 2 Row */}
                       <div className="flex flex-wrap justify-center gap-8">
                         {IE_SUBJECTS.filter(s => s.yearLevel === '2nd' && s.prerequisiteIds.length > 0).slice(0, 3).map(s => (
                           <button 
                             key={s.id} 
                             onClick={() => navigate(`/catalog/${s.id}`)}
                             className={cn(
                             "w-48 p-4 rounded-xl neumorphic-raised border-b-4 text-center group hover:scale-105 transition-all cursor-pointer relative",
                             progressMap[s.id]?.status === 'done' ? "border-green-500" : "border-ctu-gold/20"
                           )}>
                             <p className="text-[10px] font-bold text-foreground/40 uppercase mb-1">{s.code}</p>
                             <p className="text-xs font-bold text-foreground line-clamp-1">{s.name}</p>
                             <div className="mt-2 flex justify-center gap-1">
                               {s.prerequisiteIds.map(pid => (
                                 <Badge key={pid} className="text-[8px] p-0 px-1 bg-ctu-maroon text-white">{pid.split('-')[0]}</Badge>
                               ))}
                             </div>
                           </button>
                         ))}
                       </div>

                       <div className="w-1 h-12 bg-foreground/5 rounded-full" />

                       {/* Specializations */}
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-12 w-full max-w-4xl">
                         <div className="p-6 rounded-3xl neumorphic-pressed bg-ctu-maroon/5 border border-ctu-maroon/10 text-center">
                           <TrendingUp className="mx-auto mb-4 text-ctu-maroon" />
                           <h4 className="font-bold mb-2">Operations Research</h4>
                           <p className="text-[10px] text-foreground/40 font-medium">Optimization & Analytics Track</p>
                         </div>
                         <div className="p-6 rounded-3xl neumorphic-pressed bg-ctu-gold/5 border border-ctu-gold/10 text-center">
                           <Layers className="mx-auto mb-4 text-ctu-gold" />
                           <h4 className="font-bold mb-2">Production Systems</h4>
                           <p className="text-[10px] text-foreground/40 font-medium">Manufacturing & Logistics Track</p>
                         </div>
                         <div className="p-6 rounded-3xl neumorphic-pressed bg-foreground/5 border border-foreground/10 text-center">
                           <Users className="mx-auto mb-4 text-foreground/40" />
                           <h4 className="font-bold mb-2">Human Factors</h4>
                           <p className="text-[10px] text-foreground/40 font-medium">Ergonomics & Safety Track</p>
                         </div>
                       </div>
                    </div>
                  </div>

                  {/* Decorative Grid */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                    style={{ backgroundImage: 'radial-gradient(circle, #000 1px, transparent 1px)', backgroundSize: '30px 30px' }} 
                  />
                </GlowCard>
              </TabsContent>

              <TabsContent value="groups" className="mt-0 space-y-8 lg:space-y-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                  <div>
                    <h2 className="text-3xl sm:text-5xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-2">
                       Active Groups
                    </h2>
                    <p className="text-base md:text-xl text-foreground/40 font-medium mt-3 tracking-tight">Connect with peers and navigate the IE curriculum together.</p>
                  </div>
                  <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-72">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" size={18} />
                      <Input 
                        placeholder="Search groups or subjects..." 
                        className="pl-12 neumorphic-pressed border-none h-14 rounded-2xl text-sm font-medium focus:ring-ctu-gold/50"
                        value={groupSearchQuery}
                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                      />
                    </div>
                    <Dialog open={isNewGroupModalOpen} onOpenChange={setIsNewGroupModalOpen}>
                      <DialogTrigger 
                        render={
                          <Button className="rounded-2xl bg-ctu-maroon text-white font-black uppercase tracking-[0.2em] text-[11px] gap-3 h-14 px-8 shadow-xl shadow-ctu-maroon/20 hover:scale-105 active:scale-95 transition-all">
                            <Plus size={18} /> Create Group
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
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <GlowCard className="p-8 h-full flex flex-col justify-between group hover:border-ctu-gold/30 transition-all duration-300" glowColor="blue">
                        <div>
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                                 <Users size={20} />
                               </div>
                               <Badge className="bg-foreground/[0.03] text-foreground/40 border-none text-[10px] font-black uppercase tracking-widest">{group.subjectCode}</Badge>
                            </div>
                            <div className="flex -space-x-2.5">
                              {(group.members || []).slice(0, 4).map((mId: string, i: number) => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-foreground/5 flex items-center justify-center text-[10px] font-bold ring-2 ring-transparent group-hover:ring-blue-500/20 transition-all">
                                  {mId.slice(0, 2).toUpperCase()}
                                </div>
                              ))}
                              {(group.members || []).length > 4 && (
                                <div className="w-8 h-8 rounded-full border-2 border-background bg-ctu-gold flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                                  +{(group.members || []).length - 4}
                                </div>
                              )}
                            </div>
                          </div>
                          <h3 className="text-2xl font-bold text-foreground mb-4 leading-tight group-hover:text-blue-500 transition-colors uppercase tracking-tighter">{group.name}</h3>
                          <p className="text-sm font-medium text-foreground/40 leading-relaxed line-clamp-3 mb-6">{group.description || "No description provided for this squadron mission."}</p>
                        </div>
                        
                        <div className="mt-auto pt-6 border-t border-foreground/5 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-foreground/20 uppercase tracking-widest">Active Members</span>
                            <span className="text-sm font-bold text-foreground/60 tracking-tight">{(group.members || []).length} / 50</span>
                          </div>
                          <div className="flex gap-2">
                            {group.members?.includes(user.uid) ? (
                              <Button 
                                onClick={() => setActiveChatGroup(group)}
                                className="bg-blue-500 text-white rounded-xl h-11 px-5 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-600 transition-all"
                              >
                                Join Chat
                              </Button>
                            ) : (
                              <Button 
                                onClick={() => handleJoinGroup(group.id)}
                                className="neumorphic-raised hover:neumorphic-pressed text-ctu-gold rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest transition-all gap-2"
                              >
                                Join squad <ChevronRight size={14} />
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
              </TabsContent>

              <TabsContent value="qa" className="mt-0 space-y-8 lg:space-y-12">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                  <div>
                    <h2 className="text-3xl sm:text-5xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-2">
                       Q&A Forum
                    </h2>
                    <p className="text-base md:text-xl text-foreground/40 font-medium mt-3 tracking-tight">Rapid knowledge exchange with the IE community.</p>
                  </div>
                  <Dialog open={isAskQuestionModalOpen} onOpenChange={setIsAskQuestionModalOpen}>
                    <DialogTrigger 
                      render={
                        <Button className="h-14 px-8 rounded-2xl bg-ctu-maroon text-white font-black uppercase tracking-[0.2em] text-[11px] flex items-center gap-3 shadow-xl shadow-ctu-maroon/20 hover:scale-105 active:scale-95 transition-all">
                          <Plus size={18} /> Ask Question
                        </Button>
                      }
                    />
                    <DialogContent className="sm:max-w-[425px] neumorphic-card border-none p-8">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-black italic tracking-tight">TRANSMIT INQUIRY</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="q-title" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Question Headline</Label>
                          <Input id="q-title" value={newQuestion.title} onChange={e => setNewQuestion({...newQuestion, title: e.target.value})} className="neumorphic-pressed border-none h-12 rounded-xl" placeholder="What are you struggling with?" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="q-subject" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Target Topic</Label>
                          <Select onValueChange={(val: string) => setNewQuestion({...newQuestion, subjectTag: val})}>
                            <SelectTrigger className="neumorphic-pressed border-none h-12 rounded-xl">
                              <SelectValue placeholder="Select topic" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-none shadow-2xl">
                              {IE_SUBJECTS.map(s => <SelectItem key={s.id} value={s.code}>{s.code}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="q-content" className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/30">Full Context</Label>
                          <Textarea id="q-content" value={newQuestion.content} onChange={e => setNewQuestion({...newQuestion, content: e.target.value})} className="neumorphic-pressed border-none h-32 rounded-xl" placeholder="Provide context or specific examples..." />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAskQuestion} className="bg-ctu-maroon text-white font-black uppercase tracking-widest w-full h-14 rounded-2xl shadow-lg shadow-ctu-maroon/20">Post Question</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" size={18} />
                    <Input 
                      placeholder="Search questions or ask anything..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-background border-none neumorphic-pressed pl-12 pr-12 h-14 rounded-2xl focus:ring-ctu-gold text-foreground placeholder:text-foreground/30 font-medium"
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

                <div className="space-y-4">
                  {filteredQuestions.length > 0 ? filteredQuestions.map((q) => (
                    <Card 
                      key={q.id} 
                      onClick={() => setSelectedQuestion(q)}
                      className="neumorphic-card border-none p-6 hover:translate-x-1 transition-transform cursor-pointer"
                    >
                      <div className="flex gap-6">
                        <div className="flex flex-col items-center gap-1 shrink-0">
                          <Button 
                            variant="ghost" 
                            onClick={() => handleVote(q.id, q.votes || 0)}
                            className="p-1 h-auto hover:bg-transparent"
                          >
                            <TrendingUp size={16} className={cn("text-foreground/20 hover:text-ctu-gold transition-colors", (q.votes || 0) > 0 && "text-ctu-gold")} />
                          </Button>
                          <span className="font-bold text-sm">{q.votes || 0}</span>
                          <span className="text-[10px] font-bold text-foreground/20 uppercase">Votes</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-4 mb-2">
                             <div className="flex items-center gap-3">
                               <Badge className="bg-blue-500/10 text-blue-500 border-none text-[10px] font-bold">{q.subjectTag || 'General'}</Badge>
                               <span className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest">{q.createdAt ? (q.createdAt.toDate ? new Date(q.createdAt.toDate()).toLocaleDateString() : 'Just now') : 'Just now'}</span>
                               {q.isFlagged && (
                                 <Badge className="bg-red-500/10 text-red-500 border-none text-[10px] font-bold flex items-center gap-1">
                                   <ShieldAlert size={10} /> Flagged
                                 </Badge>
                               )}
                             </div>
                             {(user?.role === 'admin' || user?.uid !== q.userId) && (
                               <Button 
                                 variant="ghost" 
                                 size="sm"
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   handleReportQuestion(q);
                                 }}
                                 className="h-8 w-8 p-0 rounded-full text-foreground/20 hover:text-red-500 hover:bg-red-500/5 transition-colors"
                               >
                                 <Flag size={14} />
                               </Button>
                             )}
                          </div>
                          <h3 className="text-lg font-bold text-foreground mb-2 line-clamp-1">{q.title}</h3>
                          <p className="text-sm text-foreground/60 line-clamp-2 mb-4">{q.content}</p>
                          <div className="flex items-center gap-4 text-[10px] font-bold text-foreground/40 uppercase tracking-widest">
                            <span className="flex items-center gap-1.5"><MessageSquare size={12} /> {q.answerCount || 0} Answers</span>
                            <span className="flex items-center gap-1.5"><Users size={12} /> {q.userName || 'Anonymous'}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                      <HelpCircle size={48} className="mb-4" />
                      <p className="font-bold">No questions found matching your search.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="flashcards" className="mt-0 space-y-8 lg:space-y-12">
                {!selectedDeck ? (
                  <div className="space-y-8 lg:space-y-12">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                      <div>
                        <h2 className="text-3xl sm:text-5xl md:text-7xl frosted-header font-black tracking-tighter leading-[0.9] py-2">
                           Flash Decks
                        </h2>
                        <p className="text-base md:text-xl text-foreground/40 font-medium mt-3 tracking-tight">Accelerate mastery through strategic retention cycles.</p>
                      </div>
                      <div className="flex flex-wrap gap-3 w-full md:w-auto">
                        <Dialog open={isNewDeckModalOpen} onOpenChange={setIsNewDeckModalOpen}>
                          <DialogTrigger 
                            render={
                              <Button className="h-14 px-8 rounded-2xl bg-ctu-maroon text-white font-black uppercase tracking-[0.2em] text-[11px] flex items-center gap-3 shadow-xl shadow-ctu-maroon/20 hover:scale-105 active:scale-95 transition-all">
                                <Plus size={18} /> New Deck
                              </Button>
                            }
                          />
                          <DialogContent className="sm:max-w-[425px] neumorphic-card border-none p-8">
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

                  <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20" size={18} />
                      <Input 
                        placeholder="Search decks..." 
                        className="pl-12 neumorphic-pressed border-none h-14 rounded-2xl text-sm font-medium focus:ring-blue-500/30"
                        value={deckSearchQuery}
                        onChange={(e) => setDeckSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select value={deckSubjectFilter} onValueChange={setDeckSubjectFilter}>
                      <SelectTrigger className="w-[180px] neumorphic-pressed border-none h-14 rounded-2xl text-[10px] font-black uppercase tracking-widest">
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

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <AnimatePresence mode="popLayout">
                        {filteredDecks.length > 0 ? filteredDecks.map((deck, i) => (
                          <motion.div
                            key={deck.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <GlowCard 
                              className="p-6 text-center cursor-pointer hover:scale-[1.02] transition-all h-full" 
                              glowColor={deck.color as any || 'maroon'}
                              onClick={() => setSelectedDeck(deck)}
                            >
                              <div className={cn(
                                "w-16 h-16 rounded-2xl neumorphic-pressed flex items-center justify-center mx-auto mb-6",
                                deck.color === 'maroon' ? 'text-ctu-maroon' : 
                                deck.color === 'gold' ? 'text-ctu-gold' :
                                deck.color === 'blue' ? 'text-blue-500' : 'text-green-500'
                              )}>
                                <Layers size={32} />
                              </div>
                              <h3 className="font-bold text-foreground mb-1 line-clamp-1">{deck.name}</h3>
                              {deck.subjectId && (
                                <Badge variant="secondary" className="mb-2 text-[10px] h-4 font-bold bg-foreground/5 text-foreground/40">{deck.subjectId}</Badge>
                              )}
                              <p className="text-xs text-foreground/40 font-bold uppercase tracking-widest">{deck.cardCount || 0} Cards</p>
                              <div className="mt-6 flex gap-2">
                                <Button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startFlashcardSession(deck);
                                  }}
                                  variant="ghost" 
                                  className="flex-1 rounded-xl text-xs font-bold border border-foreground/5 shadow-sm"
                                >
                                  Study
                                </Button>
                                <Button 
                                  className="px-3 rounded-xl border border-foreground/5"
                                  variant="ghost"
                                >
                                  <ChevronRight size={14} />
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
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-6">
                          <Button 
                            variant="ghost" 
                            onClick={() => {
                              setSelectedDeck(null);
                              setCardSearchQuery('');
                            }}
                            className="p-3 h-auto rounded-xl hover:bg-foreground/5 neumorphic-raised"
                          >
                             <ChevronLeft size={24} />
                          </Button>
                          <div>
                            <h2 className="text-4xl font-display font-black tracking-tight">{selectedDeck.name}</h2>
                            <p className="text-lg text-foreground/40 font-medium mt-1 tracking-tight">{selectedDeck.description || 'No description provided.'}</p>
                          </div>
                        </div>
                      
                      <div className="flex flex-wrap gap-4 items-center">
                        <div className="relative w-full md:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30" size={16} />
                          <Input 
                            placeholder="Search cards..." 
                            className="pl-10 neumorphic-pressed border-none h-10 rounded-xl text-sm"
                            value={cardSearchQuery}
                            onChange={(e) => setCardSearchQuery(e.target.value)}
                          />
                        </div>

                        <div className="flex gap-4 neumorphic-card border-none px-4 py-2 items-center">
                          <div className="text-center border-r border-foreground/5 pr-4">
                            <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest leading-tight">Total</p>
                            <p className="font-bold leading-tight">{deckCards.length}</p>
                          </div>
                          <div className="text-center border-r border-foreground/5 pr-4">
                            <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest leading-tight">Learned</p>
                            <p className="font-bold leading-tight">{deckCards.filter(c => c.status === 'known').length}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] font-bold text-ctu-gold uppercase tracking-widest leading-tight">Due</p>
                            <p className="font-bold leading-tight">
                              {deckCards.filter(c => !c.nextReview || new Date(c.nextReview) <= new Date()).length}
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Dialog open={isAddCardModalOpen} onOpenChange={setIsAddCardModalOpen}>
                            <DialogTrigger 
                              render={
                                <Button variant="outline" className="rounded-xl font-bold gap-2 neumorphic-raised border-none h-10 whitespace-nowrap">
                                  <Plus size={16} /> Add Card
                                </Button>
                              }
                            />
                            <DialogContent className="sm:max-w-[425px] neumorphic-card border-none">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-bold">Add Flashcard</DialogTitle>
                              </DialogHeader>
                              <div className="grid gap-6 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="card-front" className="text-xs font-bold uppercase tracking-wider text-foreground/40">Front Content</Label>
                                  <Textarea id="card-front" value={newCard.front} onChange={e => setNewCard({...newCard, front: e.target.value})} className="neumorphic-pressed border-none" placeholder="Question or term..." />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="card-back" className="text-xs font-bold uppercase tracking-wider text-foreground/40">Back Content</Label>
                                  <Textarea id="card-back" value={newCard.back} onChange={e => setNewCard({...newCard, back: e.target.value})} className="neumorphic-pressed border-none" placeholder="Answer or definition..." />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={handleAddCard} className="bg-ctu-gold text-white font-bold w-full rounded-xl">Add Card</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button 
                            onClick={() => startFlashcardSession(selectedDeck)}
                            className="rounded-xl bg-ctu-gold text-white font-bold gap-2 px-6 h-10 whitespace-nowrap shadow-lg shadow-ctu-gold/20"
                          >
                            Study Now
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
                            <Card className="neumorphic-card border-none p-6 relative group overflow-hidden h-full group">
                              <div className="flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                  <Badge className={cn(
                                    "text-[8px] font-bold uppercase",
                                    card.status === 'known' ? "bg-green-500 text-white" : "bg-ctu-gold/20 text-ctu-gold"
                                  )}>
                                    {card.status || 'learning'}
                                  </Badge>
                                  {card.nextReview && (
                                    <span className="text-[10px] font-bold text-foreground/30">
                                      Due: {new Date(card.nextReview).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mb-1">Front</p>
                                  <p className="font-bold text-base leading-relaxed">{card.front}</p>
                                </div>
                                <div className="pt-4 border-t border-foreground/5">
                                  <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mb-1">Back</p>
                                  <p className="text-sm font-medium text-foreground/70">{card.back}</p>
                                </div>
                                {card.status !== 'known' && (
                                  <Button 
                                    onClick={() => handleMarkCardKnown(card.id)}
                                    variant="ghost" 
                                    className="mt-2 text-xs font-bold text-green-500 hover:text-green-600 p-0 h-auto self-start group-hover:translate-x-1 transition-transform"
                                  >
                                    Mark as Learned →
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
              </TabsContent>
              
              <TabsContent value="quizzes" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <GlowCard className="p-8" glowColor="orange">
                    <div className="flex items-start justify-between mb-8 pb-6 border-b border-foreground/5">
                      <div>
                        <h2 className="text-4xl font-display font-black tracking-tight text-foreground">Featured AI Quiz</h2>
                        <p className="text-base text-foreground/40 mt-2 font-medium">Challenge yourself with this week's topics.</p>
                      </div>
                      <Award className="text-ctu-gold" size={40} />
                    </div>
                    
                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-center p-4 rounded-xl neumorphic-pressed">
                        <span className="text-sm font-bold">System Engineering Quiz</span>
                        <Badge className="bg-green-500/10 text-green-500 border-none">Ready</Badge>
                      </div>
                      <div className="flex justify-between items-center p-4 rounded-xl neumorphic-pressed opacity-50">
                        <span className="text-sm font-bold">Optimization Techniques</span>
                        <Badge className="bg-ctu-gold/10 text-ctu-gold border-none">Coming Soon</Badge>
                      </div>
                    </div>
                    
                    <Button 
                      onClick={() => startQuizSession("Systems Engineering")}
                      disabled={isSessionLoading}
                      className="w-full h-14 bg-ctu-gold text-white font-bold rounded-2xl text-lg hover:scale-[1.02] transition-all shadow-xl"
                    >
                      {isSessionLoading ? "Generating AI Quiz..." : "Start Quiz"}
                    </Button>
                  </GlowCard>
                  
                  <div className="grid grid-cols-1 gap-6">
                    <Card className="neumorphic-card border-none p-6">
                      <h3 className="font-bold text-foreground mb-4">Your Achievements</h3>
                      <div className="grid grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex flex-col items-center gap-2">
                            <div className="w-16 h-16 rounded-full neumorphic-pressed flex items-center justify-center text-ctu-gold">
                              <Award size={32} />
                            </div>
                            <span className="text-[10px] font-bold text-foreground/40 uppercase text-center">Top Scorers</span>
                          </div>
                        ))}
                      </div>
                    </Card>
                    
                    <Card className="neumorphic-card border-none p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-foreground">Recent Scores</h3>
                        <TrendingUp size={16} className="text-green-500" />
                      </div>
                      <div className="space-y-3">
                         <div className="flex justify-between items-center text-xs">
                           <span className="font-medium">Work Measurement</span>
                           <span className="font-bold text-green-500">92%</span>
                         </div>
                         <Progress value={92} className="h-1 bg-foreground/5" />
                         <div className="flex justify-between items-center text-xs">
                           <span className="font-medium">Industrial Safety</span>
                           <span className="font-bold text-ctu-gold">78%</span>
                         </div>
                         <Progress value={78} className="h-1 bg-foreground/5" />
                      </div>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="notebooks" className="mt-0">
                {activeNotebookId ? (
                  <NotebookWorkspace 
                    notebookId={activeNotebookId} 
                    onBack={() => setActiveNotebookId(null)} 
                  />
                ) : (
                  <NotebookList onSelect={(id) => setActiveNotebookId(id)} />
                )}
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>

        {/* Group Chat Modal */}
        <Dialog open={!!activeChatGroup} onOpenChange={(open) => !open && setActiveChatGroup(null)}>
          <DialogContent className="max-w-md bg-background rounded-3xl border-none p-0 overflow-hidden flex flex-col h-[600px]">
            <DialogHeader className="p-6 border-b border-foreground/5 bg-background/50 backdrop-blur-md">
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
          <DialogContent className="max-w-2xl bg-background rounded-3xl border-none p-8">
            <DialogHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-500/10 text-blue-500 border-none text-[10px] font-bold">{selectedQuestion?.subjectTag || 'General'}</Badge>
                  <span className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest">{selectedQuestion?.userName}</span>
                  {selectedQuestion?.isFlagged && (
                    <Badge className="bg-red-500/10 text-red-500 border-none text-[10px] font-bold flex items-center gap-1">
                      <ShieldAlert size={10} /> Flagged by Moderation
                    </Badge>
                  )}
                </div>
                
                {user?.role === 'admin' && (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleFlagQuestion(selectedQuestion)}
                      className={cn(
                        "h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest border-none transition-all",
                        selectedQuestion?.isFlagged 
                          ? "bg-red-500 text-white shadow-lg shadow-red-500/20" 
                          : "neumorphic-raised text-red-500 hover:bg-red-500/5"
                      )}
                    >
                      {selectedQuestion?.isFlagged ? 'Unflag' : 'Flag'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeleteQuestion(selectedQuestion.id)}
                      className="h-8 w-8 p-0 rounded-lg text-foreground/20 hover:text-red-500 hover:bg-red-500/5 transition-colors"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>
              <DialogTitle className="text-2xl font-bold">{selectedQuestion?.title}</DialogTitle>
            </DialogHeader>
            <div className="py-6 space-y-8">
              <div className="p-6 rounded-2xl neumorphic-pressed relative group">
                <p className="text-foreground/80 leading-relaxed font-medium">{selectedQuestion?.content}</p>
                {selectedQuestion?.reportCount > 0 && user?.role === 'admin' && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-red-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                    <AlertTriangle size={8} /> {selectedQuestion.reportCount} Reports
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Responses ({selectedQuestion?.answerCount || 0})</h4>
                {selectedQuestion?.latestAnswer ? (
                  <div className={cn(
                    "p-5 rounded-2xl transition-all relative group",
                    selectedQuestion.latestAnswer.isFlagged ? "bg-red-500/5 border border-red-500/10" : "neumorphic-pressed"
                  )}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-ctu-gold uppercase tracking-widest">{selectedQuestion.latestAnswer.userName}</span>
                        {selectedQuestion.latestAnswer.isFlagged && (
                          <Badge className="bg-red-500/10 text-red-500 border-none text-[8px] font-bold py-0 h-4">FLAGGED</Badge>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        {user?.role === 'admin' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleFlagAnswer(selectedQuestion)}
                              className="h-6 w-6 p-0 rounded-md text-foreground/20 hover:text-red-500 transition-colors"
                            >
                              <Flag size={12} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleDeleteAnswer(selectedQuestion)}
                              className="h-6 w-6 p-0 rounded-md text-foreground/20 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={12} />
                            </Button>
                          </>
                        )}
                        {!user?.role || user.role !== 'admin' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-6 w-6 p-0 rounded-md text-foreground/20 hover:text-red-500 transition-colors"
                            onClick={() => toast.success("Answer reported.")}
                          >
                            <Flag size={12} />
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className={cn(
                      "text-sm font-medium",
                      selectedQuestion.latestAnswer.isFlagged ? "text-foreground/40 blur-[1px] hover:blur-0 transition-all cursor-help" : "text-foreground/80"
                    )} title={selectedQuestion.latestAnswer.isFlagged ? "This content has been flagged" : ""}>
                      {selectedQuestion.latestAnswer.content}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-foreground/20 font-bold uppercase italic tracking-widest text-center py-6">No answers yet. Be the first to help!</p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-bold uppercase tracking-widest">Your Answer</Label>
                <Textarea 
                  placeholder="Share your explanation or advice..."
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  className="bg-background border-none neumorphic-pressed rounded-xl resize-none h-24"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                onClick={() => handlePostAnswer(selectedQuestion.id)}
                disabled={isAnswering}
                className="bg-ctu-maroon text-white font-bold w-full rounded-xl py-6"
              >
                {isAnswering ? "Posting..." : "Post Answer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* AI Advisor Chat Sidebar/Modal */}
        <Dialog open={isAdvisorChatOpen} onOpenChange={setIsAdvisorChatOpen}>
          <DialogContent className="max-w-md h-[80vh] flex flex-col bg-background rounded-3xl border-none p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b border-foreground/5 bg-background z-10 shrink-0">
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
              <div className="flex flex-col gap-4">
                {advisorChat.length === 0 && (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-ctu-gold/5 flex items-center justify-center mx-auto text-ctu-gold animate-bounce">
                      <Sparkles size={32} />
                    </div>
                    <p className="text-sm text-foreground/40 font-medium">Ask me about your roadmap, elective choices,<br/>or specialization tracks!</p>
                  </div>
                )}
                {advisorChat.map((msg, i) => (
                  <div key={i} className={cn(
                    "flex",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}>
                    <div className={cn(
                      "max-w-[85%] p-4 rounded-2xl text-sm font-medium",
                      msg.role === 'user'
                        ? "bg-ctu-maroon text-white rounded-tr-none"
                        : "neumorphic-raised text-foreground rounded-tl-none"
                    )}>
                      {msg.role === 'ai' ? (
                        <div className="prose prose-sm max-w-none prose-invert text-foreground/80">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : msg.content}
                    </div>
                  </div>
                ))}
                {isAdvisorLoading && (
                  <div className="flex justify-start">
                    <div className="neumorphic-raised text-foreground rounded-2xl rounded-tl-none p-4">
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
