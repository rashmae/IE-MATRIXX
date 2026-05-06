import { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  Timestamp,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/context/AuthContext';
import { Notification } from '@/src/types';
import { toast } from 'sonner';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const path = 'notifications';
    const q = query(
      collection(db, path),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Notification[] = [];
      let unread = 0;
      let newestNotification: Notification | null = null;
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && !isFirstLoad.current) {
          const data = change.doc.data() as Notification;
          if (!data.read) {
            newestNotification = { id: change.doc.id, ...data };
          }
        }
      });

      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({ id: doc.id, ...data } as Notification);
        if (!data.read) unread++;
      });
      
      if (newestNotification) {
        toast.info((newestNotification as Notification).title, {
          description: (newestNotification as Notification).message,
          action: (newestNotification as Notification).link ? {
            label: 'View',
            onClick: () => window.location.href = (newestNotification as Notification).link!
          } : undefined
        });
      }

      setNotifications(msgs);
      setUnreadCount(unread);
      setLoading(false);
      isFirstLoad.current = false;
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      const docRef = doc(db, 'notifications', id);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!user || notifications.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        if (!n.read) {
          const docRef = doc(db, 'notifications', n.id);
          batch.update(docRef, { read: true });
        }
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const clearAll = async () => {
    if (!user || notifications.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        const docRef = doc(db, 'notifications', n.id);
        batch.delete(docRef);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  return {
    notifications,
    loading,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll
  };
}
