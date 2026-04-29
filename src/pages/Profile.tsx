import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Settings, 
  Download, 
  Bell, 
  Shield, 
  Smartphone, 
  Globe, 
  LogOut,
  ChevronRight,
  Monitor,
  Moon,
  Sun,
  Database,
  Camera,
  Upload,
  X
} from 'lucide-react';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User as UserType } from '@/src/types/index';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LiquidButton } from '@/components/ui/liquid-glass';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { useAuth } from '@/src/context/AuthContext';
import { auth, db } from '@/src/lib/firebase';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Profile() {
  const { profile: user, loading: authLoading } = useAuth();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [isUpdating, setIsUpdating] = useState(false);
  const [editData, setEditData] = useState({ fullName: '', yearLevel: '' });

  useEffect(() => {
    if (user) {
      setEditData({ fullName: user.fullName || '', yearLevel: user.yearLevel || '' });
    }
  }, [user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        fullName: editData.fullName,
        yearLevel: editData.yearLevel
      });
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile.');
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }

    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, [user, authLoading, navigate]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      toast.error('Failed to sign out.');
    }
  };

  const updateProfilePhoto = async (photoData: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { photoURL: photoData });
      toast.success('Profile photo updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile photo.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateProfilePhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraOpen(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      toast.error('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const photoData = canvas.toDataURL('image/jpeg');
        updateProfilePhoto(photoData);
        stopCamera();
      }
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={user} />
      
      <main className="flex-1 p-6 lg:p-10 pb-32 lg:pb-10 overflow-x-hidden">
        <div className="mb-12">
          <h1 className="text-7xl md:text-8xl frosted-header font-black tracking-tighter leading-[0.9] py-2">Profile</h1>
          <p className="text-foreground/40 mt-3 text-xl font-medium tracking-tight">Manage your account and application settings.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {/* Left Column: User Info */}
          <div className="space-y-10">
            <Card className="neumorphic-card border-none overflow-hidden">
              <div className="h-28 bg-gradient-to-r from-ctu-gold to-ctu-maroon" />
              <CardContent className="p-8 -mt-14 flex flex-col items-center text-center">
                <div className="relative group">
                  <div className="w-28 h-28 rounded-full bg-background border-4 border-background flex items-center justify-center text-4xl font-bold text-ctu-gold neumorphic-raised mb-6 overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(user.fullName)
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-full mb-6">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-all"
                      title="Upload Photo"
                    >
                      <Upload size={18} />
                    </button>
                    <button 
                      onClick={startCamera}
                      className="p-2 rounded-full bg-white/20 hover:bg-white/40 text-white transition-all"
                      title="Take Selfie"
                    >
                      <Camera size={18} />
                    </button>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handleFileUpload}
                  />
                </div>
                <h2 className="text-3xl font-bold text-foreground">{user.fullName}</h2>
                <div className="flex flex-col items-center gap-1 mt-2">
                  <p className="text-ctu-gold font-bold text-sm tracking-widest uppercase">{user.idNumber}</p>
                  <p className="text-foreground/40 text-xs font-medium">{user.email}</p>
                </div>
                
                <div className="flex flex-wrap justify-center gap-3 mt-6">
                  <Badge className="neumorphic-pressed text-foreground/60 border-none px-4 py-1.5 rounded-full text-[10px] uppercase font-bold">BSIE Student</Badge>
                  <Badge className="neumorphic-pressed text-ctu-gold border-none px-4 py-1.5 rounded-full text-[10px] uppercase font-bold">{user.yearLevel || 'Year Not Set'}</Badge>
                  <Badge className="bg-ctu-maroon/20 text-ctu-maroon border-none px-4 py-1.5 rounded-full text-[10px] uppercase font-bold">Active</Badge>
                </div>

                <div className="w-full mt-8">
                  <Dialog>
                    <DialogTrigger
                      render={
                        <Button variant="outline" className="w-full rounded-2xl neumorphic-raised border-none text-xs font-bold uppercase tracking-widest gap-2" />
                      }
                    >
                      <Settings size={14} /> Edit Profile
                    </DialogTrigger>
                    <DialogContent className="neumorphic-card border-none rounded-[32px] max-w-md p-0 overflow-hidden">
                      <div className="p-8 border-b border-foreground/5">
                        <DialogTitle className="text-2xl font-bold">Personal Information</DialogTitle>
                        <p className="text-xs text-foreground/40 font-bold uppercase tracking-widest mt-1">Update your matrix credentials</p>
                      </div>
                      <div className="p-8 space-y-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest ml-1">Full Name</Label>
                          <Input 
                            defaultValue={user.fullName} 
                            onChange={(e) => setEditData({...editData, fullName: e.target.value})}
                            className="bg-background border-none neumorphic-pressed h-14 rounded-2xl px-6"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest ml-1">Year Level</Label>
                          <Select 
                            defaultValue={user.yearLevel} 
                            onValueChange={(val) => setEditData({...editData, yearLevel: val})}
                          >
                            <SelectTrigger className="bg-background border-none neumorphic-pressed h-14 rounded-2xl px-6 w-full shadow-none">
                              <SelectValue placeholder="Select year" />
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
                        <Button 
                          onClick={handleUpdateProfile}
                          disabled={isUpdating}
                          className="w-full h-14 bg-ctu-maroon text-white font-bold rounded-2xl shadow-lg mt-4"
                        >
                          {isUpdating ? 'Saving...' : 'Save Changes'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            <Card className="neumorphic-card border-none">
              <CardHeader className="pb-4">
                <CardTitle className="text-xs font-bold text-ctu-gold uppercase tracking-widest">App Version</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/40 font-bold uppercase tracking-widest">Current Version</span>
                  <span className="text-sm font-bold text-foreground">v2.4.0-prospectus</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground/40 font-bold uppercase tracking-widest">Curriculum Year</span>
                  <span className="text-sm font-bold text-foreground">2021-2022</span>
                </div>
                <button 
                  onClick={() => toast.info('Checking for updates...')}
                  className="w-full py-3 neumorphic-raised hover:neumorphic-pressed rounded-2xl text-foreground font-bold text-xs transition-all uppercase tracking-widest"
                >
                  Check for Updates
                </button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Settings & Features */}
          <div className="lg:col-span-2 space-y-10">
            {/* Settings Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Account Settings */}
              <Card className="neumorphic-card border-none">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl flex items-center gap-3 font-bold">
                    <div className="p-2 rounded-xl neumorphic-pressed text-ctu-gold">
                      <Settings size={20} />
                    </div>
                    Account Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { icon: User, label: 'Personal Information' },
                    { icon: Shield, label: 'Security & Password' },
                    { icon: Bell, label: 'Notification Preferences' },
                    { icon: Globe, label: 'Language (English)' },
                  ].map((item, i) => (
                    <button 
                      key={i} 
                      onClick={() => toast.info(`${item.label} settings coming soon in v2.5`)}
                      className="w-full flex items-center justify-between p-4 rounded-2xl neumorphic-raised hover:neumorphic-pressed transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <item.icon size={20} className="text-foreground/40 group-hover:text-ctu-gold transition-colors" />
                        <span className="text-sm font-bold text-foreground/80">{item.label}</span>
                      </div>
                      <ChevronRight size={18} className="text-foreground/20" />
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Preferences */}
              <Card className="neumorphic-card border-none">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl flex items-center gap-3 font-bold">
                    <div className="p-2 rounded-xl neumorphic-pressed text-ctu-gold">
                      <Monitor size={20} />
                    </div>
                    Preferences
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <button 
                    onClick={toggleTheme}
                    className="w-full flex items-center justify-between p-5 rounded-2xl neumorphic-pressed group transition-all"
                  >
                    <div className="flex items-center gap-4">
                      {theme === 'dark' ? (
                        <Moon size={20} className="text-ctu-gold" />
                      ) : (
                        <Sun size={20} className="text-ctu-gold" />
                      )}
                      <span className="text-sm font-bold text-foreground/80">
                        {theme === 'dark' ? 'Dark Mode Active' : 'Light Mode Active'}
                      </span>
                    </div>
                    <div className={cn(
                      "w-12 h-6 rounded-full relative shadow-inner transition-colors duration-300",
                      theme === 'dark' ? "bg-ctu-gold" : "bg-foreground/10"
                    )}>
                      <div className={cn(
                        "absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300",
                        theme === 'dark' ? "right-1" : "left-1"
                      )} />
                    </div>
                  </button>
                  <button 
                    onClick={() => toast.info('Cache cleared successfully.')}
                    className="w-full flex items-center justify-between p-4 rounded-2xl neumorphic-raised hover:neumorphic-pressed transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <Database size={20} className="text-foreground/40 group-hover:text-ctu-gold transition-colors" />
                      <span className="text-sm font-bold text-foreground/80">Clear Local Cache</span>
                    </div>
                    <ChevronRight size={18} className="text-foreground/20" />
                  </button>
                </CardContent>
              </Card>
            </div>

            {/* Download App Section */}
            <Card className="neumorphic-card border-none bg-gradient-to-br from-ctu-maroon/[0.03] to-ctu-gold/[0.03]">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl flex items-center gap-4 font-bold">
                  <div className="p-3 rounded-2xl neumorphic-pressed text-ctu-gold">
                    <Smartphone size={28} />
                  </div>
                  Install IE Matrix Mobile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                <p className="text-foreground/60 text-base leading-relaxed font-medium">
                  Access your curriculum and track progress even when offline. IE Matrix is built as a Progressive Web App (PWA) for the best mobile experience.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-3xl neumorphic-pressed">
                    <h4 className="font-bold text-foreground mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] text-blue-500 font-bold">iOS</div>
                      For iPhone/iPad
                    </h4>
                    <ol className="text-xs text-foreground/40 space-y-3 list-decimal list-inside font-bold uppercase tracking-widest">
                      <li>Open <span className="text-foreground">Safari</span> and go to this URL</li>
                      <li>Tap the <span className="text-foreground">Share</span> icon</li>
                      <li>Tap <span className="text-foreground">Add to Home Screen</span></li>
                    </ol>
                  </div>
                  <div className="p-6 rounded-3xl neumorphic-pressed">
                    <h4 className="font-bold text-foreground mb-4 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-[10px] text-green-500 font-bold">AND</div>
                      For Android
                    </h4>
                    <ol className="text-xs text-foreground/40 space-y-3 list-decimal list-inside font-bold uppercase tracking-widest">
                      <li>Open <span className="text-foreground">Chrome</span> and go to this URL</li>
                      <li>Tap the <span className="text-foreground">three dots</span> menu</li>
                      <li>Tap <span className="text-foreground">Install App</span></li>
                    </ol>
                  </div>
                </div>

                <button 
                  onClick={() => toast.success('PWA Manifest is active. Follow instructions above!')}
                  className="w-full py-4 neumorphic-raised hover:neumorphic-pressed rounded-2xl flex items-center justify-center gap-3 text-foreground font-bold transition-all"
                >
                  <Download size={20} className="text-ctu-gold" />
                  Download Offline Assets
                </button>
              </CardContent>
            </Card>

            {/* Logout Button (Mobile) */}
            <div className="lg:hidden pt-4">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-3 p-5 rounded-3xl neumorphic-raised text-red-500 font-bold transition-all active:neumorphic-pressed"
              >
                <LogOut size={22} />
                Sign Out from IE Matrix
              </button>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Camera Modal */}
      <AnimatePresence>
        {isCameraOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-background rounded-3xl overflow-hidden max-w-md w-full neumorphic-card border-none"
            >
              <div className="p-6 border-b border-foreground/5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground">Take a Selfie</h3>
                <button onClick={stopCamera} className="text-foreground/40 hover:text-foreground">
                  <X size={24} />
                </button>
              </div>
              <div className="relative aspect-video bg-black">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-8 flex justify-center">
                <button 
                  onClick={takePhoto}
                  className="w-20 h-20 rounded-full border-8 border-ctu-gold/20 flex items-center justify-center bg-ctu-gold text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                  <Camera size={32} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
