import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { AppShell } from '@/components/layout/AppShell';
import { Sidebar } from '@/components/layout/Sidebar';
import {
  listNotificationSettings,
  patchPreferences,
  setNotificationSetting,
} from '@/services/api';
import { usePreferencesStore } from '@/store/preferencesStore';
import { useThemeStore } from '@/store/themeStore';
import { useChatStore } from '@/store/chatStore';

export default function SettingsPage() {
  const router = useRouter();
  const rooms = useChatStore((s) => s.rooms);
  const { theme, density, fontSize, sidebarCollapsed, setTheme, setDensity, setFontSize, setSidebarCollapsed } =
    usePreferencesStore();
  const setThemeStoreTheme = useThemeStore((s) => s.setTheme);
  const [notificationSettings, setNotificationSettings] = useState<
    Record<string, { level: 'all' | 'mentions' | 'none'; quietHoursEnabled: boolean }>
  >({});

  useEffect(() => {
    listNotificationSettings()
      .then((rows) => {
        const map: Record<string, { level: 'all' | 'mentions' | 'none'; quietHoursEnabled: boolean }> = {};
        rows.forEach((r: any) => {
          map[r.roomId] = { level: r.level, quietHoursEnabled: Boolean(r.quietHoursEnabled) };
        });
        setNotificationSettings(map);
      })
      .catch(() => null);
  }, []);

  const saveAppearance = async (patch: any) => {
    await patchPreferences(patch).catch(() => null);
  };

  return (
    <AppShell sidebar={<Sidebar />}>
      <div className="h-full overflow-y-auto p-6 md:p-8">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-black tracking-tight">Settings</h1>
            <button onClick={() => router.back()} className="rounded-xl border border-[var(--color-border)] px-3 py-1.5 text-sm">
              Back
            </button>
          </div>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 text-lg font-bold">Appearance</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                Theme
                <select
                  value={theme}
                  onChange={(e) => {
                    const next = e.target.value as 'dark' | 'light' | 'midnight';
                    setTheme(next);
                    setThemeStoreTheme(next);
                    saveAppearance({ theme: next });
                  }}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="midnight">Midnight</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm">
                Density
                <select
                  value={density}
                  onChange={(e) => {
                    const next = e.target.value as 'compact' | 'comfortable' | 'cozy';
                    setDensity(next);
                    saveAppearance({ density: next });
                  }}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2"
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                  <option value="cozy">Cozy</option>
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm">
                Font size
                <select
                  value={fontSize}
                  onChange={(e) => {
                    const next = e.target.value as 'sm' | 'md' | 'lg';
                    setFontSize(next);
                    saveAppearance({ fontSize: next });
                  }}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                </select>
              </label>

              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={sidebarCollapsed}
                  onChange={(e) => {
                    setSidebarCollapsed(e.target.checked);
                    saveAppearance({ sidebarCollapsed: e.target.checked });
                  }}
                />
                Collapse sidebar by default
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
            <h2 className="mb-4 text-lg font-bold">Notifications</h2>
            <div className="space-y-3">
              {rooms.map((room) => {
                const value = notificationSettings[room._id] || { level: 'all' as const, quietHoursEnabled: false };
                return (
                  <div key={room._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2">
                    <div>
                      <p className="text-sm font-semibold">{room.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{room.type}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={value.level}
                        onChange={async (e) => {
                          const level = e.target.value as 'all' | 'mentions' | 'none';
                          const next = { ...value, level };
                          setNotificationSettings((prev) => ({ ...prev, [room._id]: next }));
                          await setNotificationSetting(room._id, next.level, next.quietHoursEnabled).catch(() => null);
                        }}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 py-1 text-xs"
                      >
                        <option value="all">All</option>
                        <option value="mentions">Mentions</option>
                        <option value="none">None</option>
                      </select>
                      <label className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={value.quietHoursEnabled}
                          onChange={async (e) => {
                            const next = { ...value, quietHoursEnabled: e.target.checked };
                            setNotificationSettings((prev) => ({ ...prev, [room._id]: next }));
                            await setNotificationSetting(room._id, next.level, next.quietHoursEnabled).catch(() => null);
                          }}
                        />
                        Quiet hours
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

