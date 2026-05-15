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
    <div className="space-y-10 sm:space-y-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 sm:gap-10">
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto ml-auto">
          <div className="relative group w-full sm:w-80">
            <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-foreground/20 group-focus-within:text-ctu-gold transition-colors" />
            <Input 
              placeholder="Search repositories..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-14 bg-foreground/[0.03] border-none h-14 sm:h-16 rounded-2xl sm:rounded-3xl text-[10px] sm:text-sm font-black uppercase tracking-widest placeholder:text-foreground/20 neumorphic-pressed transition-all w-full"
            />
          </div>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="h-14 sm:h-16 px-8 sm:px-12 rounded-2xl sm:rounded-3xl bg-ctu-maroon text-white font-black uppercase tracking-widest text-[9px] sm:text-[11px] gap-3 shadow-xl w-full sm:w-auto hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Plus size={18} /> New Vault
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-12">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 sm:h-80 rounded-[2.5rem] sm:rounded-[3.5rem] bg-foreground/[0.03] animate-pulse" />
          ))}
        </div>
      ) : filteredNotebooks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-12">
          {filteredNotebooks.map((notebook) => (
            <motion.div
              key={notebook.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -8 }}
              className="group cursor-pointer"
              onClick={() => onSelect(notebook.id)}
            >
              <Card className="h-full bg-background border-none neumorphic-card rounded-[2.5rem] sm:rounded-[3.5rem] overflow-hidden transition-all duration-500 group-hover:shadow-2xl group-hover:shadow-ctu-gold/10">
                <CardContent className="p-0 flex flex-col h-full">
                  <div className="p-8 sm:p-12 pb-6">
                    <div className="flex items-start justify-between mb-8">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-ctu-gold/10 text-ctu-gold flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                        <Book size={28} />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotebook(notebook.id);
                        }}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl text-foreground/20 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={20} />
                      </Button>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-4 uppercase tracking-tighter leading-none group-hover:text-ctu-gold transition-colors">{notebook.name}</h3>
                    <p className="text-foreground/40 text-xs sm:text-sm font-bold line-clamp-3 leading-relaxed italic tracking-tight">
                      {notebook.summary || 'Vault pending initialization. Open to generate AI context.'}
                    </p>
                  </div>
                  <div className="mt-auto p-8 sm:p-12 pt-0 flex items-center justify-between border-t border-foreground/5 mt-6">
                    <div className="flex items-center gap-3 text-foreground/20 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em]">
                      <Clock size={14} />
                      <span>{notebook.createdAt?.toDate ? notebook.createdAt.toDate().toLocaleDateString() : 'Active Now'}</span>
                    </div>
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-foreground/[0.03] flex items-center justify-center text-foreground/20 group-hover:text-ctu-gold group-hover:translate-x-2 transition-all duration-500">
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 sm:py-32 bg-foreground/[0.01] rounded-[3rem] sm:rounded-[5rem] border-2 border-dashed border-foreground/5">
          <Book size={64} className="text-foreground/5 mb-8" />
          <h3 className="text-xl sm:text-3xl font-black text-foreground mb-3 uppercase tracking-tighter">Vault Empty</h3>
          <p className="text-foreground/30 mb-10 text-sm sm:text-lg font-bold italic">Initialize your first research hub.</p>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="h-14 sm:h-16 px-10 sm:px-14 rounded-2xl sm:rounded-3xl bg-ctu-maroon text-white font-black uppercase tracking-widest text-[10px] sm:text-xs shadow-xl shadow-ctu-maroon/20 hover:scale-[1.05] transition-all"
          >
            Create First Vault
          </Button>
        </div>
      )}

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-[95vw] w-full bg-background rounded-[2.5rem] sm:rounded-[4rem] border-none shadow-3xl p-8 sm:p-16 h-[85dvh] overflow-y-auto overscroll-contain">
          <div className="relative z-10">
            <DialogHeader className="mb-10 sm:mb-16">
              <DialogTitle className="text-3xl sm:text-5xl font-black uppercase tracking-tighter leading-none mb-4">Initialize Vault</DialogTitle>
              <p className="text-xs sm:text-base font-bold text-foreground/40 italic tracking-tight">Establish a secure repository for your Industrial Engineering research context.</p>
            </DialogHeader>
            <div className="space-y-8 sm:space-y-12">
              <div className="space-y-4">
                <label className="text-[10px] sm:text-xs font-black text-foreground/20 uppercase tracking-[0.3em] ml-2">Vault Designation (Name)</label>
                <Input 
                  value={newNotebookName}
                  onChange={(e) => setNewNotebookName(e.target.value)}
                  placeholder="e.g. Ergonomics & Human Factors..."
                  className="w-full bg-foreground/[0.03] border-none neumorphic-pressed h-16 sm:h-20 rounded-2xl sm:rounded-3xl px-8 sm:px-10 text-sm sm:text-lg font-black uppercase tracking-tight placeholder:text-foreground/10"
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-4">
                <Button 
                  onClick={handleCreate}
                  className="bg-ctu-maroon text-white font-black uppercase tracking-[0.2em] h-14 sm:h-18 rounded-2xl sm:rounded-3xl px-12 sm:flex-1 text-[10px] sm:text-xs shadow-2xl shadow-ctu-maroon/30 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Create Repository
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-14 sm:h-18 rounded-2xl sm:rounded-3xl px-8 font-bold uppercase tracking-widest text-[9px] sm:text-[10px] opacity-40 hover:opacity-100"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-ctu-gold/5 blur-[100px] rounded-full" />
        </DialogContent>
      </Dialog>
    </div>
  );
}
