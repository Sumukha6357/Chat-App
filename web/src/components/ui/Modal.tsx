import type { ReactNode } from 'react';
import { HiXMark } from 'react-icons/hi2';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ open, title, onClose, children }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        className="bg-[var(--color-surface)] w-full max-w-md rounded-[var(--radius-xl)] shadow-[var(--shadow-premium)] overflow-hidden animate-in zoom-in-95 duration-200 border border-[var(--color-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)]">
          {title ? <h3 className="text-xl font-bold tracking-tight text-[var(--color-text)]">{title}</h3> : <div />}
          <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full w-9 h-9 p-0 hover:bg-[var(--color-surface-2)]">
            <HiXMark className="w-6 h-6" />
          </Button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
