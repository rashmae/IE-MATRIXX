import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Trash2, 
  Check, 
  ArrowLeft,
  Filter,
  Search,
  Settings as SettingsIcon,
  X,
  LayoutDashboard,
  Megaphone,
  Trophy,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/context/AuthContext';
import { useNotifications } from '@/src/hooks/useNotifications';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import MobileHeader from '@/src/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import NotificationsList from '@/src/components/layout/NotificationsList';

export default function Notifications() {
  const { profile, loading: authLoading } = useAuth();
  const { unreadCount, markAllAsRead, clearAll, requestPermission } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | 'all'>('all');
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!authLoading && !profile) {
      navigate('/login');
    }
  }, [profile, authLoading, navigate]);

  if (authLoading || !profile) {
    return (
      <div className="min-h-screen bg-background flex">
        <Sidebar user={null} />
        <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36">
          <div className="h-20 neumorphic-pressed rounded-3xl animate-pulse mb-8" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 neumorphic-pressed rounded-2xl animate-pulse" />
            ))}
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={profile} />
      
      <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
        <MobileHeader />

        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-ctu-maroon/10 flex items-center justify-center text-ctu-maroon">
                  <Bell size={20} />
                </div>
                <h1 className="text-4xl sm:text-6xl font-black tracking-tighter frosted-header uppercase">
                  Alerts
                </h1>
              </div>
              <p className="text-foreground/40 font-bold uppercase tracking-widest text-[10px] ml-1">
                {unreadCount} Unread Notifications in Matrix
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => markAllAsRead()}
                className="neumorphic-raised hover:neumorphic-pressed border-none rounded-xl h-12 px-6 text-[10px] font-black uppercase tracking-widest gap-2"
              >
                <Check size={16} /> Mark all read
              </Button>
              <Button 
                variant="outline" 
                onClick={() => clearAll()}
                className="neumorphic-raised hover:neumorphic-pressed border-none rounded-xl h-12 px-6 text-[10px] font-black uppercase tracking-widest gap-2 text-red-500"
              >
                <Trash2 size={16} /> Clear list
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Sidebar / Filters */}
            <div className="space-y-6">
              <div className="neumorphic-card p-6">
                <h3 className="text-[10px] font-black text-foreground/40 uppercase tracking-[2px] mb-4">Channels</h3>
                <div className="space-y-1">
                  {[
                    { id: 'all', label: 'All Alerts', icon: LayoutDashboard },
                    { id: 'announcement', label: 'Bulletin', icon: Megaphone },
                    { id: 'success', label: 'Achievements', icon: Trophy },
                    { id: 'warning', label: 'Deadlines', icon: Clock },
                  ].map(chan => (
                    <button
                      key={chan.id}
                      onClick={() => setFilterType(chan.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all",
                        filterType === chan.id 
                          ? "bg-ctu-maroon text-white shadow-lg" 
                          : "text-foreground/40 hover:text-foreground/60"
                      )}
                    >
                      <chan.icon size={16} />
                      {chan.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="neumorphic-card p-6 bg-ctu-gold/5 border-none">
                <h3 className="text-[10px] font-black text-ctu-gold uppercase tracking-[2px] mb-3">Browser Sync</h3>
                <p className="text-xs text-foreground/60 font-medium mb-4 leading-relaxed">
                  Get real-time push alerts even when the matrix is closed.
                </p>
                <Button 
                  onClick={async () => {
                    const ok = await requestPermission();
                    if (ok) toast.success("Browser notifications enabled!");
                    else toast.error("Permission denied. Check browser settings.");
                  }}
                  className="w-full bg-ctu-gold text-navy-deep font-black uppercase text-[10px] tracking-widest rounded-xl"
                >
                  Enable Sync
                </Button>
              </div>
            </div>

            {/* List */}
            <div className="md:col-span-3">
              <div className="neumorphic-card p-2 sm:p-4">
                <NotificationsList maxItems={50} filterType={filterType} />
              </div>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
