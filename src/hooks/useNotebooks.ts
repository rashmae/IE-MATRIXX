import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { Notebook, NotebookSource, NotebookMessage } from '@/src/types/index';

export function useNotebooks() {
  const { profile: user } = useAuth();
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'notebooks'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notebook[];
      setNotebooks(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const createNotebook = async (name: string) => {
    if (!user) return;
    const docRef = await addDoc(collection(db, 'notebooks'), {
      userId: user.uid,
      name,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      summary: ''
    });
    return docRef.id;
  };

  const deleteNotebook = async (id: string) => {
    await deleteDoc(doc(db, 'notebooks', id));
  };

  const updateNotebookSummary = async (id: string, summary: string) => {
    await updateDoc(doc(db, 'notebooks', id), {
      summary,
      updatedAt: serverTimestamp()
    });
  };

  return { notebooks, loading, createNotebook, deleteNotebook, updateNotebookSummary };
}

export function useNotebook(notebookId: string | undefined) {
  const { profile: user } = useAuth();
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [sources, setSources] = useState<NotebookSource[]>([]);
  const [messages, setMessages] = useState<NotebookMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !notebookId) return;

    // Notebook Data
    const notebookUnsubscribe = onSnapshot(doc(db, 'notebooks', notebookId), (doc) => {
      if (doc.exists()) {
        setNotebook({ id: doc.id, ...doc.data() } as Notebook);
      }
    });

    // Sources
    const sourcesQuery = query(
      collection(db, 'notebooks', notebookId, 'sources'),
      orderBy('createdAt', 'desc')
    );
    const sourcesUnsubscribe = onSnapshot(sourcesQuery, (snapshot) => {
      setSources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotebookSource[]);
    });

    // Messages
    const messagesQuery = query(
      collection(db, 'notebooks', notebookId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const messagesUnsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotebookMessage[]);
      setLoading(false);
    });

    return () => {
      notebookUnsubscribe();
      sourcesUnsubscribe();
      messagesUnsubscribe();
    };
  }, [user, notebookId]);

  const addSource = async (source: Omit<NotebookSource, 'id' | 'createdAt' | 'userId'>) => {
    if (!user || !notebookId) return;
    await addDoc(collection(db, 'notebooks', notebookId, 'sources'), {
      ...source,
      userId: user.uid,
      createdAt: serverTimestamp()
    });
  };

  const deleteSource = async (sourceId: string) => {
    if (!notebookId) return;
    await deleteDoc(doc(db, 'notebooks', notebookId, 'sources', sourceId));
  };

  const addMessage = async (content: string, role: 'user' | 'assistant', citations: string[] = []) => {
    if (!user || !notebookId) return;
    await addDoc(collection(db, 'notebooks', notebookId, 'messages'), {
      notebookId,
      userId: user.uid,
      role,
      content,
      citations,
      createdAt: serverTimestamp()
    });
  };

  return { notebook, sources, messages, loading, addSource, deleteSource, addMessage };
}
