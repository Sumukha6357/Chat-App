import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/store/authStore';

interface AppShellProps {
    children: ReactNode;
    sidebar?: ReactNode;
    rightPanel?: ReactNode;
}

export function AppShell({ children, sidebar, rightPanel }: AppShellProps) {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    if (!isAuthenticated) return <>{children}</>;

    return (
        <div className="flex h-screen w-full bg-[var(--color-bg)] overflow-hidden font-sans">
            {/* Rooms/DMs Sidebar - Slack/Discord Density */}
            <aside className="hidden md:flex w-72 lg:w-80 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] z-30 transition-all duration-300">
                {sidebar || <Sidebar />}
            </aside>

            {/* Main Chat Area - WhatsApp Clarity */}
            <main className="relative flex flex-1 flex-col min-w-0 bg-[var(--color-bg)] z-10 transition-all duration-300">
                {children}
            </main>

            {/* Right Panel - Info/Members/Notifications (Optional) */}
            {rightPanel && (
                <aside className="hidden xl:flex w-80 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] z-20 shadow-[-4px_0_12px_rgba(0,0,0,0.02)] transition-all duration-300">
                    {rightPanel}
                </aside>
            )}
        </div>
    );
}
