import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Link as LinkIcon, FileText, Video, Globe, Lock, Youtube, FileBarChart, FilePieChart, Loader2 } from 'lucide-react';
import { ResourceType, Subject, User } from '@/src/types/index';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { db, storage } from '@/src/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

interface UploadResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (resource: any) => void;
  initialSubjectId?: string;
  initialFile?: File | null;
}

import { useAuth } from '@/src/context/AuthContext';

export default function UploadResourceModal({ isOpen, onClose, onUpload, initialSubjectId, initialFile }: UploadResourceModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ResourceType>('notes');
  const [subjectId, setSubjectId] = useState(initialSubjectId || IE_SUBJECTS[0].id);
  const [isPublic, setIsPublic] = useState(true);
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { profile: user } = useAuth();

  React.useEffect(() => {
    if (isOpen) {
      if (initialFile) {
        setFile(initialFile);
        setTitle(initialFile.name.split('.')[0]); // Use filename as default title
        
        // Set type based on extension
        const ext = initialFile.name.split('.').pop()?.toLowerCase();
        if (['ppt', 'pptx'].includes(ext || '')) setType('presentation');
        else if (['doc', 'docx', 'pdf'].includes(ext || '')) setType('document');
        else if (['mp4', 'webm'].includes(ext || '')) setType('video');
        else setType('notes');
      } else {
        // Reset if opening normally
        resetForm();
      }

      if (initialSubjectId) {
        setSubjectId(initialSubjectId);
      }
    }
  }, [isOpen, initialSubjectId, initialFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Check file size (limit to 5MB for storage)
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error('File is too large. Please keep it under 5MB.');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('You must be logged in to upload');
      return;
    }

    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if ((type === 'notes' || type === 'document' || type === 'presentation' || type === 'video') && !file && !url) {
      toast.error('Please upload a file or provide a link');
      return;
    }

    setIsUploading(true);
    try {
      let finalUrl = url;

      // 1. Upload file if present
      if (file) {
        const storageRef = ref(storage, `resources/${user.uid}/${Date.now()}_${file.name}`);
        const uploadTask = await uploadBytesResumable(storageRef, file);
        finalUrl = await getDownloadURL(uploadTask.ref);
      }

      // 2. Save metadata to Firestore
      const newResource = {
        subjectId,
        userId: user.uid,
        userName: user.fullName,
        title,
        type,
        url: finalUrl || '#',
        fileName: file?.name || null,
        isPublic,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'resources'), newResource);
      
      onUpload({ id: docRef.id, ...newResource, createdAt: new Date().toISOString() });
      toast.success('Resource shared successfully!');
      resetForm();
      onClose();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error('Failed to upload resource. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setType('notes');
    setSubjectId(initialSubjectId || IE_SUBJECTS[0].id);
    setIsPublic(true);
    setUrl('');
    setFile(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-background rounded-3xl overflow-hidden max-w-2xl w-full neumorphic-card border-none max-h-[90vh] overflow-y-auto"
          >
            <div className="p-8 border-b border-foreground/5 flex items-center justify-between sticky top-0 bg-background z-10">
              <div>
                <h3 className="text-2xl font-bold text-foreground">Upload Resource</h3>
                <p className="text-foreground/40 text-xs font-bold uppercase tracking-widest mt-1">Share knowledge with the IE community</p>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl neumorphic-raised hover:neumorphic-pressed text-foreground/40 hover:text-foreground transition-all">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-8">
              {/* Title */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest ml-1">Resource Title</label>
                <input 
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Work Study Midterm Reviewer"
                  className="w-full bg-background border-none neumorphic-pressed rounded-2xl p-4 text-foreground focus:ring-2 focus:ring-ctu-gold transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Type Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest ml-1">Resource Type</label>
                  <div className="flex bg-background p-1.5 rounded-2xl neumorphic-pressed">
                    {[
                      { id: 'notes', icon: FileText, label: 'Notes' },
                      { id: 'youtube', icon: Youtube, label: 'YouTube' },
                      { id: 'document', icon: FileBarChart, label: 'Docs' },
                      { id: 'presentation', icon: FilePieChart, label: 'PPTX' },
                      { id: 'video', icon: Video, label: 'MP4' },
                      { id: 'reference', icon: LinkIcon, label: 'Link' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setType(t.id as ResourceType);
                          setFile(null);
                        }}
                        className={cn(
                          "flex-1 flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl transition-all",
                          type === t.id ? "neumorphic-raised text-ctu-gold" : "text-foreground/30 hover:text-foreground/60"
                        )}
                      >
                        <t.icon size={18} />
                        <span className="text-[8px] font-bold uppercase tracking-widest">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject Selection */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest ml-1">Related Subject</label>
                  <select 
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="w-full bg-background border-none neumorphic-pressed rounded-2xl p-4 text-foreground focus:ring-2 focus:ring-ctu-gold transition-all appearance-none"
                  >
                    {IE_SUBJECTS.map(s => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Upload Area / URL */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest ml-1">
                  {type === 'youtube' || type === 'reference' ? 'Resource Link' : 'Media Content'}
                </label>
                {(type === 'notes' || type === 'document' || type === 'presentation' || type === 'video') ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div 
                      className={cn(
                        "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer",
                        file ? "border-ctu-gold bg-ctu-gold/5" : "border-foreground/10 hover:border-ctu-gold/50 bg-foreground/[0.02]"
                      )}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept={
                          type === 'document' ? ".doc,.docx,.pdf,.txt" :
                          type === 'presentation' ? ".ppt,.pptx" :
                          type === 'video' ? ".mp4,.webm" :
                          ".pdf,.ppt,.pptx,.jpg,.jpeg,.png,.doc,.docx,.txt"
                        }
                        onChange={handleFileChange}
                      />
                      <Upload size={32} className={cn(file ? "text-ctu-gold" : "text-foreground/20")} />
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest block">
                          {file ? file.name : 
                           type === 'document' ? 'Upload DOC/DOCX/PDF' :
                           type === 'presentation' ? 'Upload PPT/PPTX' :
                           type === 'video' ? 'Upload Video File' :
                           'Click to upload file'}
                        </span>
                        {file && (
                          <span className="text-[8px] text-ctu-gold font-bold uppercase mt-1 block">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest text-center mb-4">OR USE A DIRECT LINK</span>
                      <input 
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full bg-background border-none neumorphic-pressed rounded-2xl p-4 text-foreground focus:ring-2 focus:ring-ctu-gold transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    {type === 'youtube' && <Youtube size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-red-500" />}
                    <input 
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={type === 'youtube' ? "https://youtube.com/watch?v=..." : "https://example.com/..."}
                      className={cn(
                        "w-full bg-background border-none neumorphic-pressed rounded-2xl p-4 text-foreground focus:ring-2 focus:ring-ctu-gold transition-all",
                        type === 'youtube' && "pl-12"
                      )}
                    />
                  </div>
                )}
              </div>

              {/* Visibility */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-foreground/40 uppercase tracking-widest ml-1">Visibility</label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl transition-all border-2",
                      isPublic ? "border-green-500/50 bg-green-500/5 text-green-500" : "border-transparent neumorphic-raised text-foreground/40"
                    )}
                  >
                    <Globe size={20} />
                    <div className="text-left">
                      <p className="text-xs font-bold uppercase tracking-widest">Public</p>
                      <p className="text-[10px] opacity-60">Visible to all IE students</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-3 p-5 rounded-2xl transition-all border-2",
                      !isPublic ? "border-ctu-gold/50 bg-ctu-gold/5 text-ctu-gold" : "border-transparent neumorphic-raised text-foreground/40"
                    )}
                  >
                    <Lock size={20} />
                    <div className="text-left">
                      <p className="text-xs font-bold uppercase tracking-widest">Private</p>
                      <p className="text-[10px] opacity-60">Only you can see this</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="pt-6">
                <button 
                  type="submit"
                  disabled={isUploading}
                  className="w-full py-5 bg-ctu-maroon text-white rounded-2xl font-bold text-sm uppercase tracking-[4px] shadow-[0_10px_20px_rgba(139,26,26,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Uploading...
                    </>
                  ) : (
                    'Confirm Upload'
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
