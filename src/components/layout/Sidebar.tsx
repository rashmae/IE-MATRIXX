import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  BookOpen, 
  TrendingUp, 
  FolderOpen, 
  Megaphone, 
  CalendarDays,
  LogOut,
  User,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { User as UserType } from '@/src/types';

interface SidebarProps {
  user: UserType | null;
}

const navItems = [
  { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Course Catalog', icon: BookOpen, path: '/catalog' },
  { name: 'Study Hub', icon: BrainCircuit, path: '/study' },
  { name: 'My Progress', icon: TrendingUp, path: '/progress' },
  { name: 'Study Resources', icon: FolderOpen, path: '/resources' },
  { name: 'Bulletin Board', icon: Megaphone, path: '/bulletin' },
  { name: 'School Calendar', icon: CalendarDays, path: '/calendar' },
];

import { BrainCircuit } from 'lucide-react';
import ThemeToggle from '@/src/components/ThemeToggle';
import { toast } from 'sonner';

import { auth } from '@/src/lib/firebase';
import { signOut } from 'firebase/auth';

export default function Sidebar({ user }: SidebarProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('ctu_hub_session'); // Clean up old storage if any
      navigate('/login');
    } catch (error) {
      console.error("Logout error:", error);
      toast.error('Failed to logout');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <aside className="hidden lg:flex flex-col w-72 h-screen bg-background border-r border-foreground/5 sticky top-0 z-10 transition-colors duration-300">
      {/* Logo */}
      <div className="p-8 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* AI Robot Logo in Sidebar */}
          <div className="relative w-10 h-10 shrink-0" aria-hidden="true">
            <div className="absolute inset-0 bg-ctu-gold/20 rounded-full blur-lg animate-pulse" />
            <div className="relative w-full h-full neumorphic-raised rounded-full p-0.5 flex items-center justify-center bg-background overflow-hidden border border-white/5">
              <div className="absolute inset-0 border border-ctu-gold/20 rounded-full animate-[spin_10s_linear_infinite]" />
              
              <div className="relative w-7 h-7 rounded-full bg-gradient-to-br from-ctu-gold via-ctu-maroon to-navy-deep flex items-center justify-center shadow-inner overflow-hidden">
                <motion.div 
                  animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)] flex items-center justify-center"
                  role="img"
                  aria-label="IE Matrix AI Logo"
                >
                  <div className="w-2 h-2 rounded-full bg-navy-deep flex items-center justify-center">
                    <div className="w-1 h-1 rounded-full bg-ctu-gold animate-ping" />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
          <span className="text-xl font-display font-extrabold text-foreground tracking-tighter">CTU HUB</span>
        </div>
        <ThemeToggle className="neumorphic-raised" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-6 space-y-4 mt-4">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300",
              isActive 
                ? "bg-gradient-to-r from-ctu-gold to-ctu-maroon text-white shadow-lg shadow-ctu-maroon/20" 
                : "text-foreground/60 hover:text-foreground neumorphic-raised hover:neumorphic-pressed"
            )}
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} className={cn(isActive ? "text-white" : "text-foreground/40")} />
                {item.name}
              </>
            )}
          </NavLink>
        ))}
        
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300",
              isActive 
                ? "neumorphic-pressed text-ctu-maroon" 
                : "text-ctu-maroon/60 hover:text-ctu-maroon neumorphic-raised hover:neumorphic-pressed"
            )}
          >
            {({ isActive }) => (
              <>
                <ShieldCheck size={20} className={cn(isActive ? "text-ctu-maroon" : "text-ctu-maroon/40")} />
                Admin Portal
              </>
            )}
          </NavLink>
        )}

      </nav>

      {/* User Info */}
      <div className="p-6 border-t border-foreground/5 space-y-4">
        <button 
          onClick={() => navigate('/profile')}
          className="flex items-center gap-3 w-full text-left neumorphic-raised hover:neumorphic-pressed p-3 rounded-2xl transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-ctu-gold flex items-center justify-center text-navy-deep font-bold text-sm shadow-inner group-hover:scale-110 transition-transform">
            {user ? getInitials(user.fullName) : <User size={20} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{user?.fullName || 'Guest'}</p>
            <p className="text-[11px] text-foreground/40 truncate font-bold uppercase tracking-wider">{user?.idNumber || '00-00000-000'}</p>
          </div>
        </button>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-5 py-4 w-full rounded-2xl text-xs font-bold uppercase tracking-wider text-red-500 neumorphic-raised hover:neumorphic-pressed transition-all duration-300"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}
