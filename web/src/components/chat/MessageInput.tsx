import { useState, useRef, useEffect } from 'react';
import { emitSocket, retrySendMessage } from '@/services/socket';
import { uploadFile } from '@/services/api';
import { Button } from '../ui/Button';
import { useToastStore } from '@/store/toastStore';
import { HiPaperClip, HiPaperAirplane, HiXMark, HiPhoto } from 'react-icons/hi2';

interface MessageInputProps {
  roomId: string;
}

export function MessageInput({ roomId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const showToast = useToastStore((s) => s.show);

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

    emitSocket('send_message', {
      roomId,
      content: trimmed,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    setContent('');
    setAttachments([]);
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
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((att) => (
            <div key={att.url} className="group relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--color-border)] shadow-sm bg-[var(--color-surface)]">
              {att.type === 'image' ? (
                <img src={att.url.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL}${att.url}` : att.url} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] font-black uppercase">File</div>
              )}
              <button
                onClick={() => removeAttachment(att.url)}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <HiXMark className="w-3 h-3" />
              </button>
            </div>
          ))}
          {isUploading && (
            <div className="w-16 h-16 rounded-lg border border-dashed border-[var(--color-border)] flex items-center justify-center bg-white/50">
              <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-2 bg-[var(--color-bg)] rounded-[var(--radius-xl)] p-2 focus-within:bg-[var(--color-surface)] focus-within:ring-4 focus-within:ring-[var(--color-primary)]/5 border border-[var(--color-border)] focus-within:border-[var(--color-primary)]/30 transition-all duration-300">
        <div className="flex items-center px-1">
          <label className="p-2 rounded-full cursor-pointer text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] transition-colors relative group/clip">
            <HiPaperClip className="w-5 h-5 transition-transform group-hover/clip:rotate-12" />
            <input type="file" className="hidden" onChange={onUpload} disabled={isUploading} />
          </label>
        </div>

        <textarea
          ref={textareaRef}
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 px-1 max-h-[200px] min-h-[40px] resize-none outline-none overflow-y-auto font-medium"
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

        <div className="flex items-center px-1">
          <Button
            variant="primary"
            size="sm"
            className="rounded-full w-10 h-10 p-0 shadow-[var(--shadow-premium)] disabled:shadow-none transition-all active:scale-95"
            onClick={onSend}
            disabled={(!content.trim() && attachments.length === 0) || isUploading}
          >
            <HiPaperAirplane className="w-5 h-5 -rotate-45 -mr-1" />
          </Button>
        </div>
      </div>
      <p className="px-5 text-[10px] text-[var(--color-text-muted)] font-bold opacity-50 uppercase tracking-widest">
        <b>Shift + Enter</b> for new line
      </p>
    </div>
  );
}
