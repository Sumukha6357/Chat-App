import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { useChatStore, Room } from '@/store/chatStore';
import { Avatar } from '../ui/Avatar';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  addFavorite,
  getFavorites,
  getSidebarState,
  getWorkspaceOrder,
  patchPreferences,
  patchSidebarState,
  removeFavorite,
  searchRooms,
  setWorkspaceOrder,
} from '@/services/api';
import { ProfileCard } from './ProfileCard';
import {
  HiHashtag, HiUserGroup, HiChatBubbleLeftRight,
  HiPlus, HiMagnifyingGlass, HiChevronDown, HiChevronRight,
  HiSun, HiMoon, HiSquares2X2, HiStar, HiBars3BottomLeft,
} from 'react-icons/hi2';
import { usePreferencesStore } from '@/store/preferencesStore';

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
  const sidebarCollapsed = usePreferencesStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = usePreferencesStore((s) => s.setSidebarCollapsed);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Room[] | null>(null);
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [workspaceOrder, setLocalWorkspaceOrder] = useState<string[]>([]);
  const [dragRoomId, setDragRoomId] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [appMenuOpen, setAppMenuOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const appMenuRef = useRef<HTMLDivElement>(null);

  const onToggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'midnight' : 'dark';
    toggleTheme();
    await patchPreferences({ theme: next }).catch(() => null);
  };

  useEffect(() => {
    if (!profileOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

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

  useEffect(() => {
    getSidebarState()
      .then((state) => {
        const collapsed = state?.sectionCollapsed || {};
        setFavoritesOpen(!collapsed.favorites);
        setChannelsOpen(!collapsed.textChannels);
        setDmsOpen(!collapsed.dms);
      })
      .catch(() => null);
    getFavorites()
      .then((data) => setFavoriteIds(data.roomIds || []))
      .catch(() => null);
    getWorkspaceOrder()
      .then((data) => setLocalWorkspaceOrder(data.workspaceOrder || []))
      .catch(() => null);
  }, []);

  const displayListRaw = results ?? rooms;
  const orderMap = new Map<string, number>(workspaceOrder.map((id, idx) => [id, idx]));
  const displayList = [...displayListRaw].sort((a, b) => {
    const aIdx = orderMap.has(a._id) ? (orderMap.get(a._id) as number) : Number.MAX_SAFE_INTEGER;
    const bIdx = orderMap.has(b._id) ? (orderMap.get(b._id) as number) : Number.MAX_SAFE_INTEGER;
    if (aIdx !== bIdx) return aIdx - bIdx;
    return a.name.localeCompare(b.name);
  });
  const favoriteRooms = displayList.filter((r) => favoriteIds.includes(r._id));
  const groupRooms = displayList.filter((r) => r.type === 'group');
  const directMessages = displayList.filter((r) => r.type === 'direct');

  const renderRoomItem = (room: Room) => {
    const isActive = activeRoomId === room._id;
    const isFavorite = favoriteIds.includes(room._id);
    const unreadCount = roomReadState[room._id]?.unreadCount || room.unreadCount || 0;
    const isDirect = room.type === 'direct';
    const otherUserId = isDirect ? room.members.find((id: string) => id !== me) : undefined;
    const status = otherUserId ? userPresence[otherUserId]?.status : undefined;
    const onlineInRoom = roomPresence[room._id]?.onlineCount ?? 0;

    const slug = room.slug || room.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    return (
      <motion.div
        key={room._id}
        layout
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        draggable
        onDragStart={() => setDragRoomId(room._id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={async () => {
          if (!dragRoomId || dragRoomId === room._id) return;
          const next = workspaceOrder.length ? [...workspaceOrder] : rooms.map((r) => r._id);
          const from = next.indexOf(dragRoomId);
          const to = next.indexOf(room._id);
          if (from === -1 || to === -1) return;
          next.splice(to, 0, next.splice(from, 1)[0]);
          setLocalWorkspaceOrder(next);
          setDragRoomId(null);
          await setWorkspaceOrder(next).catch(() => null);
        }}
        className="px-2"
      >
        <button
          onClick={() => router.push(`/rooms/${room._id}`, `/rooms/${slug}`, { shallow: false })}
          className={cn(
            "w-full group flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl transition-all duration-300 text-left relative",
            isActive
              ? "bg-[var(--color-primary)] text-white shadow-premium shadow-primary/20 translate-x-1"
              : "text-[var(--color-text)] hover:bg-[var(--color-surface-2)]/60 hover:translate-x-1"
          )}
        >
          <div className="relative shrink-0">
            <Avatar name={room.name} size={36} status={isDirect ? status : undefined} className={isActive ? 'border-white/20' : 'ring-1 ring-black/5'} />
            {!isDirect && onlineInRoom > 0 && !isActive && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[var(--color-success)] rounded-full border-2 border-[var(--color-surface)] shadow-sm" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-[14px] truncate leading-tight tracking-tight",
                unreadCount > 0 ? "font-bold" : "font-medium opacity-90"
              )}>
                {room.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isFavorite) {
                      const data = await removeFavorite(room._id);
                      setFavoriteIds(data.roomIds || []);
                    } else {
                      const data = await addFavorite(room._id);
                      setFavoriteIds(data.roomIds || []);
                    }
                  }}
                  className={cn(
                    "p-1.5 rounded-lg active:scale-90 transition-all",
                    isFavorite ? "text-amber-400" : "text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-black/5"
                  )}
                  title={isFavorite ? "Remove favorite" : "Add favorite"}
                >
                  <HiStar className="w-4 h-4" />
                </button>
                {unreadCount > 0 && (
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-lg text-[10px] font-bold min-w-[1.25rem] text-center",
                    isActive ? "bg-white text-[var(--color-primary)] shadow-sm" : "bg-[var(--color-primary)] text-white"
                  )}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </div>
            </div>
          </div>
        </button>
      </motion.div>
    );
  };

  return (
    <div className={cn("flex flex-col h-full bg-[var(--color-bg)] border-r border-[var(--color-border)] relative transition-all duration-300", sidebarCollapsed ? "w-16" : "w-80")}>
      {/* Blueprint Grid Overlay */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* Header */}
      <div className={cn("flex items-center justify-between p-4 sticky top-0 z-40 bg-[var(--color-bg)]/80 backdrop-blur-2xl", sidebarCollapsed ? "justify-center" : "pb-5")}>
        {!sidebarCollapsed && (
          <div className="relative" ref={appMenuRef}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAppMenuOpen((v) => !v)}
              className="flex items-center gap-3.5 group"
            >
              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-[var(--color-primary)] to-[#7c3aed] flex items-center justify-center text-white font-black shadow-premium shadow-primary/20">
                P
              </div>
              <span className="text-2xl font-black tracking-tighter text-[var(--color-text)]">Pulse</span>
              <HiChevronDown className={cn("w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-300", appMenuOpen && "rotate-180")} />
            </motion.button>

            <AnimatePresence>
              {appMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute top-full left-0 mt-4 w-72 glass-morphism rounded-2xl shadow-premium z-50 overflow-hidden"
                >
                  <div className="px-6 py-5 border-b border-[var(--glass-border)] bg-white/5">
                    <p className="text-[15px] font-bold text-[var(--color-text)]">Pulse Workspace</p>
                    <p className="text-[12px] text-[var(--color-text-muted)] mt-1 font-medium italic opacity-70">Surgical AI Environment</p>
                  </div>
                  <div className="p-2">
                    <Link href="/rooms/new" onClick={() => setAppMenuOpen(false)}
                      className="flex items-center gap-4 px-4 py-3.5 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] rounded-xl transition-all">
                      <div className="p-2 rounded-lg bg-[var(--color-primary)]/10 shadow-inner">
                        <HiPlus className="w-5 h-5 text-[var(--color-primary)]" />
                      </div>
                      New Room
                    </Link>
                    <button
                      onClick={() => { onToggleTheme(); setAppMenuOpen(false); }}
                      className="w-full flex items-center gap-4 px-4 py-3.5 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] rounded-xl transition-all">
                      <div className={cn("p-2 rounded-lg shadow-inner", theme === 'dark' ? "bg-amber-500/10" : "bg-[var(--color-primary)]/10")}>
                        {theme === 'dark' ? <HiSun className="w-5 h-5 text-amber-500" /> : <HiMoon className="w-5 h-5 text-[var(--color-primary)]" />}
                      </div>
                      Appearance
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Toggle Button - Always Visible */}
        <button
          onClick={async () => {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            await patchPreferences({ sidebarCollapsed: next }).catch(() => null);
          }}
          className={cn(
            "p-3 rounded-xl hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-all",
            sidebarCollapsed && "mx-auto"
          )}
          title={sidebarCollapsed ? "Expand" : "Collapse"}
        >
          {sidebarCollapsed ? (
            <HiBars3BottomLeft className="w-5 h-5 rotate-180" />
          ) : (
            <HiBars3BottomLeft className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Search - Only show when expanded */}
      {!sidebarCollapsed && (
        <div className="px-6 mb-6">
          <div className="relative group">
            <HiMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-muted)] group-focus-within:text-[var(--color-primary)] group-focus-within:scale-110 transition-all pointer-events-none z-10" />
            <input
              className="w-full bg-[var(--color-surface-2)]/50 border border-[var(--color-border)] focus:bg-[var(--color-bg)] focus:border-[var(--color-primary)]/50 focus:ring-4 focus:ring-[var(--color-primary)]/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-medium transition-all duration-400 outline-none placeholder:text-[var(--color-text-muted)]/40 text-[var(--color-text)]"
              placeholder="Universal Search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
          />
          </div>
        </div>
      )}

      {/* Room list - Only show when expanded */}
      {!sidebarCollapsed && (
        <div className="flex-1 overflow-y-auto pb-6 space-y-4 modern-scroll px-1">
          {[
          { id: 'favorites', label: 'Pinned', items: favoriteRooms, open: favoritesOpen, setOpen: setFavoritesOpen, icon: HiStar },
          { id: 'channels', label: 'Channels', items: groupRooms, open: channelsOpen, setOpen: setChannelsOpen, icon: HiHashtag },
          { id: 'dms', label: 'Direct Messages', items: directMessages, open: dmsOpen, setOpen: setDmsOpen, icon: HiChatBubbleLeftRight }
        ].map((section) => (
          section.items.length > 0 && (
            <section key={section.id} className="space-y-1">
              <button
                onClick={async () => {
                  const next = !section.open;
                  section.setOpen(next);
                  await patchSidebarState({ sectionCollapsed: { [section.id === 'channels' ? 'textChannels' : section.id]: !next } }).catch(() => null);
                }}
                className="w-full flex items-center justify-between px-5 py-2 group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <section.icon className="w-3.5 h-3.5 text-[var(--color-text-muted)] opacity-50 group-hover:opacity-100 transition-opacity" />
                  <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--color-text-muted)]/70 group-hover:text-[var(--color-text)] transition-colors">{section.label}</span>
                </div>
                {section.open ? <HiChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]/50" /> : <HiChevronRight className="w-3.5 h-3.5 text-[var(--color-text-muted)]/50" />}
              </button>
              <AnimatePresence initial={false}>
                {section.open && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-1">
                      {section.items.map(renderRoomItem)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )
        ))}
        {displayList.length === 0 && (
          <div className="px-8 py-20 text-center">
            <div className="w-24 h-24 bg-[var(--color-surface-2)]/50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-[var(--color-border)] animate-float">
              <HiUserGroup className="w-12 h-12 text-[var(--color-text-muted)]/30" />
            </div>
            <p className="text-[15px] font-bold text-[var(--color-text-muted)]/60 tracking-tight">No entities found</p>
          </div>
        )}
        </div>
      )}

      {/* Profile section - Only show when expanded */}
      {!sidebarCollapsed && (
        <div className="p-6 bg-[var(--color-bg)] h-[100px] border-t border-[var(--color-border)] relative z-40" ref={profileRef}>
        <AnimatePresence>
          {profileOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="absolute bottom-[calc(100%+0.75rem)] left-6 right-6 z-50"
            >
              <ProfileCard onClose={() => setProfileOpen(false)} />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setProfileOpen((v) => !v)}
          className="w-full h-full flex items-center gap-4 p-4 rounded-2xl glass-morphism hover:bg-[var(--color-surface-2)] transition-all group"
        >
          <div className="relative">
            <Avatar 
              name={username || 'Me'} 
              size={48} 
              status="online" 
              className="ring-2 ring-[var(--color-primary)]/20 shadow-premium shrink-0 group-hover:scale-110 transition-transform duration-500" 
            />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-[15px] font-bold truncate text-[var(--color-text)] tracking-tight">{username || 'Guest'}</div>
            <div className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-[0.2em] mt-1 opacity-50">Operations</div>
          </div>
          <div className="p-2.5 rounded-xl bg-[var(--color-surface-soft)] group-hover:bg-[var(--color-primary)]/10 transition-colors">
            <HiSquares2X2 className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-all" />
          </div>
        </motion.button>
      </div>
      )}

      {/* Collapsed Profile - Show when sidebar is collapsed */}
      {sidebarCollapsed && (
        <div className="mt-auto p-4">
          <button
            onClick={() => setProfileOpen((v) => !v)}
            className="w-full aspect-square rounded-xl hover:bg-[var(--color-surface-2)] transition-colors flex items-center justify-center"
            title="Profile"
          >
            <Avatar 
              name={username || 'Me'} 
              size={32} 
              status="online" 
            />
          </button>
        </div>
      )}
    </div>
  );
}
