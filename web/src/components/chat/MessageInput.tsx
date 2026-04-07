import { useState, useRef, useEffect } from 'react';
import { queueSendMessage } from '@/services/socket';
import { getDraft, upsertDraft, uploadFile } from '@/services/api';
import { useToastStore } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { HiPaperClip, HiPaperAirplane, HiXMark } from 'react-icons/hi2';

interface MessageInputProps {
  roomId: string;
}

type Attachment = {
  url: string;
  type: 'image' | 'file';
  name: string;
  size: number;
  mimeType: string;
};

export function MessageInput({ roomId }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const showToast = useToastStore((s) => s.show);
  const myId = useAuthStore((s) => s.userId);

  useEffect(() => {
    const te = textareaRef.current;
    if (!te) return;
    te.style.height = '44px';
    te.style.height = `${Math.min(te.scrollHeight, 200)}px`;
  }, [content]);

  useEffect(() => {
    // Temporarily disable drafts to prevent API errors
    // if (!roomId || roomId === 'new' || roomId === 'undefined') return;
    // getDraft(roomId)
    //   .then((d) => {
    //     if (typeof d?.content === 'string') setContent(d.content);
    //   })
    //   .catch(() => null);
  }, [roomId]);

  useEffect(() => {
    // Temporarily disable drafts to prevent API errors
    // if (!roomId || roomId === 'new' || roomId === 'undefined') return;
    // const timer = setTimeout(() => {
    //   upsertDraft(roomId, content).catch(() => null);
    // }, 400);
    // return () => clearTimeout(timer);
  }, [roomId, content]);

  const onSend = () => {
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;

    console.log('Sending message:', { roomId, content: trimmed, myId });

    const clientMessageId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

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

    console.log('Message added to store, queuing send...');
    queueSendMessage({
      roomId,
      content: trimmed,
      clientMessageId,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    setContent('');
    // Temporarily disable drafts to prevent API errors
    // if (roomId && roomId !== 'new' && roomId !== 'undefined') {
    //   upsertDraft(roomId, '').catch(() => null);
    // }
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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transmission failed';
      showToast(message, 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments((prev) => prev.filter((a) => a.url !== url));
  };

  const isInvalid = (!content.trim() && attachments.length === 0) || isUploading;

  return (
    <div className="flex flex-col gap-4">
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-4 mb-2 px-6"
          >
            {attachments.map((att) => (
              <motion.div 
                layout
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                key={att.url} 
                className="group relative w-20 h-20 rounded-2xl overflow-hidden border border-[var(--color-border)] shadow-premium bg-[var(--color-surface)]"
              >
                {att.type === 'image' ? (
                  <img src={att.url.startsWith('/') ? `${process.env.NEXT_PUBLIC_API_URL}${att.url}` : att.url} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-black/5">
                    <div className="text-[11px] font-black uppercase tracking-widest opacity-40">Blob</div>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                <button
                  onClick={() => removeAttachment(att.url)}
                  className="absolute top-1.5 right-1.5 p-1.5 rounded-xl bg-red-500 text-white shadow-premium opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                >
                  <HiXMark className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
            {isUploading && (
              <motion.div 
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-20 h-20 rounded-2xl border-2 border-dashed border-[var(--color-primary)]/20 flex items-center justify-center bg-[var(--color-primary)]/5"
              >
                <div className="w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-6 mb-6">
        <motion.div 
          layout
          className="flex items-end gap-3 glass-morphism rounded-[28px] px-4 py-3 shadow-premium focus-within:ring-2 focus-within:ring-[var(--color-primary)]/10 transition-all duration-500"
        >
          <label className="p-3 rounded-2xl cursor-pointer text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-primary)] transition-all group active:scale-95">
            <HiPaperClip className="w-6 h-6" />
            <input type="file" className="hidden" onChange={onUpload} disabled={isUploading} />
          </label>

          <textarea
            ref={textareaRef}
            className="flex-1 bg-transparent border-none focus:ring-0 text-[15px] py-3.5 px-1 max-h-[220px] min-h-[44px] resize-none outline-none text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] opacity-80 font-medium leading-relaxed"
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

          <motion.button
            whileHover={!isInvalid ? { scale: 1.05 } : {}}
            whileTap={!isInvalid ? { scale: 0.95 } : {}}
            className={cn(
              "rounded-[20px] w-12 h-12 flex items-center justify-center shadow-premium transition-all duration-500 shrink-0",
              isInvalid
                ? "bg-[var(--color-surface-soft)] text-[var(--color-text-muted)] opacity-30 cursor-not-allowed"
                : "bg-[var(--color-primary)] text-white shadow-[var(--color-primary)]/20"
            )}
            onClick={onSend}
            disabled={isInvalid}
          >
            <HiPaperAirplane className={cn(
              "w-5 h-5 -rotate-45 transition-transform duration-500",
              !isInvalid && "translate-x-0.5 -translate-y-0.5"
            )} />
          </motion.button>
        </motion.div>
        <div className="flex items-center justify-between px-6 mt-3">
          <div className="text-[10px] text-[var(--color-text-muted)] font-black uppercase tracking-[0.2em] opacity-30">
            <span className="mr-4">Surgical AI v4.0</span>
            <kbd className="opacity-60">Shift + Enter</kbd> for new line
          </div>
          {content.length > 500 && (
            <div className={cn(
              "text-[10px] font-black uppercase tracking-widest",
              content.length > 1800 ? "text-red-500" : "text-[var(--color-text-muted)] opacity-40"
            )}>
              {content.length} / 2000
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
