import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/authStore';
import { usePreferencesStore } from '@/store/preferencesStore';
import { motion, AnimatePresence } from 'framer-motion';

interface AppShellProps {
    children: ReactNode;
    sidebar?: ReactNode;
    rightPanel?: ReactNode;
}

export function AppShell({ children, sidebar, rightPanel }: AppShellProps) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const sidebarCollapsed = usePreferencesStore((s) => s.sidebarCollapsed);

    if (!isAuthenticated) return <>{children}</>;

    return (
        <div className="flex h-screen w-full bg-[var(--color-bg)] overflow-hidden font-sans selection:bg-[var(--color-primary)]/20 selection:text-[var(--color-primary)]">
            <aside 
                className={`
                    hidden md:flex flex-col border-r border-[var(--color-border)]/50 bg-[var(--color-surface)] z-30 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] flex-shrink-0
                    ${sidebarCollapsed ? 'w-16' : 'w-80 shadow-surgical'}
                `}
            >
                <div className="h-full relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-primary)]/[0.01] to-transparent pointer-events-none" />
                    {sidebar || <Sidebar />}
                </div>
            </aside>

            <main className="relative flex flex-1 flex-col min-w-0 bg-[var(--color-bg)] z-10 overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--color-primary-soft),transparent_50%)] pointer-events-none opacity-40" />
                <div className="relative flex flex-col h-full z-10 overflow-hidden">
                    {children}
                </div>
            </main>

            <AnimatePresence>
                {rightPanel && (
                    <motion.aside 
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 360, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        className="hidden xl:flex flex-col border-l border-[var(--color-border)]/50 glass-morphism z-20 shadow-surgical overflow-hidden"
                    >
                        <div className="w-[360px] h-full">
                            {rightPanel}
                        </div>
                    </motion.aside>
                )}
            </AnimatePresence>
        </div>
    );
}
