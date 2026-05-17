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
  ShieldCheck,
  BrainCircuit
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { User as UserType } from '@/src/types';

interface SidebarProps {
  user: UserType | null;
  hideBranding?: boolean;
  hideActions?: boolean;
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

import ThemeToggle from '@/src/components/ThemeToggle';
import NotificationCenter from './NotificationCenter';
import { toast } from 'sonner';

import { auth } from '@/src/lib/firebase';
import { signOut } from 'firebase/auth';

export default function Sidebar({ user, hideBranding = false, hideActions = false }: SidebarProps) {
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
      {/* Logo Area */}
      {!hideBranding && (
        <div className="p-8 pb-3 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* AI Robot Logo in Sidebar - Enhanced with technical rotation */}
              <div className="relative w-12 h-12 shrink-0 group cursor-pointer" aria-hidden="true" onClick={() => navigate('/dashboard')}>
                <div className="absolute inset-0 bg-ctu-gold/40 rounded-2xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative w-full h-full neumorphic-raised rounded-2xl p-1 flex items-center justify-center bg-background overflow-hidden border border-white/10 group-active:neumorphic-pressed transition-all">
                  <div className="absolute inset-x-0 top-1/2 h-[1px] bg-ctu-gold/20 -translate-y-1/2 rotate-[15deg] group-hover:rotate-[195deg] transition-transform duration-1000" />
                  <div className="absolute inset-y-0 left-1/2 w-[1px] bg-ctu-gold/20 -translate-x-1/2 -rotate-[15deg] group-hover:rotate-[-195deg] transition-transform duration-1000" />
                  
                  <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-ctu-gold via-ctu-maroon to-navy-deep flex items-center justify-center shadow-inner overflow-hidden border border-white/20">
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.15, 1], 
                        rotate: [0, 5, -5, 0],
                        filter: ['brightness(1)', 'brightness(1.2)', 'brightness(1)']
                      }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                      className="w-5 h-5 rounded-lg bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.6)] flex items-center justify-center"
                    >
                      <div className="w-2.5 h-2.5 rounded-sm bg-navy-deep flex items-center justify-center">
                        <div className="w-1 h-1 rounded-full bg-ctu-gold animate-ping" />
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tighter frosted-header leading-none select-none relative">
                  IE MATRIX
                  <span className="absolute -right-6 -top-1 px-1 py-0.5 bg-ctu-maroon/10 text-[7px] text-ctu-maroon rounded border border-ctu-maroon/20 font-black">v2.0</span>
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-foreground/40 mt-1.5 flex items-center gap-1.5 leading-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  System Secure
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Actions (Theme/Notifs) - Grouped Control Strip */}
      <div className="px-6 flex items-center gap-3 mb-6 mt-2">
        {!hideActions && (
          <div className="flex-1 flex items-center gap-1 p-1 neumorphic-pressed rounded-2xl bg-foreground/[0.03]">
            <NotificationCenter />
            <div className="w-px h-6 bg-foreground/10 mx-1 shrink-0" />
            <ThemeToggle className="neumorphic-raised shrink-0 border-none !shadow-none hover:bg-foreground/[0.05] flex-1 rounded-xl h-11" />
          </div>
        )}
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
        {!hideActions ? (
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
        ) : (
          <div className="p-3 rounded-2xl opacity-0 h-[64px]" /> // Placeholder to keep height consistent
        )}
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
