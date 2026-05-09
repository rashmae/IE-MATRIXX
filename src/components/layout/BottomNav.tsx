import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  TrendingUp, 
  Megaphone, 
  User,
  Sparkles,
  CalendarDays,
  FolderOpen,
  MoreHorizontal,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'motion/react';

import { useNotifications } from '@/src/hooks/useNotifications';

const mainNavItems = [
  { name: 'Home', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Board', icon: Megaphone, path: '/bulletin', hasBadge: true },
  { name: 'Study', icon: Sparkles, path: '/study' },
  { name: 'Catalog', icon: BookOpen, path: '/catalog' },
  { name: 'GWA', icon: TrendingUp, path: '/progress' },
];

const extraItems = [
  { name: 'Notes', icon: FolderOpen, path: '/resources' },
  { name: 'Calendar', icon: CalendarDays, path: '/calendar' },
  { name: 'User', icon: User, path: '/profile' },
];

export default function BottomNav() {
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const { scrollY } = useScroll();
  const lastScrollY = useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    // Show if scrolling up or at top
    if (latest < lastScrollY.current || latest < 50) {
      setIsVisible(true);
    } 
    // Hide if scrolling down and not at top
    else if (latest > 100 && latest > lastScrollY.current) {
      setIsVisible(false);
      setIsMenuOpen(false); // Close menu if open while hiding
    }
    lastScrollY.current = latest;
  });

  // Always show on route change
  useEffect(() => {
    setIsVisible(true);
  }, [location.pathname]);

  // Check if current path is in the main nav or extra menu
  const isMainActive = mainNavItems.some(item => location.pathname === item.path);
  const isExtraActive = extraItems.some(item => location.pathname === item.path);

  return (
    <>
      {/* Extra Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="lg:hidden fixed bottom-24 left-1/2 -translate-x-1/2 w-[90vw] max-w-[360px] z-[60]"
          >
            <div className="neumorphic-raised bg-background/95 backdrop-blur-xl rounded-[2.5rem] p-4 border border-foreground/5 shadow-2xl">
              <div className="grid grid-cols-3 gap-4">
                {extraItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMenuOpen(false)}
                    className={({ isActive }) => cn(
                      "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all duration-300",
                      isActive ? "bg-ctu-maroon text-white shadow-lg" : "text-foreground/40 hover:text-foreground/60 neumorphic-raised"
                    )}
                  >
                    <item.icon size={22} className={cn("shrink-0", (location.pathname === item.path) && "text-white")} />
                    <span className="text-[9px] font-black uppercase tracking-widest">{item.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.nav 
        initial={false}
        animate={{ 
          y: isVisible ? 0 : 120,
          opacity: isVisible ? 1 : 0
        }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-background/90 backdrop-blur-2xl rounded-[32px] neumorphic-raised p-1.5 z-50 border border-foreground/5 w-[94vw] max-w-[480px]"
      >
        <div className="flex items-center justify-between gap-1.5 overflow-hidden">
          {mainNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) => cn(
                "relative flex items-center justify-center h-12 transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] rounded-[30px] overflow-hidden group tap-target shrink-0",
                isActive 
                  ? "flex-[2.5] bg-ctu-maroon text-white neumorphic-raised shadow-ctu-maroon/20" 
                  : "flex-1 bg-foreground/5 text-foreground/30 border border-foreground/5"
              )}
              style={{ minWidth: '40px' }}
            >
              {({ isActive }) => (
                <div className="flex items-center gap-2 px-3 relative">
                  <div className="relative">
                    <item.icon size={18} className={cn("shrink-0", isActive && "text-ctu-gold")} />
                    {item.hasBadge && unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ctu-gold opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-ctu-gold border border-ctu-maroon"></span>
                      </span>
                    )}
                  </div>
                  <AnimatePresence>
                    {isActive && (
                      <motion.span
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: "auto", opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </NavLink>
          ))}

          {/* More Menu Trigger */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={cn(
              "relative flex items-center justify-center h-12 transition-all duration-500 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] rounded-[30px] overflow-hidden group tap-target shrink-0",
              isMenuOpen || (isExtraActive && !isMainActive)
                ? "flex-[2.2] bg-ctu-maroon text-white neumorphic-raised shadow-ctu-maroon/20" 
                : "flex-1 bg-foreground/5 text-foreground/30 border border-foreground/5"
            )}
            style={{ minWidth: '40px' }}
          >
            <div className="flex items-center gap-2 px-3">
              {isMenuOpen ? <X size={18} className="text-white" /> : <MoreHorizontal size={18} className={cn(isExtraActive && "text-ctu-gold")} />}
              <AnimatePresence>
                {(isMenuOpen || isExtraActive) && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden"
                  >
                    {isMenuOpen ? "Close" : extraItems.find(i => location.pathname === i.path)?.name || "More"}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </button>
        </div>
      </motion.nav>
      
      {/* Dimmer for Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMenuOpen(false)}
            className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-[55]"
          />
        )}
      </AnimatePresence>
    </>
  );
}
