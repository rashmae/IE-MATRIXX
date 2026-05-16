
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Loader2, 
  CheckCircle2, 
  ExternalLink, 
  FileUp, 
  FileCheck,
  Save,
  Trash2,
  Plus
} from 'lucide-react';
import { useAuth } from '@/src/context/AuthContext';
import { db } from '@/src/lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  doc, 
  updateDoc, 
  serverTimestamp, 
  addDoc,
  deleteDoc,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';
import { LiquidButton } from '@/components/ui/liquid-glass';
import { Progress, ProgressIndicator, ProgressTrack } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';

interface SyllabusLinkEntry {
  id: string; // driveId
  name: string;
  url: string;
  firestoreId: string;
  createdAt: any;
}

export default function SyllabusIngestion() {
  const { profile, loading: authLoading } = useAuth();
  const [links, setLinks] = useState<SyllabusLinkEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || !profile || profile.role !== 'admin') {
      if (!authLoading && (!profile || profile.role !== 'admin')) navigate('/dashboard');
      return;
    }

    // Real-time sync with syllabusLinks collection
    const linksRef = collection(db, 'syllabusLinks');
    const q = query(linksRef, orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLinks = snapshot.docs.map(doc => ({
        id: doc.data().driveId,
        name: doc.data().name,
        url: doc.data().url,
        firestoreId: doc.id,
        createdAt: doc.data().createdAt
      })) as SyllabusLinkEntry[];
      
      setLinks(fetchedLinks);
      setIsLoading(false);
    }, (error) => {
      console.error("Link sync error:", error);
      toast.error("Database connection issue. Please check your permissions.");
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [profile, authLoading, navigate]);

  const saveSyllabusLink = async () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) {
      toast.error("Please enter both the subject name/code and the URL.");
      return;
    }

    const match = newLinkUrl.match(/\/d\/([^\/]+)/);
    const driveId = match ? match[1] : (newLinkUrl.includes('id=') ? newLinkUrl.split('id=')[1].split('&')[0] : null);

    if (!driveId && newLinkUrl.includes('drive.google.com')) {
      toast.error("Could not parse Drive ID. Please use a standard Drive link.");
      return;
    }

    setIsAdding(true);
    try {
      // 1. Add to the persistent registry
      await addDoc(collection(db, 'syllabusLinks'), {
        name: newLinkName,
        driveId: driveId || Date.now().toString(),
        url: newLinkUrl,
        createdAt: serverTimestamp()
      });

      // 2. Synchronize with the Catalog
      const subjectsRef = collection(db, 'subjects');
      const snapshot = await getDocs(subjectsRef);
      
      const normalize = (val: string) => (val || '').replace(/[-\s]/g, '').toLowerCase();
      const inputRef = normalize(newLinkName);

      // Look for a subject whose code OR name matches the input
      const matchDoc = snapshot.docs.find(doc => {
        const data = doc.data();
        return normalize(data.code) === inputRef || 
               normalize(data.name) === inputRef || 
               inputRef.includes(normalize(data.code));
      });

      if (matchDoc) {
        await updateDoc(doc(db, 'subjects', matchDoc.id), {
          syllabusUrl: newLinkUrl,
          isAvailable: true,
          updatedAt: serverTimestamp()
        });
        toast.success(`Registered! "${matchDoc.data().code}" is now marked as Available.`);
      } else {
        toast.success("Link stored in Registry. (No matching subject code found in catalog)");
      }

      setNewLinkName('');
      setNewLinkUrl('');
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Failed to persist data to Firebase.");
    } finally {
      setIsAdding(false);
    }
  };

  const removeLink = async (id: string, name: string) => {
    if (!confirm(`Permanently remove "${name}" from the syllabus registry?`)) return;
    try {
      await deleteDoc(doc(db, 'syllabusLinks', id));
      toast.success("Link removed.");
    } catch (err) {
      toast.error("Delete failed.");
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-10">
        <Loader2 className="w-12 h-12 text-ctu-gold animate-spin mb-4" />
        <p className="text-foreground/40 font-black uppercase tracking-widest text-xs">Syncing Syllabus Database...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex transition-colors duration-300">
      <Sidebar />
      <main className="flex-1 p-4 sm:p-8 lg:p-12 pb-36 lg:pb-12 max-w-7xl mx-auto w-full overflow-x-hidden">
        <div className="mb-12">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-4"
          >
            <div className="p-3 bg-ctu-gold/10 rounded-2xl text-ctu-gold">
              <FileUp size={32} />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-foreground tracking-tighter uppercase italic py-2">
                Syllabus <span className="text-ctu-gold">Registry</span>
              </h1>
              <p className="text-foreground/40 font-medium max-w-2xl">
                Store syllabus links permanently. Data added here remains stored in Firebase and automatically updates the student catalog.
              </p>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Input Card */}
          <Card className="neumorphic-card border-none bg-ctu-gold/5">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                Store New Syllabus Link
              </CardTitle>
              <CardDescription>
                Once stored, subjects will show a green checkmark in the catalog.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40 ml-1">Subject Code / Name</label>
                  <Input 
                    placeholder="e.g. IE-PC 212"
                    value={newLinkName}
                    onChange={(e) => setNewLinkName(e.target.value)}
                    className="bg-background/50 border-none h-14 rounded-2xl focus:ring-ctu-gold"
                  />
                </div>
                <div className="flex-[2] space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40 ml-1">Google Drive / Preview Link</label>
                  <Input 
                    placeholder="https://drive.google.com/..."
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    className="bg-background/50 border-none h-14 rounded-2xl focus:ring-ctu-gold"
                  />
                </div>
                <div className="flex items-end">
                  <LiquidButton 
                    onClick={saveSyllabusLink}
                    disabled={isAdding || !newLinkName || !newLinkUrl}
                    className="h-14 px-8 rounded-2xl flex items-center gap-2"
                  >
                    {isAdding ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    <span className="font-bold">Save Link</span>
                  </LiquidButton>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Registry List */}
          <Card className="neumorphic-card border-none overflow-hidden">
            <CardHeader className="p-8 border-b border-foreground/5 mb-0">
              <CardTitle className="text-2xl font-bold flex items-center justify-between">
                Stored Links
                <Badge className="neumorphic-pressed border-none text-foreground/40 px-3 py-1">
                  {links.length} Entries Stored
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-foreground/5">
                {links.length === 0 && (
                  <div className="p-20 text-center text-foreground/20 italic font-medium">
                    The registry is empty. Add links above to populate.
                  </div>
                )}
                {links.map((link) => (
                  <div key={link.firestoreId} className="p-6 hover:bg-foreground/[0.01] transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-green-500/10 text-green-500 flex items-center justify-center">
                        <FileCheck size={24} />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-lg">{link.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <CheckCircle2 size={12} className="text-green-500" />
                          <p className="text-xs text-foreground/40 font-medium">Status: Active & Synchronized</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <a 
                        href={link.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-3 neumorphic-raised hover:neumorphic-pressed rounded-xl transition-all text-foreground/40 hover:text-foreground"
                        title="View Document"
                      >
                        <ExternalLink size={18} />
                      </a>

                      <button 
                        onClick={() => removeLink(link.firestoreId, link.name)}
                        className="p-3 neumorphic-raised hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all text-foreground/20"
                        title="Delete Permanently"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
