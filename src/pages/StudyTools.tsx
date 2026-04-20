import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  X
} from 'lucide-react';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User, StudyGroup, StudyPost, Quiz, Subject, Progress as ProgressType } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { generateStudyPlan, generateQuiz, askQuestion } from '@/src/lib/gemini';
import { db } from '@/src/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp, updateDoc, doc, arrayUnion, where, getDocs, getDoc } from 'firebase/firestore';
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
    const saved = localStorage.getItem('ie_matrix_roadmap');
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
  const [newQuestion, setNewQuestion] = useState({ title: '', content: '', subjectTag: '' });
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  
  // Chat State
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
    });

    // Real-time study groups
    const g = query(collection(db, 'studyGroups'), limit(12));
    const unsubscribeGroups = onSnapshot(g, (snapshot) => {
      const gs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudyGroups(gs);
    });

    return () => {
      unsubscribeQA();
      unsubscribeGroups();
    };
  }, [user, authLoading, navigate]);

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
    });

    return () => unsubscribe();
  }, [activeChatGroup]);

  const handleGenerateRoadmap = async () => {
    setIsGenerating(true);
    const progress = localStorage.getItem('ie_matrix_progress_v2');
    const progressMap = progress ? JSON.parse(progress) : {};
    
    try {
      const plan = await generateStudyPlan(progressMap, IE_SUBJECTS);
      setRoadmap(plan);
      localStorage.setItem('ie_matrix_roadmap', JSON.stringify(plan));
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
    setAdvisorChat(prev => [...prev, userMsg]);
    setAdvisorInput('');
    setIsAdvisorLoading(true);

    try {
      const response = await askQuestion(advisorInput, JSON.stringify(roadmap));
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

  const startFlashcardSession = (deck: any) => {
    // Generate mock cards for demo
    const mockCards = [
      { front: "What is Pareto Analysis?", back: "A technique used for decision-making based on the 80/20 rule." },
      { front: "Define 5S", back: "Sort, Set in order, Shine, Standardize, Sustain." },
      { front: "Six Sigma Goal", back: "To improve quality by identifying and removing causes of defects." }
    ];
    setActiveSession({ type: 'flashcards', data: mockCards });
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
            <div className="space-y-12">
              <div className="text-center">
                <Badge className="bg-ctu-gold text-white font-bold mb-4">FLASHCARD {currentStep + 1}/{activeSession.data.length}</Badge>
                <div className="h-2 bg-foreground/5 rounded-full overflow-hidden w-full">
                  <div className="h-full bg-ctu-gold transition-all duration-300" style={{ width: `${((currentStep + 1) / activeSession.data.length) * 100}%` }} />
                </div>
              </div>

              <motion.div 
                key={currentStep + (isFlipped ? '-flipped' : '-front')}
                initial={{ rotateY: isFlipped ? -90 : 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                className="perspective-1000 cursor-pointer"
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <GlowCard className="aspect-video flex items-center justify-center p-12 text-center" glowColor="orange">
                  <h2 className="text-2xl lg:text-3xl font-bold leading-tight">
                    {isFlipped ? activeSession.data[currentStep].back : activeSession.data[currentStep].front}
                  </h2>
                </GlowCard>
              </motion.div>

              <div className="flex justify-between gap-6">
                <Button 
                  className="flex-1 h-14 rounded-2xl neumorphic-raised text-foreground font-bold"
                  onClick={() => {
                    if (currentStep > 0) {
                      setCurrentStep(currentStep - 1);
                      setIsFlipped(false);
                    }
                  }}
                  disabled={currentStep === 0}
                >
                  Previous
                </Button>
                <Button 
                  className="flex-1 h-14 rounded-2xl bg-ctu-gold text-white font-bold shadow-lg"
                  onClick={() => {
                    if (currentStep < activeSession.data.length - 1) {
                      setCurrentStep(currentStep + 1);
                      setIsFlipped(false);
                    } else {
                      setActiveSession(null);
                      toast.success("Deck completed!");
                    }
                  }}
                >
                  {currentStep === activeSession.data.length - 1 ? "Finish" : "Next Card"}
                </Button>
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
      
      <main className="flex-1 p-6 lg:p-10 pb-32 lg:pb-10 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 lg:mb-12">
          <div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl frosted-header font-black tracking-tight flex items-center gap-3">
              Study Hub <Sparkles className="text-ctu-gold" size={28} />
            </h1>
            <p className="text-foreground/60 mt-2 text-xs md:text-sm font-medium tracking-wide">Elevate your learning with AI guidance and community support.</p>
          </div>
          
          <div className="flex bg-background p-1.5 rounded-2xl neumorphic-raised w-fit">
            <Dialog open={isNewGroupModalOpen} onOpenChange={setIsNewGroupModalOpen}>
              <DialogTrigger 
                render={
                  <Button variant="ghost" className="rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest gap-2 h-10 md:h-12 px-4 md:px-6" />
                }
              >
                <Plus size={16} /> New Group
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] neumorphic-card border-none">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold">Create Study Group</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-name" className="text-xs font-bold uppercase tracking-wider text-foreground/40">Group Name</Label>
                    <Input id="group-name" value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})} className="neumorphic-pressed border-none" placeholder="e.g., OR-1 Mastermind" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject-code" className="text-xs font-bold uppercase tracking-wider text-foreground/40">Subject</Label>
                    <Select onValueChange={(val: string) => setNewGroup({...newGroup, subjectCode: val})}>
                      <SelectTrigger className="neumorphic-pressed border-none">
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {IE_SUBJECTS.map(s => <SelectItem key={s.id} value={s.code}>{s.code} - {s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="group-desc" className="text-xs font-bold uppercase tracking-wider text-foreground/40">Description</Label>
                    <Textarea id="group-desc" value={newGroup.description} onChange={e => setNewGroup({...newGroup, description: e.target.value})} className="neumorphic-pressed border-none" placeholder="What's this group about?" />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateGroup} className="bg-ctu-gold text-white font-bold w-full rounded-xl">Create Group</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                          Smart Study Roadmap <TrendingUp className="text-ctu-gold" size={20} />
                        </h2>
                        <p className="text-sm text-foreground/60 mt-1">AI-generated sequence based on your progress and subject difficulty.</p>
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

                    <div className="space-y-6">
                      {roadmap.length > 0 ? roadmap.map((step, idx) => (
                        <div key={idx} className="flex gap-6 relative">
                          {idx < roadmap.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-foreground/5" />}
                          <div className={cn(
                            "w-10 h-10 rounded-full neumorphic-pressed flex items-center justify-center font-bold shrink-0",
                            step.difficulty === 'hard' ? "text-ctu-maroon" : "text-ctu-gold"
                          )}>
                            {idx + 1}
                          </div>
                          <div className="flex-1 pb-6">
                            <h3 className="font-bold text-foreground">{step.title}</h3>
                            <p className="text-xs text-foreground/40 mt-1">{step.description}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {step.subjects?.map((sCode: string) => (
                                <Badge key={sCode} variant="secondary" className="bg-background text-[10px] font-bold">{sCode}</Badge>
                              ))}
                              <Badge variant="outline" className={cn(
                                "text-[10px] font-bold border-none",
                                step.difficulty === 'hard' ? "bg-ctu-maroon/10 text-ctu-maroon" : "bg-green-500/10 text-green-500"
                              )}>
                                {step.difficulty}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                          <BrainCircuit size={48} className="text-ctu-gold animate-pulse" />
                          <p className="text-sm font-medium">Click generate to receive an AI-powered study roadmap<br/>centered around your IE matrix progress.</p>
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
                    <h2 className="text-2xl md:text-3xl font-black mb-2">Academic Matrix Map</h2>
                    <p className="text-xs md:text-sm text-foreground/40 max-w-md font-medium">Visualizing the flow of Industrial Engineering subjects from fundamentals to specialization.</p>
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

              <TabsContent value="groups" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {studyGroups.length > 0 ? studyGroups.map((group, idx) => (
                    <motion.div
                      key={group.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                    >
                      <GlowCard className="p-6 h-full flex flex-col justify-between" glowColor="blue">
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <Badge variant="outline" className="border-ctu-gold text-ctu-gold text-[10px] font-bold">{group.subjectCode}</Badge>
                            <div className="flex -space-x-2">
                              {(group.members || []).slice(0, 3).map((mId: string, i: number) => (
                                <div key={i} className="w-6 h-6 rounded-full border-2 border-background bg-foreground/10 flex items-center justify-center text-[8px] font-bold">
                                  {mId.slice(0, 2).toUpperCase()}
                                </div>
                              ))}
                              {(group.members || []).length > 3 && (
                                <div className="w-6 h-6 rounded-full border-2 border-background bg-ctu-gold flex items-center justify-center text-[8px] font-bold text-white">
                                  +{(group.members || []).length - 3}
                                </div>
                              )}
                            </div>
                          </div>
                          <h3 className="text-lg font-bold text-foreground mb-2">{group.name}</h3>
                          <p className="text-xs text-foreground/40 line-clamp-2">{group.description}</p>
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-foreground/5 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-widest">{(group.members || []).length} Members</span>
                          <div className="flex gap-2">
                            {group.members?.includes(user.uid) && (
                              <Button 
                                onClick={() => setActiveChatGroup(group)}
                                variant="ghost"
                                className="text-xs font-bold text-ctu-maroon h-auto p-0 hover:bg-transparent"
                              >
                                Message
                              </Button>
                            )}
                            <Button 
                              onClick={() => handleJoinGroup(group.id)}
                              variant="ghost" 
                              className="text-xs font-bold text-ctu-gold gap-2 p-0 h-auto hover:bg-transparent"
                            >
                              {group.members?.includes(user.uid) ? 'View Room' : 'Join Room'} <ChevronRight size={14} />
                            </Button>
                          </div>
                        </div>
                      </GlowCard>
                    </motion.div>
                  )) : (
                    IE_SUBJECTS.slice(0, 6).map((sub, idx) => (
                      <GlowCard key={idx} className="p-6 opacity-40 grayscale" glowColor="blue">
                         <div className="h-40 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-center">
                           Connecting to Peer Network...
                         </div>
                      </GlowCard>
                    ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="qa" className="mt-0 space-y-6">
                <div className="flex gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
                    <Input 
                      placeholder="Search questions or ask anything..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="bg-background border-none neumorphic-pressed pl-12 pr-12 h-14 rounded-2xl focus:ring-ctu-gold text-foreground placeholder:text-foreground/30"
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
                  <Dialog open={isAskQuestionModalOpen} onOpenChange={setIsAskQuestionModalOpen}>
                    <DialogTrigger 
                      render={
                        <Button className="h-14 px-8 rounded-2xl bg-ctu-maroon text-white font-bold" />
                      }
                    >
                      Ask Question
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px] neumorphic-card border-none">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Post a Question</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-6 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="q-title" className="text-xs font-bold uppercase tracking-wider text-foreground/40">Question Title</Label>
                          <Input id="q-title" value={newQuestion.title} onChange={e => setNewQuestion({...newQuestion, title: e.target.value})} className="neumorphic-pressed border-none" placeholder="What are you struggling with?" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="q-subject" className="text-xs font-bold uppercase tracking-wider text-foreground/40">Topic / Subject</Label>
                          <Select onValueChange={(val: string) => setNewQuestion({...newQuestion, subjectTag: val})}>
                            <SelectTrigger className="neumorphic-pressed border-none">
                              <SelectValue placeholder="Select topic" />
                            </SelectTrigger>
                            <SelectContent>
                              {IE_SUBJECTS.map(s => <SelectItem key={s.id} value={s.code}>{s.code}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="q-content" className="text-xs font-bold uppercase tracking-wider text-foreground/40">Details</Label>
                          <Textarea id="q-content" value={newQuestion.content} onChange={e => setNewQuestion({...newQuestion, content: e.target.value})} className="neumorphic-pressed border-none h-32" placeholder="Provide context or specific examples..." />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAskQuestion} className="bg-ctu-maroon text-white font-bold w-full rounded-xl">Post Question</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
                          <div className="flex items-center gap-3 mb-2">
                             <Badge className="bg-blue-500/10 text-blue-500 border-none text-[10px] font-bold">{q.subjectTag || 'General'}</Badge>
                             <span className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest">{q.createdAt ? new Date(q.createdAt.toDate()).toLocaleDateString() : 'Just now'}</span>
                          </div>
                          <h3 className="text-lg font-bold text-foreground mb-2">{q.title}</h3>
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

              <TabsContent value="flashcards" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[
                    { title: 'IE Terminology', cards: 45, color: 'maroon' },
                    { title: 'Lean Manufacturing', cards: 28, color: 'gold' },
                    { title: 'Work Measurement', cards: 15, color: 'blue' },
                    { title: 'Ergonomics Basics', cards: 32, color: 'green' }
                  ].map((deck, i) => (
                    <GlowCard key={i} className="p-6 text-center cursor-pointer hover:scale-[1.02] transition-all" glowColor={deck.color as any}>
                      <div className={cn(
                        "w-16 h-16 rounded-2xl neumorphic-pressed flex items-center justify-center mx-auto mb-6",
                        deck.color === 'maroon' ? 'text-ctu-maroon' : 'text-ctu-gold'
                      )}>
                        <Layers size={32} />
                      </div>
                      <h3 className="font-bold text-foreground mb-1">{deck.title}</h3>
                      <p className="text-xs text-foreground/40 font-bold uppercase tracking-widest">{deck.cards} Cards</p>
                      <Button 
                        onClick={() => startFlashcardSession(deck)}
                        variant="ghost" 
                        className="mt-6 w-full rounded-xl text-xs font-bold border border-foreground/5 shadow-sm"
                      >
                        Study Now
                      </Button>
                    </GlowCard>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="quizzes" className="mt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <GlowCard className="p-8" glowColor="orange">
                    <div className="flex items-start justify-between mb-8">
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Weekly Subject Quiz</h2>
                        <p className="text-sm text-foreground/60 mt-1">Challenge yourself with this week's featured topics.</p>
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
              <div className="flex items-center gap-3 mb-2">
                <Badge className="bg-blue-500/10 text-blue-500 border-none text-[10px] font-bold">{selectedQuestion?.subjectTag || 'General'}</Badge>
                <span className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest">{selectedQuestion?.userName}</span>
              </div>
              <DialogTitle className="text-2xl font-bold">{selectedQuestion?.title}</DialogTitle>
            </DialogHeader>
            <div className="py-6 space-y-8">
              <p className="text-foreground/70 leading-relaxed font-medium">{selectedQuestion?.content}</p>
              
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Responses ({selectedQuestion?.answerCount || 0})</h4>
                {selectedQuestion?.latestAnswer ? (
                  <div className="p-5 rounded-2xl neumorphic-pressed">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-ctu-gold uppercase tracking-widest">{selectedQuestion.latestAnswer.userName}</span>
                      <span className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest">Recent</span>
                    </div>
                    <p className="text-sm font-medium">{selectedQuestion.latestAnswer.content}</p>
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
            
            <ScrollArea className="flex-1 p-6 space-y-6">
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
                  <div key={i} className={cn(
                    "max-w-[85%] p-4 rounded-2xl text-sm font-medium",
                    msg.role === 'user' 
                      ? "bg-ctu-maroon text-white self-end rounded-tr-none" 
                      : "neumorphic-raised text-foreground self-start rounded-tl-none"
                  )}>
                    {msg.content}
                  </div>
                ))}
                {isAdvisorLoading && (
                  <div className="neumorphic-raised text-foreground self-start rounded-2xl rounded-tl-none p-4 max-w-[85%]">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-ctu-gold rounded-full animate-bounce" />
                      <div className="w-1.5 h-1.5 bg-ctu-gold rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1.5 h-1.5 bg-ctu-gold rounded-full animate-bounce [animation-delay:0.4s]" />
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
