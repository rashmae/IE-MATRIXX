import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Book, Plus, Search, Trash2, Clock, ChevronRight } from 'lucide-react';
import { useNotebooks } from '@/src/hooks/useNotebooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface NotebookListProps {
  onSelect: (id: string) => void;
}

export default function NotebookList({ onSelect }: NotebookListProps) {
  const { notebooks, loading, createNotebook, deleteNotebook } = useNotebooks();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreate = async () => {
    if (!newNotebookName.trim()) return;
    try {
      const id = await createNotebook(newNotebookName);
      setIsCreateModalOpen(false);
      setNewNotebookName('');
      toast.success('Notebook created!');
      if (id) onSelect(id);
    } catch (e) {
      toast.error('Failed to create notebook');
    }
  };

  const filteredNotebooks = notebooks.filter(nb => 
    nb.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-foreground tracking-tight">Study Notebooks</h2>
          <p className="text-foreground/40 text-sm font-bold uppercase tracking-widest mt-1">Your AI-powered research hub</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-ctu-gold transition-colors" />
            <Input 
              placeholder="Search notebooks..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 bg-background border-none neumorphic-pressed h-12 rounded-2xl w-[200px] md:w-[300px]"
            />
          </div>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="h-12 px-6 rounded-2xl bg-ctu-maroon hover:bg-ctu-maroon/90 text-white font-bold uppercase tracking-widest text-xs gap-3 shadow-lg shadow-ctu-maroon/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={18} />
            New Notebook
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[200px] rounded-3xl bg-foreground/5 animate-pulse" />
          ))}
        </div>
      ) : filteredNotebooks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotebooks.map((notebook) => (
            <motion.div
              key={notebook.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -4 }}
              className="group cursor-pointer"
              onClick={() => onSelect(notebook.id)}
            >
              <Card className="h-full bg-background border-none neumorphic-card overflow-hidden transition-all group-hover:shadow-2xl group-hover:shadow-ctu-gold/10">
                <CardContent className="p-0 flex flex-col h-full">
                  <div className="p-6 pb-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-3 rounded-2xl bg-ctu-gold/10 text-ctu-gold">
                        <Book size={24} />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotebook(notebook.id);
                        }}
                        className="text-foreground/20 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </Button>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-ctu-gold transition-colors">{notebook.name}</h3>
                    <p className="text-foreground/40 text-xs line-clamp-2 leading-relaxed">
                      {notebook.summary || 'Open to generate an AI summary for your sources.'}
                    </p>
                  </div>
                  <div className="mt-auto p-6 pt-0 flex items-center justify-between border-t border-foreground/5 mt-4">
                    <div className="flex items-center gap-2 text-foreground/20 text-[10px] font-bold uppercase tracking-widest">
                      <Clock size={12} />
                      <span>{notebook.createdAt?.toDate ? notebook.createdAt.toDate().toLocaleDateString() : 'Just now'}</span>
                    </div>
                    <ChevronRight size={18} className="text-foreground/20 transform group-hover:translate-x-1 transition-all" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 bg-foreground/[0.02] rounded-[40px] border-2 border-dashed border-foreground/5">
          <Book size={48} className="text-foreground/10 mb-6" />
          <h3 className="text-xl font-bold text-foreground mb-2">No notebooks found</h3>
          <p className="text-foreground/40 mb-8">Start your research by creating your first notebook.</p>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            variant="outline"
            className="rounded-xl border-foreground/10 hover:bg-foreground/5"
          >
            Create your first notebook
          </Button>
        </div>
      )}

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="rounded-3xl border-none neumorphic-card p-0 overflow-hidden max-w-md">
          <div className="p-8 border-b border-foreground/5">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">New Research Notebook</DialogTitle>
            </DialogHeader>
            <p className="text-foreground/40 text-xs font-bold uppercase tracking-widest mt-1">Group your study materials together</p>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest ml-1">Notebook Name</label>
              <Input 
                value={newNotebookName}
                onChange={(e) => setNewNotebookName(e.target.value)}
                placeholder="e.g. Ergonomics Research"
                className="w-full bg-background border-none neumorphic-pressed h-14 rounded-2xl px-6"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter className="p-8 pt-0 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreate}
              className="bg-ctu-maroon hover:bg-ctu-maroon/90 text-white rounded-xl px-8"
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
