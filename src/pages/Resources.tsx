import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ListItemSkeleton } from '@/src/components/SkeletonLoader';
import { useDebounce } from '@/src/hooks/useDebounce';
import { 
  FolderOpen, 
  Search, 
  Plus, 
  FileText, 
  Video, 
  Link as LinkIcon,
  Globe,
  Lock,
  ExternalLink,
  Filter,
  Upload,
  Youtube,
  FileBarChart,
  FilePieChart
} from 'lucide-react';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User, Resource, ResourceType } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LiquidButton } from '@/components/ui/liquid-glass';
import UploadResourceModal from '@/src/components/resources/UploadResourceModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { db } from '@/src/lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';

import { useAuth } from '@/src/context/AuthContext';

export default function Resources() {
  const { profile: user, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [selectedType, setSelectedType] = useState<ResourceType | 'All'>('All');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
      return;
    } 
    
    if (user) {
      // Real-time Firestore sync with two separate queries to handle permissions correctly
      const publicQuery = query(
        collection(db, 'resources'),
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      
      const myQuery = query(
        collection(db, 'resources'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const publicResourcesRef: { current: Resource[] } = { current: [] };
      const myResourcesRef: { current: Resource[] } = { current: [] };

      const mergeAndSet = () => {
        const combined = [...publicResourcesRef.current, ...myResourcesRef.current];
        const seen = new Set<string>();
        const deduped = combined.filter(r => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        }).sort((a, b) => {
          const getT = (val: any) => {
            if (!val) return 0;
            if (typeof val.toMillis === 'function') return val.toMillis();
            if (typeof val.toDate === 'function') return val.toDate().getTime();
            if (val instanceof Date) return val.getTime();
            const d = new Date(val);
            return isNaN(d.getTime()) ? 0 : d.getTime();
          };
          return getT(b.createdAt) - getT(a.createdAt);
        });
        setResources(deduped);
      };

      const handleSnapshot = (snapshot: any, source: 'public' | 'mine') => {
        const newResources = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        })) as Resource[];

        if (source === 'public') {
          publicResourcesRef.current = newResources;
        } else {
          myResourcesRef.current = newResources;
        }
        mergeAndSet();
        setResourcesLoading(false);
      };

      const unsubscribePublic = onSnapshot(publicQuery, (snapshot) => handleSnapshot(snapshot, 'public'), (error) => {
        console.error("Public resources sync error:", error);
      });

      const unsubscribeMy = onSnapshot(myQuery, (snapshot) => handleSnapshot(snapshot, 'mine'), (error) => {
        console.error("My resources sync error:", error);
      });

      return () => {
        unsubscribePublic();
        unsubscribeMy();
      };
    }
  }, [user, authLoading, navigate]);

  const handleUpload = (newResource: Resource) => {
    // UI optimization: we can close the modal, 
    // the real-time sync will pick up the new doc added by the modal
    setIsUploadModalOpen(false);
  };

  const filteredResources = useMemo(() => resources.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesType = selectedType === 'All' || r.type === selectedType;
    return matchesSearch && matchesType;
  }), [resources, debouncedSearch, selectedType]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex">
        <Sidebar user={null} />
        <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
          <div className="mb-8 space-y-3">
            <div className="skeleton h-14 w-40 rounded-xl" />
            <div className="skeleton h-5 w-64 rounded-lg" />
          </div>
          <ListItemSkeleton count={5} />
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={user} />
      
      <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
          <div>
            <h1 className="text-4xl sm:text-6xl md:text-8xl frosted-header font-black tracking-tighter leading-[0.9] py-2">Resources</h1>
            <p className="text-foreground/40 mt-3 text-xl font-medium tracking-tight">Access shared notes, videos, and reference materials.</p>
          </div>

          <button 
            onClick={() => setIsUploadModalOpen(true)}
            className="px-8 py-4 bg-gradient-to-r from-ctu-gold to-ctu-maroon text-white rounded-2xl flex items-center gap-3 font-bold shadow-[0_10px_20px_rgba(139,26,26,0.2)] hover:scale-105 active:scale-95 transition-all text-sm tracking-wide"
          >
            <Plus size={20} className="text-white" />
            Upload Resource
          </button>
        </div>

        <Tabs defaultValue="all" className="space-y-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <TabsList className="neumorphic-pressed border-none p-1.5 rounded-2xl h-auto">
              <TabsTrigger value="all" className="rounded-xl px-8 py-2.5 text-[10px] font-bold uppercase tracking-widest data-[state=active]:neumorphic-raised data-[state=active]:text-foreground text-foreground/40">Public Library</TabsTrigger>
              <TabsTrigger value="mine" className="rounded-xl px-8 py-2.5 text-[10px] font-bold uppercase tracking-widest data-[state=active]:neumorphic-raised data-[state=active]:text-foreground text-foreground/40">My Uploads</TabsTrigger>
            </TabsList>

            <div className="flex flex-1 md:max-w-xl gap-6">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/40" size={18} />
                <Input 
                  placeholder="Search resources..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="neumorphic-pressed border-none pl-12 h-12 rounded-2xl focus:ring-ctu-gold text-foreground placeholder:text-foreground/20"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-2">
                {['All', 'notes', 'youtube', 'document', 'presentation', 'video', 'reference'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type as any)}
                    className={cn(
                      "px-3 py-2 rounded-xl text-[9px] font-bold uppercase transition-all tracking-wider whitespace-nowrap",
                      selectedType === type 
                        ? "neumorphic-pressed text-foreground" 
                        : "neumorphic-raised text-foreground/40 hover:text-foreground"
                    )}
                  >
                    {type === 'presentation' ? 'PPTX' : type === 'document' ? 'Docs' : type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <TabsContent value="all" className="mt-0">
            {resourcesLoading ? (
              <ListItemSkeleton count={6} />
            ) : filteredResources.filter(r => r.isPublic).length === 0 ? (
              <div className="text-center py-16 neumorphic-pressed rounded-3xl">
                <FolderOpen size={40} className="text-foreground/20 mx-auto mb-4" />
                <p className="text-foreground/40 font-bold text-sm">No public resources yet</p>
                <p className="text-foreground/25 text-xs mt-1">Be the first to upload a resource!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                <AnimatePresence mode="popLayout">
                  {filteredResources.filter(r => r.isPublic).map((res) => (
                    <div key={res.id}>
                      <ResourceCard resource={res} />
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine" className="mt-0">
            {resourcesLoading ? (
              <ListItemSkeleton count={4} />
            ) : filteredResources.filter(r => r.userId === user.uid).length === 0 ? (
              <div className="text-center py-16 neumorphic-pressed rounded-3xl">
                <Upload size={40} className="text-foreground/20 mx-auto mb-4" />
                <p className="text-foreground/40 font-bold text-sm">You haven't uploaded anything yet</p>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="mt-4 bg-ctu-gold text-white font-bold px-5 py-2.5 rounded-xl text-sm tap-target"
                >
                  Upload your first resource
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                <AnimatePresence mode="popLayout">
                  {filteredResources.filter(r => r.userId === user.uid).map((res) => (
                    <div key={res.id}>
                      <ResourceCard resource={res} />
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <BottomNav />

      <UploadResourceModal 
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUpload={handleUpload}
      />
    </div>
  );
}

function ResourceCard({ resource }: { resource: Resource }) {
  const subject = IE_SUBJECTS.find(s => s.id === resource.subjectId);
  
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Card 
        onClick={() => {
          if (resource.url && resource.url !== '#') {
            window.open(resource.url, '_blank');
          } else {
            toast.info('No link available for this resource');
          }
        }}
        className="neumorphic-card border-none hover:scale-[1.02] transition-all cursor-pointer group h-full flex flex-col"
      >
        <CardContent className="p-8 flex flex-col h-full">
          <div className="flex justify-between items-start mb-6">
            <div className="p-4 rounded-2xl neumorphic-pressed text-foreground/40 group-hover:text-ctu-gold transition-colors">
              {resource.type === 'notes' ? <FileText size={28} /> : 
               resource.type === 'youtube' ? <Youtube size={28} className="text-red-500" /> :
               resource.type === 'document' ? <FileBarChart size={28} /> :
               resource.type === 'presentation' ? <FilePieChart size={28} /> :
               resource.type === 'video' ? <Video size={28} /> : 
               <LinkIcon size={28} />}
            </div>
            <div className="flex flex-col items-end gap-3">
              <Badge variant="outline" className="text-[10px] uppercase font-bold border-none neumorphic-pressed px-3 py-1 text-foreground/60">
                {resource.type}
              </Badge>
              {resource.isPublic ? (
                <div className="flex items-center gap-1.5 text-[10px] text-green-500 font-bold uppercase tracking-widest">
                  <Globe size={12} /> Public
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[10px] text-ctu-gold font-bold uppercase tracking-widest">
                  <Lock size={12} /> Private
                </div>
              )}
            </div>
          </div>

          <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-ctu-gold transition-colors line-clamp-2 leading-tight">
            {resource.title}
          </h3>
          {resource.fileName && (
            <p className="text-[9px] text-foreground/30 font-bold uppercase tracking-widest mb-1 truncate">
              📎 {resource.fileName}
            </p>
          )}
          <p className="text-xs text-ctu-gold font-bold mb-8 uppercase tracking-widest">{subject?.code} · {subject?.name}</p>
          
          <div className="flex items-center justify-between pt-6 border-t border-foreground/5 mt-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full neumorphic-pressed flex items-center justify-center text-[10px] font-bold text-foreground">
                {resource.userName[0]}
              </div>
              <span className="text-[10px] text-foreground/40 font-bold uppercase tracking-widest">{resource.userName}</span>
            </div>
            <div className="flex items-center gap-2">
              {resource.type === 'youtube' && (
                <div className="flex items-center gap-2 group-hover:scale-110 transition-transform">
                  <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 neumorphic-raised">
                    <Video size={14} />
                  </div>
                </div>
              )}
              {resource.url && resource.url.startsWith('data:') && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    const link = document.createElement('a');
                    link.href = resource.url;
                    link.download = resource.fileName || 'resource';
                    link.click();
                  }}
                  className="p-2.5 rounded-xl bg-background neumorphic-raised hover:neumorphic-pressed text-ctu-gold transition-all"
                  title="Download File"
                >
                  <Upload size={16} className="rotate-180" />
                </button>
              )}
              <div className="p-2.5 rounded-xl bg-background neumorphic-raised group-hover:neumorphic-pressed transition-all">
                <ExternalLink size={16} className="text-foreground/20 group-hover:text-ctu-gold transition-colors" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
