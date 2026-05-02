import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Plus, 
  FileText, 
  Link as LinkIcon, 
  Search, 
  Trash2, 
  Send,
  Loader2,
  Sparkles,
  ExternalLink,
  BookOpen,
  Info,
  ChevronRight,
  Globe,
  Upload,
  BrainCircuit
} from 'lucide-react';
import { useNotebook, useNotebooks } from '@/src/hooks/useNotebooks';
import { chatWithNotebook, searchExternalResources, generateNotebookSummary } from '@/src/services/notebookService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface NotebookWorkspaceProps {
  notebookId: string;
  onBack: () => void;
}

function SourceSidebarContent({ sources, deleteSource, notebook }: { sources: any[], deleteSource: (id: string) => void, notebook: any }) {
  return (
    <>
      <div className="p-4 border-b border-foreground/5">
        <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[2px] px-2 mb-4">Sources</h3>
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-3 px-2">
            {sources.map(source => (
              <div 
                key={source.id}
                className="group relative flex flex-col p-4 rounded-2xl bg-background neumorphic-card border-none transition-all hover:translate-x-1"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-foreground/5 text-foreground/40 group-hover:text-ctu-gold transition-colors">
                    {source.type === 'link' ? <LinkIcon size={14} /> : source.type === 'file' ? <FileText size={14} /> : <BookOpen size={14} />}
                  </div>
                  <span className="text-xs font-bold text-foreground truncate flex-1">{source.title}</span>
                </div>
                <p className="text-[10px] text-foreground/30 line-clamp-2 leading-relaxed">
                  {source.content}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteSource(source.id)}
                  className="absolute top-2 right-2 h-8 w-8 text-foreground/10 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all rounded-lg"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            {sources.length === 0 && (
              <div className="py-12 text-center">
                <Info size={32} className="mx-auto text-foreground/10 mb-3" />
                <p className="text-xs font-bold text-foreground/20 uppercase tracking-widest">No sources yet</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
      <div className="p-6 mt-auto">
        <Card className="bg-ctu-gold/5 border-none rounded-2xl overflow-hidden">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-ctu-gold">
              <Sparkles size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Notebook Guide</span>
            </div>
            <p className="text-[10px] text-foreground/60 leading-relaxed italic">
              {notebook.summary || "Add some sources and click 'AI Guide' to generate an overview of your research."}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function NotebookWorkspace({ notebookId, onBack }: NotebookWorkspaceProps) {
  const { notebook, sources, messages, loading, addSource, deleteSource, addMessage } = useNotebook(notebookId);
  const { updateNotebookSummary } = useNotebooks();
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSourcesSidebarOpen, setIsSourcesSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Manual link state
  const [manualTitle, setManualTitle] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [manualContent, setManualContent] = useState('');
  const [isAddingManual, setIsAddingManual] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading || !notebook) return;

    const userMessage = chatInput;
    setChatInput('');
    setIsChatLoading(true);

    try {
      // Add user message to DB
      await addMessage(userMessage, 'user');

      // Prep history for Gemini (limited to last 10 messages for context window management)
      const history = messages.slice(-10).map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }]
      }));

      // Get AI response
      const response = await chatWithNotebook(notebook.name, sources, history, userMessage);
      
      // Add assistant message to DB
      await addMessage(response, 'assistant');
    } catch (error) {
      toast.error('Failed to get AI response');
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || isSearching) return;
    setIsSearching(true);
    try {
      const results = await searchExternalResources(searchQuery);
      setSearchResults(results);
    } catch (e) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportSearchResult = async (result: any) => {
    try {
      await addSource({
        notebookId,
        title: result.title,
        type: 'link',
        content: result.snippet, // Using snippet as initial content
        url: result.url
      });
      toast.success('Resource imported!');
    } catch (e) {
      toast.error('Failed to import');
    }
  };

  const handleAddManual = async () => {
    if (!manualTitle.trim() || !manualContent.trim()) return;
    setIsAddingManual(true);
    try {
      await addSource({
        notebookId,
        title: manualTitle,
        type: 'text',
        content: manualContent,
        url: manualUrl || undefined
      });
      setIsAddSourceOpen(false);
      setManualTitle('');
      setManualContent('');
      setManualUrl('');
      toast.success('Source added!');
    } catch (e) {
      toast.error('Failed to add source');
    } finally {
      setIsAddingManual(false);
    }
  };

  const handleSummarize = async () => {
    if (sources.length === 0 || isSummarizing || !notebook) return;
    setIsSummarizing(true);
    try {
      const summary = await generateNotebookSummary(notebook.name, sources);
      await updateNotebookSummary(notebookId, summary);
      toast.success('Notebook summary updated!');
    } catch (e) {
      toast.error('Summarization failed');
    } finally {
      setIsSummarizing(false);
    }
  };

  if (loading || !notebook) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-ctu-gold" size={48} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 md:p-6 bg-background border-b border-foreground/5 sticky top-0 z-40">
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack}
            className="rounded-2xl neumorphic-raised hover:neumorphic-pressed flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </Button>
          <div className="min-w-0">
            <h2 className="text-lg md:text-2xl font-black text-foreground truncate">{notebook.name}</h2>
            <div className="flex items-center gap-3 mt-0.5">
              <Badge 
                variant="outline" 
                onClick={() => setIsSourcesSidebarOpen(true)}
                className="lg:pointer-events-none bg-ctu-gold/5 text-ctu-gold border-ctu-gold/10 px-2 py-0 text-[9px] md:text-[10px] uppercase font-bold tracking-widest cursor-pointer"
              >
                {sources.length} Sources
              </Badge>
              <span className="hidden md:inline text-foreground/20 text-[10px] font-bold uppercase tracking-widest">
                Updated {notebook.updatedAt?.toDate ? notebook.updatedAt.toDate().toLocaleDateString() : 'Just now'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Button 
            onClick={handleSummarize}
            disabled={isSummarizing || sources.length === 0}
            variant="outline"
            className="hidden sm:flex h-10 md:h-12 rounded-xl border-foreground/10 text-[10px] md:text-xs font-black uppercase tracking-widest gap-2 px-4"
          >
            {isSummarizing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            AI Guide
          </Button>
          <Button 
            onClick={() => setIsAddSourceOpen(true)}
            size="sm"
            className="bg-ctu-maroon hover:bg-ctu-maroon/90 text-white rounded-xl h-10 md:h-12 px-4 md:px-6 gap-2 text-[10px] md:text-xs font-black uppercase tracking-widest shadow-lg shadow-ctu-maroon/20"
          >
            <Plus size={18} />
            <span className="hidden xs:inline">Add Source</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence>
          {isSourcesSidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSourcesSidebarOpen(false)}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="absolute left-0 top-0 bottom-0 w-80 bg-background border-r border-foreground/5 shadow-2xl p-6"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-black text-foreground uppercase tracking-widest">Sources</h3>
                  <Button variant="ghost" size="icon" onClick={() => setIsSourcesSidebarOpen(false)}>
                    <ArrowLeft size={20} />
                  </Button>
                </div>
                <SourceSidebarContent sources={sources} deleteSource={deleteSource} notebook={notebook} />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Desktop Source Sidebar */}
        <div className="w-80 border-r border-foreground/5 bg-foreground/[0.01] flex flex-col hidden lg:flex">
          <SourceSidebarContent sources={sources} deleteSource={deleteSource} notebook={notebook} />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
          <ScrollArea ref={scrollRef} className="flex-1 p-8 pb-32">
            <div className="max-w-3xl mx-auto space-y-8">
              {messages.length === 0 && (
                <div className="text-center py-24 space-y-6">
                  <div className="w-20 h-20 rounded-[30px] bg-ctu-gold/10 flex items-center justify-center mx-auto text-ctu-gold animate-bounce">
                    <BrainCircuit size={40} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-foreground">Ask anything about your sources</h3>
                    <p className="text-foreground/40 text-sm max-w-md mx-auto mt-2 leading-relaxed">
                      Your personal context-aware research assistant. Summarize, extract facts, or analyze your imported materials.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    {[
                      "Summarize my sources",
                      "Find key definitions",
                      "Create a study quiz",
                      "Identify missing info"
                    ].map(suggest => (
                      <Button 
                        key={suggest}
                        variant="outline" 
                        onClick={() => setChatInput(suggest)}
                        className="rounded-3xl border-foreground/10 hover:bg-ctu-gold/5 hover:text-ctu-gold text-xs font-bold uppercase tracking-widest px-6"
                      >
                        {suggest}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex flex-col gap-2 max-w-[85%] sm:max-w-[75%]",
                    message.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    {message.role === 'assistant' && (
                      <div className="w-5 h-5 rounded-full bg-ctu-gold/20 flex items-center justify-center text-ctu-gold">
                        <Sparkles size={10} />
                      </div>
                    )}
                    <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">
                      {message.role === 'user' ? "You" : "IE Assistant"}
                    </span>
                    {message.role === 'user' && (
                      <div className="w-5 h-5 rounded-full bg-ctu-maroon/10 flex items-center justify-center text-ctu-maroon">
                        <ArrowLeft size={10} className="rotate-180" />
                      </div>
                    )}
                  </div>

                  <div className={cn(
                    "p-5 rounded-[2rem] border overflow-hidden shadow-sm transition-all",
                    message.role === 'user' 
                      ? "bg-ctu-maroon text-white border-ctu-maroon/20 rounded-tr-none neumorphic-raised" 
                      : "bg-background text-foreground border-foreground/10 rounded-tl-none neumorphic-card"
                  )}>
                    <div className={cn(
                      "prose prose-sm max-w-none",
                      message.role === 'user' ? "prose-invert" : "prose-slate"
                    )}>
                      <ReactMarkdown 
                        components={{
                          p: ({ children }) => <p className="mb-0 leading-relaxed font-medium">{children}</p>
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  
                  {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-2 mt-1">
                       {message.citations.map(id => {
                         const source = sources.find(s => s.id === id);
                         return source ? (
                           <div key={id} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-foreground/5 text-[9px] font-bold text-foreground/40 uppercase tracking-widest border border-foreground/5">
                             <BookOpen size={10} />
                             {source.title.substring(0, 15)}...
                           </div>
                         ) : null;
                       })}
                    </div>
                  )}
                </motion.div>
              ))}

              {isChatLoading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-xl bg-ctu-gold/10 flex items-center justify-center text-ctu-gold animate-spin">
                    <Loader2 size={16} />
                  </div>
                  <div className="flex gap-1 items-center mt-2">
                    <div className="w-1.5 h-1.5 bg-foreground/20 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1.5 h-1.5 bg-foreground/20 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1.5 h-1.5 bg-foreground/20 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Chat Input Fix */}
          <div className="absolute bottom-10 left-0 right-0 p-8 pt-0 pointer-events-none">
            <div className="max-w-3xl mx-auto pointer-events-auto">
              <form 
                onSubmit={handleSendMessage}
                className="relative group neumorphic-raised rounded-[36px] bg-background p-2 pr-4 shadow-2xl"
              >
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-ctu-gold transition-colors">
                  <Sparkles size={20} />
                </div>
                <Input 
                  placeholder="Ask a question about your sources..." 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="bg-transparent border-none h-16 pl-14 pr-16 focus-visible:ring-0 text-foreground placeholder:text-foreground/20 font-medium"
                />
                <Button 
                  type="submit"
                  disabled={isChatLoading || !chatInput.trim()}
                  className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-ctu-maroon hover:bg-ctu-maroon/90 text-white shadow-lg transition-all active:scale-90 disabled:opacity-50"
                >
                  <Send size={20} />
                </Button>
              </form>
              <p className="text-[9px] text-center text-foreground/20 font-bold uppercase tracking-[3px] mt-4">
                Answers generated using notebook context
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Add Source Modal */}
      <Dialog open={isAddSourceOpen} onOpenChange={setIsAddSourceOpen}>
        <DialogContent className="max-w-4xl rounded-[40px] border-none neumorphic-card p-0 overflow-hidden min-h-[500px]">
          <div className="p-8 border-b border-foreground/5 flex items-center justify-between">
            <div>
              <DialogTitle className="text-3xl font-black">Add Research Source</DialogTitle>
              <p className="text-foreground/40 text-xs font-bold uppercase tracking-[2px] mt-1">Import knowledge into your notebook</p>
            </div>
          </div>
          <Tabs defaultValue="search" className="flex flex-col flex-1">
            <TabsList className="bg-foreground/5 h-16 w-full flex justify-start rounded-none px-8 gap-8">
              <TabsTrigger value="search" className="data-[state=active]:bg-transparent data-[state=active]:text-ctu-gold text-xs font-bold uppercase tracking-widest gap-2">
                <Search size={16} /> External Search
              </TabsTrigger>
              <TabsTrigger value="manual" className="data-[state=active]:bg-transparent data-[state=active]:text-ctu-gold text-xs font-bold uppercase tracking-widest gap-2">
                <LinkIcon size={16} /> Link / Text
              </TabsTrigger>
              <TabsTrigger value="upload" className="data-[state=active]:bg-transparent data-[state=active]:text-ctu-gold text-xs font-bold uppercase tracking-widest gap-2">
                <Upload size={16} /> File Upload
              </TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="p-8 flex-1 focus-visible:ring-0">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <Input 
                    placeholder="Search scholarly articles, documentation, IE standards..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1 h-14 rounded-2xl bg-foreground/5 border-none px-6 focus:ring-ctu-gold transition-all"
                  />
                  <Button 
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="h-14 px-8 rounded-2xl bg-ctu-maroon text-white font-bold uppercase tracking-widest group"
                  >
                    {isSearching ? <Loader2 className="animate-spin" /> : <Search />}
                  </Button>
                </div>

                <ScrollArea className="h-[300px]">
                  <div className="space-y-4 pr-4">
                    {searchResults.map((res, i) => (
                      <Card key={i} className="bg-background border-none neumorphic-raised group overflow-hidden">
                        <CardContent className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="flex-1">
                            <h4 className="font-bold text-foreground mb-1 group-hover:text-ctu-gold transition-colors">{res.title}</h4>
                            <div className="flex items-center gap-2 text-foreground/20 text-[10px] uppercase font-bold tracking-widest mb-3">
                              <Globe size={10} />
                              <span className="truncate max-w-[200px]">{res.url}</span>
                            </div>
                            <p className="text-xs text-foreground/40 leading-relaxed line-clamp-2">{res.snippet}</p>
                          </div>
                          <Button 
                            onClick={() => handleImportSearchResult(res)}
                            className="bg-ctu-gold/10 text-ctu-gold hover:bg-ctu-gold hover:text-white rounded-xl px-4 gap-2 h-10 transition-all font-bold uppercase text-[10px]"
                          >
                            <Plus size={14} /> Import
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                    {!isSearching && searchResults.length === 0 && (
                      <div className="py-12 text-center text-foreground/20">
                        <ExternalLink size={32} className="mx-auto mb-3" />
                        <p className="text-xs font-bold uppercase tracking-widest">Search results will appear here</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="p-8 flex-1 space-y-6 focus-visible:ring-0">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="space-y-3">
                    <label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest ml-1">Title</label>
                    <Input 
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Source Title"
                      className="bg-foreground/5 border-none h-14 rounded-2xl px-6"
                    />
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest ml-1">URL (Optional)</label>
                    <Input 
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      placeholder="https://..."
                      className="bg-foreground/5 border-none h-14 rounded-2xl px-6"
                    />
                 </div>
               </div>
               <div className="space-y-3">
                  <label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest ml-1">Content / Notes</label>
                  <textarea 
                    value={manualContent}
                    onChange={(e) => setManualContent(e.target.value)}
                    placeholder="Paste text or add your notes here..."
                    className="w-full bg-foreground/5 border-none rounded-3xl p-6 min-h-[150px] focus:ring-ctu-gold transition-all text-sm leading-relaxed"
                  />
               </div>
               <Button 
                 onClick={handleAddManual}
                 disabled={isAddingManual || !manualTitle.trim() || !manualContent.trim()}
                 className="w-full h-14 bg-ctu-maroon text-white font-bold uppercase tracking-widest rounded-2xl"
               >
                 {isAddingManual ? <Loader2 className="animate-spin" /> : 'Add to Notebook'}
               </Button>
            </TabsContent>

            <TabsContent value="upload" className="p-8 flex-1 focus-visible:ring-0">
               <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-foreground/10 rounded-[30px] bg-foreground/[0.02]">
                 <Upload size={48} className="text-foreground/10 mb-6" />
                 <h4 className="text-xl font-bold mb-2">Drag & Drop Files</h4>
                 <p className="text-foreground/40 text-xs text-center max-w-xs mb-8">
                   Support for PDF, DOCX, and TXT files. AI will automatically extract text content.
                 </p>
                 <Button variant="outline" className="rounded-xl px-12 h-12 border-foreground/10">Select Files</Button>
                 <p className="mt-4 text-[10px] font-bold text-foreground/10 uppercase tracking-widest">Coming soon (PDF Parsing)</p>
               </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
