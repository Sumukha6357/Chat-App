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
    <div className="flex flex-col gap-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-1">
          {attachments.map((att) => (
            <div key={att.url} className="group relative w-14 h-14 rounded-xl overflow-hidden border border-[var(--color-border)] shadow-sm bg-[var(--color-surface)]">
              {att.type === 'image' ? (
                <img src={att.url.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL}${att.url}` : att.url} className="w-full h-full object-cover" alt="" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[9px] font-black uppercase text-[var(--color-text-muted)]">File</div>
              )}
              <button
                onClick={() => removeAttachment(att.url)}
                className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <HiXMark className="w-3 h-3" />
              </button>
            </div>
          ))}
          {isUploading && (
            <div className="w-14 h-14 rounded-xl border border-dashed border-[var(--color-border)] flex items-center justify-center bg-[var(--color-surface)]">
              <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 bg-[var(--color-surface)] rounded-2xl px-2 py-1.5 border border-[var(--color-border)] focus-within:border-[var(--color-primary)]/40 focus-within:ring-4 focus-within:ring-[var(--color-primary)]/5 transition-all duration-200">
        <label className="p-2 rounded-xl cursor-pointer text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-primary)] transition-colors">
          <HiPaperClip className="w-5 h-5" />
          <input type="file" className="hidden" onChange={onUpload} disabled={isUploading} />
        </label>

        <textarea
          ref={textareaRef}
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-1 max-h-[200px] min-h-[40px] resize-none outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60 font-medium"
          placeholder="Type a message..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />

        <Button
          variant="primary"
          size="sm"
          className="rounded-xl w-10 h-10 p-0 shadow-sm disabled:shadow-none transition-all active:scale-95 shrink-0"
          onClick={onSend}
          disabled={(!content.trim() && attachments.length === 0) || isUploading}
        >
          <HiPaperAirplane className="w-4 h-4 -rotate-45" />
        </Button>
      </div>
      <p className="px-3 text-[10px] text-[var(--color-text-muted)]/50 font-medium">
        <kbd className="font-mono">Shift + Enter</kbd> for new line
      </p>
    </div>
  );
}
