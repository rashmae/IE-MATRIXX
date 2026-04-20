import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  TrendingUp, 
  Megaphone, 
  User,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Home', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Catalog', icon: BookOpen, path: '/catalog' },
  { name: 'Study', icon: Sparkles, path: '/study' },
  { name: 'Progress', icon: TrendingUp, path: '/progress' },
  { name: 'Board', icon: Megaphone, path: '/bulletin' },
  { name: 'Profile', icon: User, path: '/profile' },
];

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-xl rounded-full neumorphic-raised px-4 py-2 z-50 transition-all duration-300 border border-foreground/5 w-[90%] max-w-[400px]">
      <div className="flex items-center justify-between gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-300 flex-1 min-w-0 aspect-square",
              isActive ? "neumorphic-pressed text-ctu-gold" : "text-foreground/30 hover:text-foreground/60"
            )}
            title={item.name}
          >
            <item.icon size={20} />
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
