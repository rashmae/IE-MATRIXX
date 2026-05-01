
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getGeminiClient } from '@/src/lib/gemini';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiquidButton } from '@/components/ui/liquid-glass';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';

const DEFAULT_FILES = [
  { id: '1v4kEQcZ33Oi_6bE4cvNpaXlAD5k3nt_o', name: 'BES-CFP: Computer Fundamentals and Programming' },
  { id: '1mPUieL99B92iZ76DDx5mwayYVxeT-Zec', name: 'IE-AC 111: Principles of Economics' },
  { id: '1NCi8MtAMVkh-6j2MvSTPTtuFWSubCmTU', name: 'IE-IPC 111: Introduction to Engineering' },
  { id: '1YZKpxqrqnEISOpFbB_l9_W1eZpwDmj3E', name: 'IE-TECH 111: Pneumatics and PLC' },
  { id: '1iGCJEYbMfTAIscy93Ltqnm4extEVqc1q', name: 'EPHYS: Physics for Engineers (Lec)' },
  { id: '1PudL-f85oQ4xo0lGofYyowBykt3M7Keh', name: 'EPHYSL: Physics for Engineers (Lab)' },
  { id: '1_kkGmS599dIlNzNSeu1olykO0iyx-RT4', name: 'IE-PC 212: Industrial Materials and Processes' },
  { id: '1FpEBciGCxeLixdjkWdPb_oSOTBsnJuhp', name: 'IE-PC 212L: Industrial Materials (Lab)' }
];

interface IngestionResult {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'success' | 'error' | 'skipped';
  message?: string;
  subjectCode?: string;
  data?: any;
}

