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
import { MatrixNotification as MatrixNotificationType } from '@/src/types/index';
import { toast } from 'sonner';

export function useNotifications() {
  const { profile } = useAuth(); // AuthContext uses profile
  const [notifications, setNotifications] = useState<MatrixNotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (!profile) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const path = 'notifications';
    const q = query(
      collection(db, path),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: MatrixNotificationType[] = [];
      let unread = 0;
      let newestNotification: MatrixNotificationType | null = null;
      
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && !isFirstLoad.current) {
          const data = change.doc.data() as MatrixNotificationType;
          if (!data.read) {
            newestNotification = { id: change.doc.id, ...data };
          }
        }
      });

      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({ id: doc.id, ...data } as MatrixNotificationType);
        if (!data.read) unread++;
      });
      
      if (newestNotification) {
        // Sonner Toast
        toast.info((newestNotification as MatrixNotificationType).title, {
          description: (newestNotification as MatrixNotificationType).message,
          action: (newestNotification as MatrixNotificationType).link ? {
            label: 'View',
            onClick: () => window.location.href = (newestNotification as MatrixNotificationType).link!
          } : undefined
        });

        // Browser Notification
        if (typeof window !== 'undefined' && "Notification" in window && window.Notification.permission === "granted") {
          new window.Notification((newestNotification as MatrixNotificationType).title, {
            body: (newestNotification as MatrixNotificationType).message,
            icon: '/icon-192x192.png' // Adjust to project's icon if available
          });
        }
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
  }, [profile]);

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !("Notification" in window)) return false;
    
    if (window.Notification.permission === "granted") return true;
    
    if (window.Notification.permission !== "denied") {
      const permission = await window.Notification.requestPermission();
      return permission === "granted";
    }
    
    return false;
  };

  const markAsRead = async (id: string) => {
    try {
      const docRef = doc(db, 'notifications', id);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    if (!profile || notifications.length === 0) return;
    
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
    if (!profile || notifications.length === 0) return;
    
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
    clearAll,
    requestPermission
  };
}
