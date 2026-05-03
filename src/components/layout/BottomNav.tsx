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

const navItems = [
  { name: 'Home', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Catalog', icon: BookOpen, path: '/catalog' },
  { name: 'Study', icon: Sparkles, path: '/study' },
  { name: 'Progress', icon: TrendingUp, path: '/progress' },
  { name: 'Board', icon: Megaphone, path: '/bulletin' },
  { name: 'Calendar', icon: CalendarDays, path: '/calendar' },
  { name: 'Resources', icon: FolderOpen, path: '/resources' },
  { name: 'Profile', icon: User, path: '/profile' },
];

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-xl rounded-2xl neumorphic-raised px-2 py-2 z-50 transition-all duration-300 border border-foreground/5 w-[96%] max-w-[480px]">
      <div className="flex items-center justify-between gap-0.5 overflow-x-auto no-scrollbar">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-xl transition-all duration-300 flex-1 min-w-[40px]",
              isActive ? "neumorphic-pressed text-ctu-gold" : "text-foreground/30 hover:text-foreground/60"
            )}
            title={item.name}
          >
            {({ isActive }) => (
              <>
                <item.icon size={18} />
                <span className={cn(
                  "text-[9px] font-bold tracking-tight leading-none transition-all",
                  isActive ? "opacity-100" : "opacity-0 h-0 overflow-hidden"
                )}>
                  {item.name}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
