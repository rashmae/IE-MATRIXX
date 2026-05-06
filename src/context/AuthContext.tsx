
import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { User } from '@/src/types';
import LoadingScreen from '@/src/components/LoadingScreen';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous profile listener if it exists
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setUser(firebaseUser);
      
      if (firebaseUser) {
        const path = `users/${firebaseUser.uid}`;
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as User);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          // If the error is just "permission-denied" and the user is null, 
          // it likely means they just signed out, so we ignore it.
          if (error.code === 'permission-denied' && !auth.currentUser) {
            console.log('[Auth] Profiler listener detached on sign-out');
          } else {
            handleFirestoreError(error, OperationType.GET, path);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = React.useMemo(() => ({
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || (user?.email ? ['rashmae26@gmail.com', 'rashmaeansay@gmail.com'].includes(user.email) : false)
  }), [user, profile, loading]);

  return (
    <AuthContext.Provider value={value}>
      {loading ? <LoadingScreen /> : children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
