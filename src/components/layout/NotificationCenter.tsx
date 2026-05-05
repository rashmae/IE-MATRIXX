import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Check, 
  Trash2, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Megaphone,
  ExternalLink,
  MoreVertical
} from 'lucide-react';
import { useNotifications } from '@/src/hooks/useNotifications';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const navigate = useNavigate();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-green-500" size={16} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={16} />;
      case 'error': return <XCircle className="text-red-500" size={16} />;
      case 'announcement': return <Megaphone className="text-ctu-gold" size={16} />;
      default: return <Info className="text-blue-500" size={16} />;
    }
  };

  const handleNotificationClick = (n: any) => {
    markAsRead(n.id);
    if (n.link) {
      navigate(n.link);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        className="relative w-11 h-11 rounded-2xl neumorphic-raised flex items-center justify-center text-foreground/40 hover:text-ctu-gold transition-colors active:neumorphic-pressed group"
        aria-label="Toggle notifications"
      >
        <Bell size={20} className="group-hover:animate-swing" />
        {unreadCount > 0 && (
          <motion.span 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2 w-3 h-3 bg-ctu-maroon border-2 border-background rounded-full animate-bounce shadow-lg shadow-ctu-maroon/20" 
          />
        )}
      </DropdownMenuTrigger>
      
      <DropdownMenuContent 
        align="end" 
        className="w-[320px] sm:w-[400px] p-0 rounded-3xl bg-background border-none shadow-2xl overflow-hidden focus:outline-none"
      >
        <div className="p-5 border-b border-foreground/5 bg-background/50 backdrop-blur-xl flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black tracking-tight leading-none">Notifications</h3>
            <p className="text-[10px] font-bold text-foreground/40 mt-1 uppercase tracking-widest">
              {unreadCount} UNREAD ALERTS
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full hover:bg-foreground/5"
              onClick={() => markAllAsRead()}
              title="Mark all as read"
            >
              <Check size={16} />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-full hover:bg-foreground/5 text-red-500"
              onClick={() => clearAll()}
              title="Clear all"
            >
              <Trash2 size={16} />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="p-2">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-foreground/[0.02] flex items-center justify-center text-foreground/10 mb-4">
                  <Bell size={24} />
                </div>
                <p className="text-sm font-bold text-foreground/20 uppercase tracking-widest">No active alerts</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {notifications.map((n) => (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "group p-4 rounded-2xl mb-1 transition-all cursor-pointer relative overflow-hidden",
                      n.read ? "opacity-60 bg-transparent" : "bg-foreground/[0.02] hover:bg-foreground/[0.04]"
                    )}
                    onClick={() => handleNotificationClick(n)}
                  >
                    {!n.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-ctu-gold rounded-r-lg" />
                    )}
                    
                    <div className="flex gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                        n.read ? "bg-foreground/5" : "bg-background neumorphic-raised"
                      )}>
                        {getIcon(n.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className={cn(
                            "text-sm font-black tracking-tight leading-snug",
                            n.read ? "text-foreground/60" : "text-foreground text-opacity-100"
                          )}>
                            {n.title}
                          </h4>
                          {n.link && <ExternalLink size={12} className="text-foreground/20 group-hover:text-ctu-gold transition-colors" />}
                        </div>
                        <p className={cn(
                          "text-xs mt-1 leading-relaxed",
                          n.read ? "text-foreground/40 font-medium" : "text-foreground/60 font-bold"
                        )}>
                          {n.message}
                        </p>
                        <p className="text-[9px] mt-2 font-bold uppercase tracking-[0.05em] text-foreground/30">
                          {formatDistanceToNow(new Date(n.createdAt?.toDate ? n.createdAt.toDate() : n.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>

                    <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 rounded-full hover:bg-foreground/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Could add more options here
                        }}
                      >
                        <MoreVertical size={12} />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
        
        {notifications.length > 0 && (
          <div className="p-4 border-t border-foreground/5 bg-background/50">
            <Button 
              variant="outline" 
              className="w-full rounded-xl border-foreground/5 text-[10px] font-black uppercase tracking-[0.2em] h-10 hover:bg-foreground/5"
              onClick={() => markAllAsRead()}
            >
              Catch up all
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
