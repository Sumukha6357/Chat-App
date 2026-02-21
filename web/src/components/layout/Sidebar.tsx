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

    return (
      <Link
        key={room._id}
        href={`/rooms/${room._id}`}
        className={`
          group flex items-center gap-3 px-3 py-2 mx-2 my-0.5 rounded-[var(--radius-md)] transition-all duration-200
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
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)]">
      {/* Header with clickable app logo */}
      <div className="p-4 flex items-center justify-between pb-3 border-b border-[var(--color-border)]">
        <div className="relative" ref={appMenuRef}>
          <button
            onClick={() => setAppMenuOpen((v) => !v)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
            title="Workspace menu"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white font-black shadow-lg group-hover:shadow-[var(--color-primary)]/30 transition-shadow">
              P
            </div>
            <span className="text-xl font-black tracking-tighter text-[var(--color-text)]">Pulse</span>
          </button>

          {/* App / Workspace menu */}
          {appMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-56 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-[var(--shadow-premium)] overflow-hidden animate-in fade-in zoom-in-95 duration-150 z-50">
              <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <p className="text-xs font-black text-[var(--color-text)]">Pulse Workspace</p>
                <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">Real-time chat platform</p>
              </div>
              <div className="py-1">
                <Link href="/rooms/new" onClick={() => setAppMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors">
                  <HiPlus className="w-4 h-4 text-[var(--color-primary)]" />
                  New Room
                </Link>
                <button
                  onClick={() => { toggleTheme(); setAppMenuOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors">
                  {theme === 'dark' ? <HiSun className="w-4 h-4 text-[var(--color-warning)]" /> : <HiMoon className="w-4 h-4 text-[var(--color-primary)]" />}
                  {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Theme quick toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <HiSun className="w-4 h-4 text-[var(--color-warning)]" /> : <HiMoon className="w-4 h-4" />}
          </button>

          {/* New room */}
          <Link href="/rooms/new" title="New room">
            <button className="p-2 rounded-xl hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
              <HiPlus className="w-5 h-5" />
            </button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 mt-3 mb-3">
        <div className="relative group">
          <HiMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors pointer-events-none" />
          <input
            className="w-full bg-[var(--color-surface-2)] border border-transparent focus:bg-[var(--color-surface)] focus:border-[var(--color-primary)]/30 focus:ring-4 focus:ring-[var(--color-primary)]/5 rounded-full pl-10 pr-4 py-2 text-sm transition-all duration-300 outline-none placeholder:text-[var(--color-text-muted)]/60 text-[var(--color-text)]"
            placeholder="Search rooms..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Room list */}
      <div className="flex-1 overflow-y-auto pb-4 scrollbar-hide space-y-1">
        {groupRooms.length > 0 && (
          <section>
            <button
              onClick={() => setChannelsOpen(!channelsOpen)}
              className="w-full flex items-center gap-2 px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors group"
            >
              {channelsOpen ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />}
              <HiHashtag className="w-3 h-3" />
              <span>Channels</span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${channelsOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {groupRooms.map(renderRoomItem)}
            </div>
          </section>
        )}

        {directMessages.length > 0 && (
          <section>
            <button
              onClick={() => setDmsOpen(!dmsOpen)}
              className="w-full flex items-center gap-2 px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors group"
            >
              {dmsOpen ? <HiChevronDown className="w-3 h-3" /> : <HiChevronRight className="w-3 h-3" />}
              <HiChatBubbleLeftRight className="w-3 h-3" />
              <span>Direct Messages</span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${dmsOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
              {directMessages.map(renderRoomItem)}
            </div>
          </section>
        )}

        {displayList.length === 0 && (
          <div className="px-6 py-12 text-center">
            <div className="w-16 h-16 bg-[var(--color-surface-2)] rounded-full flex items-center justify-center mx-auto mb-4">
              <HiUserGroup className="w-8 h-8 text-[var(--color-text-muted)]" />
            </div>
            <p className="text-sm font-medium text-[var(--color-text-muted)] px-4">No rooms match your search</p>
          </div>
        )}
      </div>

      {/* Profile section */}
      <div className="p-3 bg-[var(--color-surface)] border-t border-[var(--color-border)] relative" ref={profileRef}>
        {profileOpen && (
          <ProfileCard onClose={() => setProfileOpen(false)} />
        )}
        <button
          onClick={() => setProfileOpen((v) => !v)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors group cursor-pointer"
        >
          <Avatar name={username || 'Me'} size={36} status="online" className="ring-2 ring-[var(--color-primary)]/20 shadow-sm shrink-0" />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-bold truncate text-[var(--color-text)] leading-tight">{username || 'Current User'}</div>
            <div className="text-[10px] text-[var(--color-success)] font-semibold">● Online</div>
          </div>
          <HiSquares2X2 className="w-4 h-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
        </button>
      </div>
    </div>
  );
}
