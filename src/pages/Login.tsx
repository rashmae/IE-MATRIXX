import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LiquidButton, GlassFilter } from '@/components/ui/liquid-glass';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { SplineScene } from '@/components/ui/splite';
import { Spotlight } from '@/components/ui/spotlight';
import { db, signInWithGoogle } from '@/src/lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { LogIn } from 'lucide-react';
import ThemeToggle from '@/src/components/ThemeToggle';
import { useAuth } from '@/src/context/AuthContext';
import { handleFirestoreError } from '@/src/lib/firestore-errors';

import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

export default function Login() {
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [yearLevel, setYearLevel] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user && profile) {
      navigate('/dashboard');
    }
  }, [user, profile, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !idNumber || !yearLevel) {
      toast.error('Please fill in all fields including year level');
      return;
    }

    const idRegex = /^(\d{2}-\d{5}-\d{3}|\d{5,10})$/;
    if (!idRegex.test(idNumber)) {
      toast.error('Invalid ID format. Use XX-XXXXX-XXX or your 7-digit ID');
      return;
    }

    setLoading(true);
    try {
      // 1. Sign in with Google
      const authUser = await signInWithGoogle();
      
      // 2. Check if user document exists
      const userRef = doc(db, 'users', authUser.uid);
      
      const userData = {
        uid: authUser.uid,
        fullName: fullName,
        idNumber: idNumber,
        yearLevel: yearLevel,
        email: authUser.email,
        role: authUser.email === 'rashmae26@gmail.com' ? 'admin' : 'student',
        lastLogin: serverTimestamp(),
      };

      // 3. Save/Update user in Firestore
      await setDoc(userRef, userData, { merge: true }).catch(err => handleFirestoreError(err, 'write', `users/${authUser.uid}`));

      toast.success('Welcome to IE Matrix!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        toast.error('This domain is not authorized in Firebase. Please add your URL to "Authorized Domains" in the Firebase Console.');
      } else {
        toast.error(error.message || 'Failed to sign in');
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row overflow-hidden bg-background relative transition-colors duration-500">
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <div className="absolute inset-0 z-0 bg-background opacity-50" />
      <GlassFilter />
      
      {/* Left Panel: Branding & 3D Scene */}
      <div className="hidden md:flex flex-1 items-center justify-center relative overflow-hidden z-10">
        <Spotlight
          className="-top-40 left-0 md:left-60 md:-top-20"
          fill="white"
        />
        
        <div className="absolute inset-0 z-0">
          <SplineScene 
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="z-10 text-center pointer-events-none"
        >
          {/* Realistic AI/Robot Logo */}
          <div className="relative w-32 h-32 mx-auto mb-8 group">
            <div className="absolute inset-0 bg-ctu-gold/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative w-full h-full neumorphic-raised rounded-full p-1 flex items-center justify-center bg-background overflow-hidden border border-white/10">
              {/* Outer Ring */}
              <div className="absolute inset-0 border-2 border-ctu-gold/30 rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="absolute inset-2 border border-ctu-maroon/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
              
              {/* Core AI Eye */}
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-ctu-gold via-ctu-maroon to-navy-deep flex items-center justify-center shadow-inner overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_70%)]" />
                
                {/* Iris/Pupil */}
                <motion.div 
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.8, 1, 0.8]
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-12 h-12 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.8)] flex items-center justify-center"
                >
                  <div className="w-6 h-6 rounded-full bg-navy-deep flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-ctu-gold animate-ping" />
                  </div>
                </motion.div>

                {/* Digital Scan Line */}
                <div className="absolute inset-0 w-full h-1 bg-white/20 blur-sm animate-[scan_4s_linear_infinite]" />
              </div>
            </div>
          </div>

          <h1 className="text-7xl frosted-header font-bold mb-2 tracking-tighter drop-shadow-lg text-foreground">IE MATRIX</h1>
          <p className="text-foreground/80 text-xl font-medium max-w-md mx-auto">
            Interactive 3D Curriculum Intelligence.
          </p>
        </motion.div>
      </div>

      {/* Mobile Branding & AI Robot */}
      <div className="md:hidden pt-12 pb-4 text-center z-10 space-y-6">
        <div className="relative w-24 h-24 mx-auto group">
          <div className="absolute inset-0 bg-ctu-gold/20 rounded-full blur-xl animate-pulse" />
          <div className="relative w-full h-full neumorphic-raised rounded-full p-1 flex items-center justify-center bg-background overflow-hidden border border-white/10 scale-75">
            <div className="absolute inset-0 border-2 border-ctu-gold/30 rounded-full animate-[spin_10s_linear_infinite]" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-ctu-gold via-ctu-maroon to-navy-deep flex items-center justify-center shadow-inner overflow-hidden">
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="w-8 h-8 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)] flex items-center justify-center"
              >
                <div className="w-4 h-4 rounded-full bg-navy-deep flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-ctu-gold animate-ping" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
        <h1 className="text-4xl frosted-header font-bold tracking-tighter">IE MATRIX</h1>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex-1 flex items-start md:items-center justify-center p-6 md:p-6 z-10">
        <motion.div 
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md neumorphic-card p-6 md:p-10"
        >
          <div className="mb-6 md:mb-8 text-center md:text-left">
            <h2 className="text-2xl md:text-3xl frosted-header font-bold mb-1">Welcome Back</h2>
            <p className="text-sm md:text-base text-foreground/60 font-medium">CTU Industrial Engineering Portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
            <div className="space-y-2 md:space-y-3">
              <Label htmlFor="fullName" className="text-xs md:text-sm text-foreground/70 font-bold ml-1">Full Name</Label>
              <Input 
                id="fullName"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-background border-none neumorphic-pressed h-12 md:h-14 rounded-2xl focus:ring-ctu-gold text-foreground placeholder:text-foreground/30 text-sm"
              />
            </div>

            <div className="space-y-2 md:space-y-3">
              <Label htmlFor="idNumber" className="text-xs md:text-sm text-foreground/70 font-bold ml-1">ID Number</Label>
              <Input 
                id="idNumber"
                placeholder="XX-XXXXX-XXX"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="bg-background border-none neumorphic-pressed h-12 md:h-14 rounded-2xl focus:ring-ctu-gold text-foreground placeholder:text-foreground/30 text-sm"
              />
            </div>

            <div className="space-y-2 md:space-y-3">
              <Label className="text-xs md:text-sm text-foreground/70 font-bold ml-1">Year Level</Label>
              <Select onValueChange={setYearLevel} value={yearLevel}>
                <SelectTrigger className="bg-background border-none neumorphic-pressed h-12 md:h-14 rounded-2xl focus:ring-ctu-gold text-foreground text-sm w-full shadow-none border-0">
                  <SelectValue placeholder="Select your year" />
                </SelectTrigger>
                <SelectContent className="bg-background border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                  <SelectItem value="1st Year">1st Year</SelectItem>
                  <SelectItem value="2nd Year">2nd Year</SelectItem>
                  <SelectItem value="3rd Year">3rd Year</SelectItem>
                  <SelectItem value="4th Year">4th Year</SelectItem>
                  <SelectItem value="Graduate">Graduate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="pt-6 md:pt-10">
              <LiquidButton 
                type="submit" 
                disabled={loading} 
                className="bg-gradient-to-r from-ctu-gold to-ctu-maroon hover:opacity-90 shadow-[0_10px_30px_rgba(146,93,252,0.3)] transition-all duration-300 rounded-2xl md:rounded-3xl min-h-[64px] md:min-h-[76px] w-full border-none"
              >
                <div className="flex items-center justify-center gap-3 md:gap-4 w-full h-full">
                  {loading ? (
                    <span className="animate-pulse text-white font-bold text-base md:text-lg">Connecting...</span>
                  ) : (
                    <>
                      <LogIn size={20} className="text-white md:w-6 md:h-6" />
                      <span className="text-white font-bold text-lg md:text-2xl tracking-tight">Enter Matrix</span>
                    </>
                  )}
                </div>
              </LiquidButton>
              <p className="text-[9px] md:text-[10px] text-foreground/40 text-center mt-6 font-bold uppercase tracking-widest whitespace-nowrap">
                * Requires Google Auth
              </p>
            </div>
          </form>

          <p className="mt-8 md:mt-10 text-center text-[9px] font-bold uppercase tracking-widest text-foreground/20">
            © 2026 CTU IE Dept.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
