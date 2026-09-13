import React, { useState, useEffect, useRef } from 'react';
import { useCollaboration } from '../../context/CollaborationContext';
import { CollaborationApiClient } from '../../services/collaborationApi';
import { Bell, Check, CheckCheck, Share2, UserPlus, ShieldAlert, Sparkles, X } from 'lucide-react';

export const NotificationsPopover: React.FC = () => {
  const { notifications, unreadNotificationsCount, refreshNotifications } = useCollaboration();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await CollaborationApiClient.markNotificationRead(id);
    await refreshNotifications();
  };

  const handleMarkAllRead = async () => {
    await CollaborationApiClient.markAllNotificationsRead();
    await refreshNotifications();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'resource_shared':
        return <Share2 className="w-3.5 h-3.5 text-indigo-400" />;
      case 'workspace_invitation':
        return <UserPlus className="w-3.5 h-3.5 text-emerald-400" />;
      case 'role_changed':
        return <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        id="btn-notifications-bell"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadNotificationsCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white font-bold text-[10px] flex items-center justify-center animate-pulse">
            {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 text-slate-200 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-white">Notifications</span>
              {unreadNotificationsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {unreadNotificationsCount} new
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center space-x-1 transition-colors"
              >
                <CheckCheck className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No notifications at this time
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  className={`p-3 text-xs transition-colors flex items-start space-x-3 ${
                    n.isRead ? 'bg-slate-900/40 opacity-75' : 'bg-slate-800/40 font-medium'
                  }`}
                >
                  <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 flex-shrink-0 mt-0.5">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white truncate text-xs">{n.title}</span>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{n.message}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={e => handleMarkRead(n.id, e)}
                      className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-slate-800 transition-colors flex-shrink-0"
                      title="Mark as read"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
