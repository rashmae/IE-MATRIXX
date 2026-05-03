import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  TrendingUp, 
  Megaphone, 
  User,
  Sparkles,
  CalendarDays,
  FolderOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const navItems = [
  { name: 'Home', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Board', icon: Megaphone, path: '/bulletin' },
  { name: 'Catalog', icon: BookOpen, path: '/catalog' },
  { name: 'Study', icon: Sparkles, path: '/study' },
  { name: 'Calendar', icon: CalendarDays, path: '/calendar' },
  { name: 'Notes', icon: FolderOpen, path: '/resources' },
  { name: 'GWA', icon: TrendingUp, path: '/progress' },
  { name: 'User', icon: User, path: '/profile' },
];

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-xl rounded-[28px] neumorphic-raised px-2 py-2 z-50 transition-all duration-300 border border-foreground/5 w-[95%] max-w-[500px]">
      <div className="flex items-center justify-between gap-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center p-2.5 rounded-2xl transition-all duration-300 flex-1 min-w-0 h-14 relative group",
              isActive ? "neumorphic-pressed text-ctu-gold" : "text-foreground/30 hover:text-foreground/60 focus:outline-none"
            )}
            title={item.name}
          >
            {({ isActive }) => (
              <>
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="nav-glow"
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-ctu-gold shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                </AnimatePresence>
                <item.icon size={18} className="shrink-0 transition-transform group-active:scale-95" />
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="text-[7px] font-black uppercase tracking-tighter truncate w-full text-center mt-1"
                    >
                      {item.name}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
