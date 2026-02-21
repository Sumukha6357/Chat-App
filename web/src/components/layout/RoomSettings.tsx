import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/store/toastStore';
import { apiRequest } from '@/services/api';
import { Avatar } from '../ui/Avatar';
import {
    HiXMark, HiPencil, HiPhoto, HiUserGroup,
    HiCheckCircle, HiTrash, HiLockClosed, HiGlobeAlt,
} from 'react-icons/hi2';

interface RoomSettingsProps {
    room: any;
    onClose: () => void;
    onRoomUpdated?: (room: any) => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function RoomSettings({ room, onClose, onRoomUpdated }: RoomSettingsProps) {
    const me = useAuthStore((s) => s.userId);
    const showToast = useToastStore((s) => s.show);

    const [name, setName] = useState(room?.name || '');
    const [description, setDescription] = useState(room?.description || '');
    const [editingName, setEditingName] = useState(false);
    const [editingDesc, setEditingDesc] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | undefined>(room?.avatar);
    const [members, setMembers] = useState<any[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    const isAdmin = room?.adminIds?.includes(me) || room?.members?.[0] === me;

    useEffect(() => {
        if (!room?._id) return;
        apiRequest<any>(`/rooms/${room._id}`, { auth: true })
            .then((r) => {
                setMembers(r.members || []);
                if (r.avatar) setAvatarUrl(r.avatar);
                if (r.description) setDescription(r.description);
            })
            .catch(() => { });
    }, [room?._id]);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const token = useAuthStore.getState().accessToken;
            const form = new FormData();
            form.append('file', file);
            form.append('roomId', room._id);
            const res = await fetch(`${API_URL}/uploads`, {
                method: 'POST',
                headers: token ? { authorization: `Bearer ${token}` } : undefined,
                body: form,
            });
            if (!res.ok) throw new Error('Upload failed');
            const json = await res.json();
            const data = json?.data ?? json;
            setAvatarUrl(data.url);
            // Update room avatar
            await apiRequest(`/rooms/${room._id}`, { method: 'PATCH', auth: true, body: { avatar: data.url } });
            showToast('Room image updated', 'success');
        } catch (err: any) {
            showToast(err.message || 'Upload failed', 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleSave = async (field: 'name' | 'description') => {
        setSaving(true);
        try {
            const body: any = {};
            if (field === 'name') body.name = name.trim();
            if (field === 'description') body.description = description.trim();
            const updated = await apiRequest<any>(`/rooms/${room._id}`, { method: 'PATCH', auth: true, body });
            onRoomUpdated?.(updated);
            showToast(`Room ${field} updated`, 'success');
            if (field === 'name') setEditingName(false);
            if (field === 'description') setEditingDesc(false);
        } catch (err: any) {
            showToast(err.message || 'Failed to update', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-end" onClick={onClose}>
            <div
                className="relative h-full w-full max-w-sm bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-[var(--shadow-premium)] overflow-y-auto animate-in slide-in-from-right-8 duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-5 py-4 flex items-center justify-between z-10">
                    <h2 className="text-base font-bold text-[var(--color-text)]">Room Settings</h2>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--color-surface-2)] text-[var(--color-text-muted)] transition-colors">
                        <HiXMark className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-6">
                    {/* Room avatar */}
                    <div className="flex flex-col items-center gap-3">
                        <label className="relative cursor-pointer group">
                            <Avatar
                                name={room?.name || 'Room'}
                                src={avatarUrl ? (avatarUrl.startsWith('/') ? `${API_URL}${avatarUrl}` : avatarUrl) : undefined}
                                size={80}
                                className="ring-4 ring-[var(--color-primary)]/20 group-hover:ring-[var(--color-primary)] transition-all"
                            />
                            {isAdmin && (
                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    {uploading
                                        ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        : <HiPhoto className="w-6 h-6 text-white" />
                                    }
                                </div>
                            )}
                            {isAdmin && <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />}
                        </label>
                        <p className="text-xs text-[var(--color-text-muted)]">{isAdmin ? 'Click to change room image' : room?.name}</p>
                    </div>

                    {/* Room name */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2 block">Room Name</label>
                        {editingName && isAdmin ? (
                            <div className="flex items-center gap-2">
                                <input
                                    autoFocus
                                    className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-primary)]/30 rounded-xl px-3 py-2 text-sm text-[var(--color-text)] outline-none"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave('name'); if (e.key === 'Escape') setEditingName(false); }}
                                />
                                <button onClick={() => handleSave('name')} disabled={saving} className="p-2 text-[var(--color-primary)] hover:opacity-80">
                                    {saving ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <HiCheckCircle className="w-5 h-5" />}
                                </button>
                                <button onClick={() => setEditingName(false)} className="p-2 text-[var(--color-text-muted)] hover:opacity-80">
                                    <HiXMark className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div onClick={() => isAdmin && setEditingName(true)} className={`flex items-center justify-between p-3 rounded-xl bg-[var(--color-surface-2)] ${isAdmin ? 'cursor-pointer hover:bg-[var(--color-surface-3)] group' : ''}`}>
                                <span className="text-sm font-semibold text-[var(--color-text)]">{name || room?.name}</span>
                                {isAdmin && <HiPencil className="w-4 h-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2 block">Description</label>
                        {editingDesc && isAdmin ? (
                            <div className="flex flex-col gap-2">
                                <textarea
                                    autoFocus
                                    rows={3}
                                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-primary)]/30 rounded-xl px-3 py-2 text-sm text-[var(--color-text)] outline-none resize-none"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button onClick={() => handleSave('description')} disabled={saving} className="flex-1 py-1.5 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold">
                                        {saving ? 'Saving...' : 'Save'}
                                    </button>
                                    <button onClick={() => setEditingDesc(false)} className="px-3 py-1.5 rounded-xl bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-xs font-bold">Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div onClick={() => isAdmin && setEditingDesc(true)} className={`p-3 rounded-xl bg-[var(--color-surface-2)] min-h-[64px] ${isAdmin ? 'cursor-pointer hover:bg-[var(--color-surface-3)] group' : ''}`}>
                                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                    {description || <span className="italic opacity-50">{isAdmin ? 'Add a description...' : 'No description'}</span>}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Room info badges */}
                    <div className="flex gap-2">
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] text-xs font-semibold text-[var(--color-text-muted)]">
                            {room?.type === 'group' ? <HiGlobeAlt className="w-3.5 h-3.5" /> : <HiLockClosed className="w-3.5 h-3.5" />}
                            {room?.type === 'group' ? 'Group' : 'Direct'}
                        </span>
                        <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--color-surface-2)] text-xs font-semibold text-[var(--color-text-muted)]">
                            <HiUserGroup className="w-3.5 h-3.5" />
                            {members.length || '—'} members
                        </span>
                    </div>

                    {/* Members list */}
                    {members.length > 0 && (
                        <div>
                            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-2 block">Members</label>
                            <div className="space-y-1">
                                {members.map((m: any) => (
                                    <div key={m._id || m} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--color-surface-2)] transition-colors">
                                        <Avatar name={m.username || m} size={32} />
                                        <div>
                                            <p className="text-sm font-semibold text-[var(--color-text)]">{m.username || m}</p>
                                            {room?.adminIds?.includes(m._id || m) && (
                                                <p className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-widest">Admin</p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
