import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  List as ListIcon,
  LayoutGrid,
  Info,
  Download,
  Share2
} from 'lucide-react';
import Sidebar from '@/src/components/layout/Sidebar';
import BottomNav from '@/src/components/layout/BottomNav';
import { User, CalendarEvent } from '@/src/types/index';
import { CALENDAR_EVENTS } from '@/src/lib/constants';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { useAuth } from '@/src/context/AuthContext';

export default function CalendarPage() {
  const { profile: user, loading: authLoading } = useAuth();
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const days = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return CALENDAR_EVENTS.filter(e => e.date === dateStr);
  };

  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const getEventColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'academic': return 'bg-ctu-maroon';
      case 'event': return 'bg-ctu-gold';
      case 'holiday': return 'bg-green-600';
      case 'reminder': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex">
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="skeleton h-16 w-48 rounded-xl mx-auto" />
          <div className="skeleton h-5 w-64 rounded-lg mx-auto" />
          <div className="mt-8 space-y-3 w-full max-w-lg px-8">
            <div className="skeleton h-12 w-full rounded-2xl" />
            <div className="skeleton h-12 w-full rounded-2xl" />
            <div className="skeleton h-12 w-3/4 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex transition-colors duration-300">
      <Sidebar user={user} />
      
      <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-36 lg:pb-10 overflow-x-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h1 className="text-4xl sm:text-6xl md:text-8xl frosted-header font-black tracking-tighter leading-[0.9] py-2">Calendar</h1>
            <p className="text-foreground/40 mt-3 text-xl font-medium tracking-tight">Academic schedule for the 2nd Semester AY 2025-2026.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button 
              onClick={() => toast.success("Connected to Google Calendar")}
              className="px-6 py-3 rounded-2xl neumorphic-raised hover:neumorphic-pressed text-xs font-bold text-foreground transition-all flex items-center gap-2 group"
            >
              <Share2 size={16} className="text-ctu-gold group-hover:rotate-12 transition-transform" />
              Sync to Calendar
            </button>
            
            <button 
              onClick={() => toast.success("Calendar exported as .ics")}
              className="p-3 rounded-2xl neumorphic-raised hover:neumorphic-pressed text-foreground transition-all"
              aria-label="Download calendar as iCal file"
            >
              <Download size={20} />
            </button>

            <div className="flex neumorphic-pressed p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('month')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'month' ? "bg-ctu-gold text-white shadow-lg" : "text-foreground/40 hover:text-foreground")}
            >
              <LayoutGrid size={20} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn("p-2 rounded-lg transition-all", viewMode === 'list' ? "bg-ctu-gold text-white shadow-lg" : "text-foreground/40 hover:text-foreground")}
            >
              <ListIcon size={20} />
            </button>
          </div>
        </div>
      </div>

        {viewMode === 'month' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Calendar Grid */}
            <Card className="neumorphic-card border-none lg:col-span-3">
              <CardHeader className="flex flex-row items-center justify-between border-b border-foreground/5 pb-6">
                <CardTitle className="text-2xl font-bold">
                  {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </CardTitle>
                <div className="flex gap-2">
                  <button onClick={prevMonth} className="p-2 neumorphic-raised hover:neumorphic-pressed rounded-lg transition-all"><ChevronLeft size={20} /></button>
                  <button onClick={nextMonth} className="p-2 neumorphic-raised hover:neumorphic-pressed rounded-lg transition-all"><ChevronRight size={20} /></button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-7 border-b border-foreground/5">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="py-4 text-center text-xs font-bold text-foreground/40 uppercase tracking-widest">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square border-r border-b border-foreground/5 bg-foreground/[0.02]" />
                  ))}
                  {Array.from({ length: days }).map((_, i) => {
                    const day = i + 1;
                    const events = getEventsForDay(day);
                    const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth();
                    
                    return (
                      <div key={day} 
                        onClick={() => setSelectedDay(selectedDay === day ? null : day)}
                        className={cn(
                          "aspect-square border-r border-b border-foreground/5 p-2 relative group hover:bg-foreground/[0.04] transition-colors cursor-pointer",
                          selectedDay === day && "bg-ctu-gold/10 ring-1 ring-inset ring-ctu-gold/30"
                        )}>
                        <span className={cn(
                          "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-all",
                          isToday ? "bg-ctu-gold text-white shadow-lg scale-110" : "text-foreground/60"
                        )}>
                          {day}
                        </span>
                        <div className="mt-1 space-y-1">
                          {events.map(e => (
                            <div key={e.id} className={cn("h-1.5 rounded-full", getEventColor(e.category))} title={e.title} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Side Panel: Event Details */}
            <div className="space-y-8">
              <div className="neumorphic-card p-6">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-6">
                  <Info size={20} className="text-ctu-gold" />
                  Legend
                </h3>
                <div className="space-y-4">
                  {[
                    { label: 'Academic', color: 'bg-ctu-maroon' },
                    { label: 'Event', color: 'bg-ctu-gold' },
                    { label: 'Holiday', color: 'bg-green-600' },
                    { label: 'Reminder', color: 'bg-blue-500' },
                  ].map(l => (
                    <div key={l.label} className="flex items-center gap-4 text-sm font-bold text-foreground/70">
                      <div className={cn("w-4 h-4 rounded-full shadow-sm", l.color)} />
                      {l.label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="neumorphic-card p-6">
                <h3 className="text-lg font-bold mb-6">
                  {selectedDay 
                    ? `${currentDate.toLocaleString('default', { month: 'short' })} ${selectedDay} Events` 
                    : "Today's Events"}
                </h3>
                <div className="space-y-4">
                  {(selectedDay ? getEventsForDay(selectedDay) : getEventsForDay(new Date().getDate())).length > 0 ? (
                    (selectedDay ? getEventsForDay(selectedDay) : getEventsForDay(new Date().getDate())).map(e => (
                      <div key={e.id} className={cn("p-4 rounded-2xl neumorphic-pressed border-l-4", 
                        e.category === 'academic' ? 'border-ctu-maroon' :
                        e.category === 'event' ? 'border-ctu-gold' :
                        e.category === 'holiday' ? 'border-green-600' : 'border-blue-500'
                      )}>
                        <h4 className="text-sm font-bold text-foreground">{e.title}</h4>
                        <p className="text-xs text-foreground/60 mt-1 font-medium">{e.description}</p>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/30 mt-2 block">{e.category}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-foreground/40 italic font-medium">
                      {selectedDay ? `No events on the ${selectedDay}th.` : 'No events scheduled for today.'}
                    </p>
                  )}
                </div>
                {selectedDay && (
                  <button onClick={() => setSelectedDay(null)} className="mt-4 text-xs text-foreground/40 hover:text-foreground/60 font-bold transition-colors">
                    ← Back to today
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-3xl mx-auto">
            {CALENDAR_EVENTS.map((event) => (
              <Card key={event.id} className="neumorphic-card border-none overflow-hidden">
                <CardContent className="p-0 flex">
                  <div className={cn("w-3 shrink-0", getEventColor(event.category))} />
                  <div className="p-8 flex-1 flex items-center gap-8">
                    <div className="flex flex-col items-center justify-center w-20 h-20 rounded-3xl neumorphic-pressed shrink-0">
                      <span className="text-xs font-bold uppercase text-foreground/40 tracking-widest">{new Date(event.date).toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-3xl font-bold text-foreground leading-none mt-1">{new Date(event.date).getDate()}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={cn("text-[10px] uppercase font-bold border-none px-3 py-1 rounded-full", 
                          event.category === 'academic' ? 'bg-ctu-maroon/10 text-ctu-maroon' :
                          event.category === 'holiday' ? 'bg-green-600/10 text-green-600' :
                          'bg-ctu-gold/10 text-ctu-gold'
                        )}>
                          {event.category}
                        </Badge>
                        <span className="text-xs text-foreground/40 font-bold">{new Date(event.date).getFullYear()}</span>
                      </div>
                      <h3 className="text-xl font-bold text-foreground">{event.title}</h3>
                      <p className="text-sm text-foreground/60 mt-1 font-medium">{event.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
