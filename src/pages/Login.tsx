import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { LiquidButton, GlassFilter } from '@/components/ui/liquid-glass';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { SplineScene } from '@/components/ui/splite';
import { Spotlight } from '@/components/ui/spotlight';
import { db, signInWithGoogle } from '@/src/lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { LogIn, BookOpen, Sparkles, Shield, GraduationCap, ChevronRight } from 'lucide-react';
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
  const [sloganIndex, setSloganIndex] = useState(0);
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const slogans = [
    "IE INDUSTRIAL ENGINEERING PORTAL",
    "71 CORE IE SUBJECTS CATALOGED",
    "OPTIMIZE YOUR ACADEMIC PLAN",
    "THE MATRIX OF IE EXCELLENCE",
    "EMPOWERING FUTURE ENGINEERS"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % slogans.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

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
      const authUser = await signInWithGoogle();
      const userRef = doc(db, 'users', authUser.uid);
      
      const userData = {
        uid: authUser.uid,
        fullName: fullName,
        idNumber: idNumber,
        yearLevel: yearLevel,
        email: authUser.email,
        role: authUser.email === import.meta.env.VITE_ADMIN_EMAIL ? 'admin' : 'student',
        lastLogin: serverTimestamp(),
      };

      await setDoc(userRef, userData, { merge: true }).catch(err => handleFirestoreError(err, 'write', `users/${authUser.uid}`));

      toast.success('Welcome to IE MATRIX!');
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
      
      {/* Left Panel: Branding & AI Robot */}
      <div className="hidden md:flex flex-1 items-center justify-center relative overflow-hidden z-10">
        {/* Animated Gradient Background */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-ctu-gold/20 via-navy-deep to-black animate-pulse opacity-50" />
        
        <Spotlight
          className="-top-40 left-0 md:left-60 md:-top-20"
          fill="white"
        />
        
        <div className="absolute inset-0 z-0 opacity-40">
          <SplineScene 
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
        </div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="z-10 text-center pointer-events-none flex flex-col items-center"
        >
          {/* Main Typography Header Section */}
          <div className="mb-12">
            <h1 className="text-8xl md:text-9xl font-display font-black tracking-tighter drop-shadow-2xl text-foreground mb-4 frosted-header">
               IE MATRIX
            </h1>
            <div className="flex flex-col items-center min-h-[80px]">
              <AnimatePresence mode="wait">
                <motion.span 
                  key={sloganIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5 }}
                  className="text-ctu-gold font-bold text-2xl tracking-[0.2em] uppercase mb-1 drop-shadow-md text-center max-w-[500px]"
                >
                  {slogans[sloganIndex]}
                </motion.span>
              </AnimatePresence>
              <span className="text-foreground/40 font-light text-lg tracking-widest uppercase">
                Cebu Technological University
              </span>
            </div>
          </div>

          {/* Realistic AI/Robot Mascot (Repositioned Lower) */}
          <div className="relative w-48 h-48 group mt-12 mb-8">
            <div className="absolute inset-0 bg-ctu-gold/30 rounded-full blur-3xl animate-pulse" />
            <div className="relative w-full h-full neumorphic-raised rounded-full p-1.5 flex items-center justify-center bg-background overflow-hidden border border-white/10">
              {/* Outer Rings */}
              <div className="absolute inset-0 border-2 border-ctu-gold/30 rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="absolute inset-4 border border-ctu-maroon/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
              
              {/* Core AI Eye */}
              <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-ctu-gold via-ctu-maroon to-navy-deep flex items-center justify-center shadow-inner overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_70%)]" />
                <motion.div 
                  animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-16 h-16 rounded-full bg-white shadow-[0_0_30px_rgba(255,255,255,0.8)] flex items-center justify-center"
                >
                  <div className="w-8 h-8 rounded-full bg-navy-deep flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-ctu-gold animate-ping" />
                  </div>
                </motion.div>
                <div className="absolute inset-0 w-full h-2 bg-white/20 blur-sm animate-[scan_4s_linear_infinite]" />
              </div>
            </div>

            {/* Floating Stat Badges */}
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="absolute -left-20 top-0 glass-card px-4 py-2 flex items-center gap-2 shadow-2xl scale-90"
            >
              <div className="p-1.5 bg-ctu-gold/20 rounded-lg text-ctu-gold">
                <BookOpen size={14} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">IE Curriculum</span>
            </motion.div>

            <motion.div 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.4 }}
              className="absolute -right-20 top-20 glass-card px-4 py-2 flex items-center gap-2 shadow-2xl scale-90"
            >
              <div className="p-1.5 bg-ctu-maroon/20 rounded-lg text-ctu-maroon">
                <Sparkles size={14} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">AI-Powered</span>
            </motion.div>

            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.6 }}
              className="absolute left-1/2 -translate-x-1/2 -bottom-6 glass-card px-4 py-2 flex items-center gap-2 shadow-2xl scale-90"
            >
              <div className="p-1.5 bg-foreground/10 rounded-lg text-foreground">
                <Shield size={14} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-tighter">IE Official</span>
            </motion.div>
          </div>

          <p className="text-ctu-gold/80 text-xl font-display italic tracking-wide mt-4">
            Excellence in Engineering Education
          </p>
        </motion.div>
      </div>

      {/* Mobile Branding */}
      <div className="md:hidden pt-12 pb-4 text-center z-10 space-y-4">
         <h1 className="text-5xl font-display font-black tracking-tighter text-foreground">IE MATRIX</h1>
         <div className="min-h-[40px] px-4">
            <AnimatePresence mode="wait">
              <motion.div 
                key={sloganIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="text-[10px] tracking-[0.2em] font-bold text-ctu-gold uppercase"
              >
                {slogans[sloganIndex]}
              </motion.div>
            </AnimatePresence>
         </div>
      </div>

      {/* Right Panel: Login Form */}
      <div className="flex-1 flex items-start md:items-center justify-center p-6 md:p-6 z-10">
        <motion.div 
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="w-full max-w-md neumorphic-card p-8 md:p-10 relative overflow-hidden"
        >
          {/* CTU Logo Placeholder */}
          <div className="flex justify-center mb-10">
            <div className="w-20 h-20 bg-gradient-to-br from-ctu-gold to-ctu-maroon rounded-2xl flex items-center justify-center shadow-lg relative p-4 group">
               <GraduationCap size={40} className="text-white group-hover:scale-110 transition-transform" />
               <div className="absolute -inset-1 bg-white/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="mb-10 text-center md:text-left">
            <h2 className="text-4xl font-display font-medium mb-2">Welcome Back</h2>
            <p className="text-sm text-foreground/40 font-medium tracking-wide">Enter your credentials to access the matrix</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-xs text-foreground/60 font-bold ml-1 uppercase tracking-widest">Full Name</Label>
              <Input 
                id="fullName"
                placeholder="Dela Cruz, Juan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-background border-2 border-transparent focus:border-ctu-gold/50 neumorphic-pressed h-14 rounded-2xl transition-all font-sans"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="idNumber" className="text-xs text-foreground/60 font-bold ml-1 uppercase tracking-widest">ID Number</Label>
              <Input 
                id="idNumber"
                placeholder="XX-XXXXX-XXX"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="bg-background border-2 border-transparent focus:border-ctu-gold/50 neumorphic-pressed h-14 rounded-2xl transition-all font-sans"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-foreground/60 font-bold ml-1 uppercase tracking-widest">Year Level</Label>
              <Select onValueChange={setYearLevel} value={yearLevel}>
                <SelectTrigger className="bg-background border-2 border-transparent focus:border-ctu-gold/50 neumorphic-pressed h-14 rounded-2xl transition-all w-full font-sans">
                  <SelectValue placeholder="Select Year" />
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

            <div className="pt-8">
              <LiquidButton 
                type="submit" 
                disabled={loading} 
                className="bg-gradient-to-r from-ctu-gold via-ctu-gold to-ctu-maroon hover:opacity-95 shadow-[0_20px_40px_rgba(146,93,252,0.3)] transition-all duration-300 rounded-2xl min-h-[72px] w-full border-none group"
              >
                <div className="flex items-center justify-center gap-3 w-full h-full text-white">
                  {loading ? (
                    <span className="animate-pulse font-bold text-lg">Initializing...</span>
                  ) : (
                    <>
                      <span className="font-accent font-bold text-xl tracking-tight">Enter the Matrix</span>
                      <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </div>
              </LiquidButton>
              <p className="text-[10px] text-foreground/30 text-center mt-6 font-bold uppercase tracking-[0.2em] whitespace-nowrap">
                Requires Campus-Verified Google Auth
              </p>
            </div>
          </form>

          <div className="mt-12 pt-8 border-t border-foreground/5 text-center">
            <p className="text-[11px] font-medium text-foreground/40 leading-relaxed">
               For IE students of Cebu Technological University <br />
               Academic Year 2025-2026
            </p>
            <p className="mt-4 text-[9px] font-bold uppercase tracking-widest text-foreground/10">
              © 2026 IE MATRIX · Industrial Engineering Department
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