export default function SyllabusIngestion() {
  const { profile, loading: authLoading } = useAuth();
  const [results, setResults] = useState<IngestionResult[]>(
    DEFAULT_FILES.map(f => ({ id: f.id, name: f.name, status: 'pending' }))
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSyllabusFiles = async () => {
      setIsLoadingFiles(true);
      try {
        const subjectsRef = collection(db, 'subjects');
        const snapshot = await getDocs(subjectsRef);
        
        const filesFromFirestore = snapshot.docs
          .map(doc => {
            const data = doc.data();
            const url = data.syllabusUrl || data.syllabusURL || '';
            if (!url) return null;

            // Extract ID from https://drive.google.com/file/d/FILE_ID/preview
            const match = url.match(/\/d\/([^\/]+)/);
            const fileId = match ? match[1] : (url.includes('id=') ? url.split('id=')[1].split('&')[0] : null);
            
            if (!fileId) return null;

            return {
              id: fileId,
              name: `${data.code}: ${data.name}`,
              status: (data.topics && data.topics.length > 0) ? 'success' : 'pending',
              subjectCode: data.code
            } as IngestionResult;
          })
          .filter((f): f is IngestionResult => f !== null);

        // Dedup by ID
        const uniqueFiles = Array.from(new Map(
          [
            ...DEFAULT_FILES.map(f => ({ id: f.id, name: f.name, status: 'pending' as const })), 
            ...filesFromFirestore
          ].map(item => [item.id, item as IngestionResult])
        ).values());

        if (uniqueFiles.length > 0) {
          setResults(uniqueFiles);
        }
      } catch (err) {
        console.error("Error fetching syllabus files:", err);
        toast.error("Failed to load syllabus links from database");
      } finally {
        setIsLoadingFiles(false);
      }
    };

    if (!authLoading) {
      if (!profile || profile.role !== 'admin') {
        toast.error('Admin access required');
        navigate('/dashboard');
      } else {
        fetchSyllabusFiles();
      }
    }
  }, [profile, authLoading, navigate]);

  const updateResult = (id: string, updates: Partial<IngestionResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const processFile = async (fileId: string) => {
    updateResult(fileId, { status: 'processing', message: 'Downloading PDF...' });
    
    try {
      // 1. Download PDF (via local proxy to bypass CORS)
      const downloadUrl = `/api/proxy-drive?id=${fileId}`;
      const res = await fetch(downloadUrl);
      if (!res.ok) throw new Error('Failed to download PDF');
      const blob = await res.blob();
      
      // 2. Base64 Encode
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(blob);
      const base64Data = await base64Promise;

      updateResult(fileId, { message: 'Extracting data with AI...' });

      // 3. Extract with Gemini
      const ai = getGeminiClient();
      if (!ai) throw new Error('AI Assistant is not configured. Please set GEMINI_API_KEY.');
      
      const prompt = `Extract academic information from this syllabus PDF. Return JSON.
      Fields:
      - subjectCode (The catalog code, e.g. "IE-PC 212")
      - subjectName
      - units (number)
      - yearLevel (e.g., "1st Year", "2nd Year")
      - semester (e.g., "1st Sem", "2nd Sem", "Summer")
      - courseDescription
      - prerequisites (array of subject codes)
      - instructor (string)
      - courseOutcomes (array of strings)
      - topics (array of strings)`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "application/pdf",
                data: base64Data
              }
            }
          ]
        },
        config: {
          responseMimeType: "application/json"
        }
      });

      const responseText = aiResponse.text;
      if (!responseText) throw new Error("No response from AI");
      const cleanJson = responseText.replace(/```json|```/g, '').trim();
      const info = JSON.parse(cleanJson);
      updateResult(fileId, { subjectCode: info.subjectCode, message: 'Updating Firestore...' });

      // 4. Update Firestore
      const syllabusUrl = `https://drive.google.com/file/d/${fileId}/preview`;
      const subjectsRef = collection(db, 'subjects');
      
      // Fetch all subjects for local matching to handle code variations
      const querySnapshot = await getDocs(subjectsRef);

      const normalize = (s: string) => (s || '').replace(/\s/g, '').toLowerCase();
      const targetCode = normalize(info.subjectCode);

      const matchingDoc = querySnapshot.docs.find(doc => {
        const data = doc.data();
        return normalize(data.code) === targetCode || doc.id === info.subjectCode || normalize(doc.id) === targetCode;
      });

      if (matchingDoc) {
        const docRef = doc(db, 'subjects', matchingDoc.id);
        await updateDoc(docRef, {
          ...info,
          syllabusUrl,
          isAvailable: true,
          updatedAt: serverTimestamp()
        });
        updateResult(fileId, { status: 'success', message: 'Subject updated successfully', data: info });
      } else {
        updateResult(fileId, { status: 'skipped', message: `No subject found with code: ${info.subjectCode}` });
      }

    } catch (err: any) {
      console.error(err);
      updateResult(fileId, { status: 'error', message: err.message || 'Unknown error' });
    }
  };

  const startIngestion = async () => {
    setIsProcessing(true);
    for (const file of results) {
      if (file.status === 'success') continue;
      await processFile(file.id);
    }
    setIsProcessing(false);
    toast.success('Syllabus ingestion process complete!');
  };

  if (authLoading || !profile) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={profile} />
      
      <main className="flex-1 p-6 lg:p-10 pb-32 lg:pb-10 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="text-ctu-gold" size={24} />
              <span className="text-xs font-black text-ctu-gold uppercase tracking-[0.3em]">Knowledge Extraction</span>
            </div>
            <h1 className="text-7xl md:text-8xl frosted-header font-black tracking-tighter leading-[0.9] py-2">Data Ingestion</h1>
            <p className="text-foreground/40 mt-3 text-xl font-medium tracking-tight">Batch process PDFs from Google Drive to enrich subject data.</p>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => navigate('/admin')}
              className="neumorphic-raised hover:neumorphic-pressed p-4 rounded-2xl text-foreground/60 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <LiquidButton 
              onClick={startIngestion}
              disabled={isProcessing}
              className="px-8 flex items-center gap-3"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  <span>Start Batch Ingestion</span>
                </>
              )}
            </LiquidButton>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Status Overview */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="neumorphic-card border-none overflow-hidden">
              <CardHeader className="border-b border-foreground/5 bg-foreground/[0.02] p-8">
                <CardTitle className="text-2xl font-bold flex items-center justify-between">
                  Processing Queue
                  <Badge className="neumorphic-pressed border-none text-foreground/40 px-3 py-1">
                    {isLoadingFiles ? 'Scanning...' : `${results.length} Files Found`}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-foreground/5">
                  {results.map((result) => (
                    <div key={result.id} className="p-6 hover:bg-foreground/[0.01] transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                          result.status === 'success' ? "bg-green-500/10 text-green-500" :
                          result.status === 'error' ? "bg-red-500/10 text-red-500" :
                          result.status === 'processing' ? "bg-ctu-gold/10 text-ctu-gold animate-pulse" :
                          "neumorphic-pressed text-foreground/30"
                        )}>
                          {result.status === 'processing' ? <Loader2 className="animate-spin" /> : <FileText size={24} />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{result.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {result.subjectCode && (
                              <Badge variant="outline" className="text-[10px] font-mono border-foreground/10 text-ctu-gold">
                                {result.subjectCode}
                              </Badge>
                            )}
                            <p className="text-xs text-foreground/40 font-medium italic">{result.message || 'Waiting to start...'}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {result.status === 'success' && <CheckCircle2 className="text-green-500" size={24} />}
                        {result.status === 'error' && <AlertCircle className="text-red-500" size={24} />}
                        {result.status === 'skipped' && <AlertCircle className="text-ctu-gold/40" size={24} />}
                        
                        <a 
                          href={`https://drive.google.com/file/d/${result.id}/view`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-3 neumorphic-raised hover:neumorphic-pressed rounded-xl transition-all text-foreground/40 hover:text-foreground"
                        >
                          <ExternalLink size={18} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Extracted Data Preview (Simulated Sidebar) */}
          <div className="space-y-6">
            <Card className="neumorphic-card border-none">
              <CardHeader className="p-8">
                <CardTitle className="text-xl font-bold">Extraction Guide</CardTitle>
              </CardHeader>
              <CardContent className="px-8 pb-8 space-y-6">
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg neumorphic-pressed flex items-center justify-center shrink-0 text-ctu-gold font-bold text-xs">1</div>
                    <p className="text-sm text-foreground/60 leading-relaxed">
                      PDFs are fetched from Google Drive using the provided file IDs.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg neumorphic-pressed flex items-center justify-center shrink-0 text-ctu-gold font-bold text-xs">2</div>
                    <p className="text-sm text-foreground/60 leading-relaxed">
                      Gemini 3 Flash analyzes the content to extract precise academic metadata.
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-lg neumorphic-pressed flex items-center justify-center shrink-0 text-ctu-gold font-bold text-xs">3</div>
                    <p className="text-sm text-foreground/60 leading-relaxed">
                      Firestore documents are updated based on the <strong>Subject Code</strong> match.
                    </p>
                  </div>
                </div>
                
                <div className="pt-6 border-t border-foreground/5">
                  <h4 className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-4">Required Fields</h4>
                  <div className="flex flex-wrap gap-2">
                    {['Code', 'Name', 'Units', 'Semester', 'Outcomes', 'Topics'].map(f => (
                      <Badge key={f} variant="outline" className="bg-background/50 border-foreground/5 text-foreground/60">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Results Summary Card */}
            <Card className="neumorphic-card border-none bg-ctu-maroon/5">
              <CardContent className="p-8">
                <h3 className="text-lg font-bold text-ctu-maroon mb-4">Batch Summary</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-foreground/40 font-medium">Processed</span>
                    <span className="text-sm font-bold">{results.filter(r => r.status === 'success').length} / {results.length}</span>
                  </div>
                  <div className="w-full bg-foreground/5 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className="bg-ctu-maroon h-full transition-all duration-500" 
                      style={{ width: `${(results.filter(r => r.status === 'success').length / results.length) * 100}%` }}
                    />
                  </div>
                  {results.some(r => r.status === 'error') && (
                    <div className="p-4 bg-red-500/10 rounded-xl flex items-start gap-3">
                      <AlertCircle className="text-red-500 shrink-0" size={16} />
                      <p className="text-[10px] text-red-500/80 leading-tight">
                        Some files encountered errors. Ensure they are public and contain valid syllabus text.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
