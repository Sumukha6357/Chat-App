import { useState, useRef, useEffect } from 'react';
import { queueSendMessage } from '@/services/socket';
import { uploadFile } from '@/services/api';
import { Button } from '../ui/Button';
import { useToastStore } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { HiPaperClip, HiPaperAirplane, HiXMark } from 'react-icons/hi2';

interface MessageInputProps {
  roomId: string;
}

export function MessageInput({ roomId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const showToast = useToastStore((s) => s.show);
  const myId = useAuthStore((s) => s.userId);

  // Auto-grow textarea
  useEffect(() => {
    const te = textareaRef.current;
    if (!te) return;
    te.style.height = '40px';
    te.style.height = `${Math.min(te.scrollHeight, 200)}px`;
  }, [content]);

  const onSend = () => {
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;

    const clientMessageId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Optimistically add message to store so it appears immediately
    useChatStore.getState().addMessage(roomId, {
      _id: clientMessageId,
      roomId,
      senderId: myId || '',
      content: trimmed,
      type: 'text',
      createdAt: new Date().toISOString(),
      clientMessageId,
      status: 'sending',
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    // Queue through the reliable outbound system
    queueSendMessage({
      roomId,
      content: trimmed,
      clientMessageId,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    setContent('');
    setAttachments([]);
    textareaRef.current?.focus();
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const data = await uploadFile(file, roomId);
      setAttachments((prev) => [...prev, data]);
    } catch (err: any) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  };

  return (
    <div className="flex flex-col gap-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-1 px-4 animate-in fade-in slide-in-from-bottom-2">
          {attachments.map((att) => (
            <div key={att.url} className="group relative w-16 h-16 rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-premium bg-[var(--color-surface)]">
              {att.type === 'image' ? (
                <img src={att.url.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL}${att.url}` : att.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--color-surface-2)]">
                  <div className="text-[10px] font-black uppercase text-[var(--color-text-muted)]">File</div>
                </div>
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <button
                onClick={() => removeAttachment(att.url)}
                className="absolute top-1 right-1 p-1 rounded-full bg-[var(--color-danger)] text-white shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-90"
              >
                <HiXMark className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {isUploading && (
            <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-[var(--color-primary)]/30 flex items-center justify-center bg-[var(--color-primary)]/5 animate-pulse">
              <div className="w-5 h-5 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      <div className="mx-4 mb-4">
        <div className="flex items-end gap-3 glass-morphism rounded-[var(--radius-xl)] px-3 py-2.5 shadow-premium focus-within:shadow-[0_0_30px_rgba(99,102,241,0.15)] focus-within:border-[var(--color-primary)]/30 transition-all duration-300">
          <label className="p-2.5 rounded-2xl cursor-pointer text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] hover:scale-110 active:scale-95 transition-all">
            <HiPaperClip className="w-6 h-6" />
            <input type="file" className="hidden" onChange={onUpload} disabled={isUploading} />
          </label>

          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2.5 px-2 max-h-[200px] min-h-[44px] resize-none outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/50 font-medium leading-relaxed"
            placeholder="Type your message..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />

          <button
            className={`
              rounded-2xl w-11 h-11 flex items-center justify-center shadow-lg transition-all duration-300 shrink-0
              ${(!content.trim() && attachments.length === 0) || isUploading
                ? 'bg-[var(--color-surface-3)] text-[var(--color-text-muted)] cursor-not-allowed opacity-50'
                : 'bg-[var(--color-primary)] text-white hover:scale-110 active:scale-90 shadow-[var(--color-primary)]/30'
              }
            `}
            onClick={onSend}
            disabled={(!content.trim() && attachments.length === 0) || isUploading}
          >
            <HiPaperAirplane className={`w-5 h-5 -rotate-45 transition-transform ${content.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''}`} />
          </button>
        </div>
        <div className="flex items-center justify-between px-4 mt-2">
          <div className="text-[10px] text-[var(--color-text-muted)]/40 font-bold uppercase tracking-widest">
            <kbd className="opacity-60">Shift + Enter</kbd> for new line
          </div>
          {content.length > 500 && (
            <div className={`text-[10px] font-bold ${content.length > 1800 ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}`}>
              {content.length} / 2000
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
