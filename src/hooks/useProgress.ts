
import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { Progress, SubjectStatus } from '@/src/types';
import { handleFirestoreError } from '@/src/lib/firestore-errors';
import { IE_SUBJECTS } from '@/src/lib/constants';
import { toast } from 'sonner';

export function useProgress() {
  const { user } = useAuth();
  const [progressMap, setProgressMap] = useState<Record<string, Progress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProgressMap({});
      setLoading(false);
      return;
    }

    const progressRef = doc(db, 'userProgress', user.uid);
    const unsubscribe = onSnapshot(progressRef, (docSnap) => {
      if (docSnap.exists()) {
        setProgressMap(docSnap.data().progressMap || {});
      } else {
        setProgressMap({});
      }
      setLoading(false);
    }, (error) => {
      console.error("Progress subscription error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const updateProgress = async (subjectId: string, updates: Partial<Progress>) => {
    if (!user) return;

    const current = progressMap[subjectId] || {
      subjectId,
      status: 'not_yet',
      updatedAt: new Date().toISOString()
    };

    const next: Progress = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Filter out undefined values (which Firestore rejects)
    const cleanedNext = Object.fromEntries(
      Object.entries(next).filter(([_, v]) => v !== undefined)
    ) as Progress;

    const newMap = { ...progressMap, [subjectId]: cleanedNext };
    const progressRef = doc(db, 'userProgress', user.uid);

    try {
      await setDoc(progressRef, {
        progressMap: newMap,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, 'update', `userProgress/${user.uid}`);
    }
  };

  const toggleStatus = async (subjectId: string) => {
    const subject = IE_SUBJECTS.find(s => s.id === subjectId);
    if (!subject) return;

    const currentStatus = progressMap[subjectId]?.status || 'not_yet';
    let nextStatus: SubjectStatus = 'not_yet';
    
    if (currentStatus === 'not_yet') {
      nextStatus = 'in_progress';
    } else if (currentStatus === 'in_progress') {
      const prerequisites = IE_SUBJECTS.filter(s => subject.prerequisiteIds.includes(s.id));
      const unmet = prerequisites.filter(p => (progressMap[p.id]?.status || 'not_yet') !== 'done');
      
      if (unmet.length > 0) {
        toast.error(`Prerequisites not met. You must complete: ${unmet.map(p => p.code).join(', ')} first.`);
        return;
      }
      nextStatus = 'done';
    } else {
      nextStatus = 'not_yet';
    }

    await updateProgress(subjectId, { status: nextStatus });
    toast.success(`Updated status for ${subject.code}`);
  };

  const setGrade = async (subjectId: string, grade: number | undefined) => {
    await updateProgress(subjectId, { grade });
  };

  return { progressMap, loading, updateProgress, toggleStatus, setGrade };
}
