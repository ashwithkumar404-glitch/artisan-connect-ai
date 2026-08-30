import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

function formatRelativeTime(dateString) {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return past.toLocaleDateString();
}

console.log('NotificationBell.jsx module evaluated. useAuth type:', typeof useAuth);

export default function NotificationBell({ light = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    // Set up polling fallback (every 15 seconds)
    const interval = setInterval(fetchNotifications, 15000);

    // Generate a unique channel name on each mount to prevent React StrictMode double-subscribing conflicts
    const channelId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`notifications-user-${user.id}-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      // Update state locally
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  };

  const handleNotificationClick = async (notification) => {
    setIsOpen(false);
    
    // Mark as read in database
    if (!notification.is_read) {
      try {
        const { error } = await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('id', notification.id);

        if (error) throw error;

        // Update state locally
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        console.error('Error marking notification as read:', err);
      }
    }

    // Navigate based on type
    if (notification.reference_id) {
      if (notification.type === 'verification_submitted') {
        navigate(`/admin/verifications/${notification.reference_id}`);
      } else if (
        notification.type === 'verification_approved' ||
        notification.type === 'verification_rejected'
      ) {
        navigate('/artisan/verification');
      }
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={handleToggle}
        className={`relative p-2 rounded-full hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-350 min-h-[40px] min-w-[40px] flex items-center justify-center cursor-pointer ${
          light ? 'text-white hover:bg-white/10' : 'text-slate-600'
        }`}
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <span className="text-xl" role="img" aria-label="Notifications">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 origin-top-right">
          {/* Header */}
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
            <span className="font-bold text-sm text-slate-800">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-bold text-gov-navy hover:text-gov-navy-light cursor-pointer transition-colors"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500 font-semibold">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer flex gap-2.5 ${
                    !n.is_read ? 'bg-slate-50/50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <p className={`text-xs font-bold text-slate-800 leading-snug truncate ${
                        !n.is_read ? 'text-slate-900 font-extrabold' : ''
                      }`}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-gov-navy mt-1.5 flex-shrink-0" aria-label="Unread"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                      {n.message}
                    </p>
                    <span className="block text-[9px] text-slate-400 font-semibold">
                      {formatRelativeTime(n.created_at)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}


