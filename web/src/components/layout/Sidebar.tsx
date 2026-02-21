import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useChatStore } from '@/store/chatStore';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { searchRooms } from '@/services/api';
import { ProfileCard } from './ProfileCard';
import {
  HiHashtag, HiUserGroup, HiChatBubbleLeftRight,
  HiPlus, HiMagnifyingGlass, HiChevronDown, HiChevronRight,
  HiSun, HiMoon, HiSquares2X2,
} from 'react-icons/hi2';

export function Sidebar() {
  const router = useRouter();
  const activeRoomId = router.query.id as string;
  const rooms = useChatStore((s) => s.rooms);
  const roomPresence = useChatStore((s) => s.roomPresence);
  const roomReadState = useChatStore((s) => s.roomReadState);
  const userPresence = useChatStore((s) => s.userPresence);
  const me = useAuthStore((s) => s.userId);
  const username = useAuthStore((s) => s.username);
  const { theme, toggleTheme } = useThemeStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const appMenuRef = useRef<HTMLDivElement>(null);

  // Close profile on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  // Close app menu on outside click
  useEffect(() => {
    if (!appMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (appMenuRef.current && !appMenuRef.current.contains(e.target as Node)) setAppMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [appMenuOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const term = query.trim();
      if (!term) { setResults(null); return; }
      searchRooms(term).then((data) => setResults(data));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const displayList = results ?? rooms;
  const groupRooms = displayList.filter((r) => r.type === 'group');
  const directMessages = displayList.filter((r) => r.type === 'direct');

  const renderRoomItem = (room: any) => {
    const isActive = activeRoomId === room._id;
    const unreadCount = roomReadState[room._id]?.unreadCount || room.unreadCount || 0;
    const isDirect = room.type === 'direct';
    const otherUserId = isDirect ? room.members.find((id: string) => id !== me) : undefined;
    const status = isDirect ? userPresence[otherUserId]?.status : undefined;
    const onlineInRoom = roomPresence[room._id]?.onlineCount ?? 0;

    const slug = room.slug || room.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    return (
      <button
        key={room._id}
        onClick={() => router.push(`/rooms/${room._id}`, `/rooms/${slug}`, { shallow: false })}
        className={`
          w-full group flex items-center gap-3 px-3 py-2 mx-2 my-0.5 rounded-[var(--radius-md)] transition-all duration-200 text-left
          ${isActive
            ? 'bg-[var(--color-primary)] text-white shadow-md translate-x-1'
            : 'text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] hover:translate-x-1'
          }
        `}
      >
        <div className="relative shrink-0">
          <Avatar name={room.name} size={32} status={isDirect ? status : undefined} className={isActive ? 'border-white/20' : ''} />
          {!isDirect && onlineInRoom > 0 && !isActive && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--color-success)] rounded-full border-2 border-[var(--color-surface)] shadow-sm" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className={`text-sm truncate leading-tight ${unreadCount > 0 ? 'font-bold' : 'font-medium opacity-90'}`}>
              {room.name}
            </span>
            {unreadCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[1.25rem] text-center ${isActive ? 'bg-white text-[var(--color-primary)] shadow-sm' : 'bg-[var(--color-primary)] text-white'}`}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <div className="text-[9px] uppercase tracking-widest flex items-center gap-1 font-bold opacity-50 mt-0.5">
            {isDirect ? <HiChatBubbleLeftRight className="w-2.5 h-2.5" /> : <HiHashtag className="w-2.5 h-2.5" />}
            {room.type}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)]">
      {/* Header with clickable app logo */}
      <div className="p-5 flex items-center justify-between pb-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="relative" ref={appMenuRef}>
          <button
            onClick={() => setAppMenuOpen((v) => !v)}
            className="flex items-center gap-3 active:scale-95 transition-all group"
            title="Workspace menu"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-white font-black shadow-[0_0_20px_rgba(99,102,241,0.3)] group-hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transition-all duration-300">
              P
            </div>
            <span className="text-2xl font-black tracking-tighter text-[var(--color-text)]">Pulse</span>
          </button>

          {/* App / Workspace menu */}
          {appMenuOpen && (
            <div className="absolute top-full left-0 mt-3 w-64 glass-morphism rounded-2xl shadow-[var(--shadow-premium)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-50">
              <div className="px-5 py-4 border-b border-[var(--glass-border)]">
                <p className="text-sm font-black text-[var(--color-text)]">Pulse Workspace</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-1">Real-time chat platform</p>
              </div>
              <div className="py-2">
                <Link href="/rooms/new" onClick={() => setAppMenuOpen(false)}
                  className="flex items-center gap-4 px-5 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-all">
                  <div className="p-2 rounded-lg bg-[var(--color-primary)]/10">
                    <HiPlus className="w-5 h-5 text-[var(--color-primary)]" />
                  </div>
                  New Room
                </Link>
                <button
                  onClick={() => { toggleTheme(); setAppMenuOpen(false); }}
                  className="w-full flex items-center gap-4 px-5 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] transition-all">
                  <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-[var(--color-warning)]/10' : 'bg-[var(--color-primary)]/10'}`}>
                    {theme === 'dark' ? <HiSun className="w-5 h-5 text-[var(--color-warning)]" /> : <HiMoon className="w-5 h-5 text-[var(--color-primary)]" />}
                  </div>
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Theme quick toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:scale-110 active:scale-90 transition-all"
            title="Toggle theme"
          >
            {theme === 'dark' ? <HiSun className="w-5 h-5 text-[var(--color-warning)]" /> : <HiMoon className="w-5 h-5" />}
          </button>

          {/* New room */}
          <Link href="/rooms/new" title="New room">
            <button className="p-2.5 rounded-xl hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:scale-110 active:scale-90 transition-all">
              <HiPlus className="w-6 h-6" />
            </button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="px-5 mt-5 mb-4">
        <div className="relative group">
          <HiMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] group-focus-within:scale-110 transition-all pointer-events-none" />
          <input
            className="w-full bg-[var(--color-surface-2)] border-2 border-transparent focus:bg-[var(--color-surface)] focus:border-[var(--color-primary)] focus:ring-8 focus:ring-[var(--color-primary)]/5 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium transition-all duration-300 outline-none placeholder:text-[var(--color-text-muted)]/50 text-[var(--color-text)] shadow-inner"
            placeholder="Search channels..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto pb-6 space-y-2 modern-scroll">
        {groupRooms.length > 0 && (
          <section className="px-2">
            <button
              onClick={() => setChannelsOpen(!channelsOpen)}
              className="w-full flex items-center gap-2 px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors group"
            >
              {channelsOpen ? <HiChevronDown className="w-3.5 h-3.5" /> : <HiChevronRight className="w-3.5 h-3.5" />}
              <HiHashtag className="w-4 h-4" />
              <span>Channels</span>
            </button>
            <div className={`overflow-hidden space-y-0.5 transition-all duration-500 ease-in-out ${channelsOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {groupRooms.map(renderRoomItem)}
            </div>
          </section>
        )}

        {directMessages.length > 0 && (
          <section className="px-2">
            <button
              onClick={() => setDmsOpen(!dmsOpen)}
              className="w-full flex items-center gap-2 px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors group"
            >
              {dmsOpen ? <HiChevronDown className="w-3.5 h-3.5" /> : <HiChevronRight className="w-3.5 h-3.5" />}
              <HiChatBubbleLeftRight className="w-4 h-4" />
              <span>Messages</span>
            </button>
            <div className={`overflow-hidden space-y-0.5 transition-all duration-500 ease-in-out ${dmsOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {directMessages.map(renderRoomItem)}
            </div>
          </section>
        )}

        {displayList.length === 0 && (
          <div className="px-8 py-16 text-center">
            <div className="w-20 h-20 bg-[var(--color-surface-2)] rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner rotate-3 hover:rotate-6 transition-transform">
              <HiUserGroup className="w-10 h-10 text-[var(--color-text-muted)]/50" />
            </div>
            <p className="text-sm font-bold text-[var(--color-text-muted)]/70 tracking-tight">No results found</p>
          </div>
        )}
      </div>

      {/* Profile section */}
      <div className="p-4 bg-[var(--color-surface)]/80 backdrop-blur-lg border-t border-[var(--color-border)] relative z-40" ref={profileRef}>
        {profileOpen && (
          <div className="absolute bottom-[calc(100%+0.5rem)] left-4 right-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
            <ProfileCard onClose={() => setProfileOpen(false)} />
          </div>
        )}
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="w-full flex items-center gap-3.5 p-3 rounded-2xl hover:bg-[var(--color-surface-hover)] hover:shadow-md active:scale-[0.98] transition-all group cursor-pointer"
        >
          <div className="relative">
            <Avatar name={username || 'Me'} size={42} status="online" className="ring-2 ring-[var(--color-primary)]/10 shadow-md shrink-0 group-hover:scale-105 transition-transform" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[var(--color-success)] rounded-full border-[3px] border-[var(--color-surface)] shadow-sm" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-black truncate text-[var(--color-text)] tracking-tight">{username || 'Current User'}</div>
            <div className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-0.5">Settings</div>
          </div>
          <div className="p-2 rounded-lg bg-[var(--color-surface-2)] group-hover:bg-[var(--color-primary)]/10 transition-colors">
            <HiSquares2X2 className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-all" />
          </div>
        </button>
      </div>
    </div>
  );
}
