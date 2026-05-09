import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Info, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Megaphone,
  ExternalLink
} from 'lucide-react';
import { useNotifications } from '@/src/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

import { MatrixNotification as MatrixNotificationType } from '@/src/types/index';

interface NotificationsListProps {
  maxItems?: number;
  filterType?: string | 'all';
  className?: string;
  onItemClick?: () => void;
}

export default function NotificationsList({ maxItems = 5, filterType = 'all', className, onItemClick }: NotificationsListProps) {
  const { notifications, loading, markAsRead } = useNotifications();
  const navigate = useNavigate();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-emerald-500" size={16} />;
      case 'warning': return <AlertTriangle className="text-amber-500" size={16} />;
      case 'error': return <XCircle className="text-red-500" size={16} />;
      case 'announcement': return <Megaphone className="text-ctu-gold" size={16} />;
      default: return <Info className="text-blue-500" size={16} />;
    }
  };

  const handleNotificationClick = (n: MatrixNotificationType) => {
    markAsRead(n.id);
    if (onItemClick) onItemClick();
    if (n.link) {
      navigate(n.link);
    }
  };

  const filtered = filterType === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filterType);

  const displayNotifications = maxItems ? filtered.slice(0, maxItems) : filtered;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 neumorphic-pressed rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <div className="w-12 h-12 rounded-full bg-foreground/[0.02] flex items-center justify-center text-foreground/10 mb-3">
          <Bell size={20} />
        </div>
        <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest">Quiet in the matrix</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <AnimatePresence mode="popLayout">
        {displayNotifications.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "group p-4 rounded-2xl transition-all cursor-pointer relative overflow-hidden flex gap-4 items-start",
              n.read ? "neumorphic-pressed opacity-60" : "neumorphic-raised hover:neumorphic-pressed"
            )}
            onClick={() => handleNotificationClick(n)}
          >
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
                  n.read ? "text-foreground/60" : "text-foreground"
                )}>
                  {n.title}
                </h4>
                <div className="flex items-center gap-1">
                  {!n.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(n.id);
                      }}
                      className="p-1 rounded-full hover:bg-foreground/10 text-foreground/40 hover:text-green-500 transition-colors"
                      title="Mark as read"
                    >
                      <CheckCircle2 size={14} />
                    </button>
                  )}
                  {n.link && <ExternalLink size={10} className="text-foreground/20 group-hover:text-ctu-gold transition-colors" />}
                </div>
              </div>
              <p className={cn(
                "text-[11px] mt-1 line-clamp-2",
                n.read ? "text-foreground/40 font-medium" : "text-foreground/60 font-bold"
              )}>
                {n.message}
              </p>
              <p className="text-[9px] mt-2 font-bold uppercase tracking-wider text-foreground/20">
                {formatDistanceToNow(new Date(n.createdAt?.toDate ? n.createdAt.toDate() : n.createdAt), { addSuffix: true })}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
