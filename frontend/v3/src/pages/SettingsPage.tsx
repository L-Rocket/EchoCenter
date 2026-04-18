import { useMemo, useState } from 'react';
import { Bot, MessageSquareShare, Server, ShieldEllipsis, ChevronRight } from 'lucide-react';
import FeishuIntegrationSettings from '@/components/admin/FeishuIntegrationSettings';
import UserManagement from '@/components/admin/UserManagement';

type SettingsPanel = 'agents' | 'integrations' | 'nodes' | 'ssh';

const SettingsPage = () => {
  const [panel, setPanel] = useState<SettingsPanel>('agents');

  const panels = useMemo(
    () =>
      [
        {
          key: 'agents' as const,
          label: 'Agent Config',
          desc: 'Create and tune registered runtimes.',
          icon: Bot,
        },
        {
          key: 'integrations' as const,
          label: 'Feishu',
          desc: 'Configure inbound channel routing.',
          icon: MessageSquareShare,
        },
        {
          key: 'nodes' as const,
          label: 'Nodes',
          desc: 'Attach infrastructure targets for runtime use.',
          icon: Server,
        },
        {
          key: 'ssh' as const,
          label: 'SSH Vault',
          desc: 'Manage encrypted SSH credentials.',
          icon: ShieldEllipsis,
        },
      ] as const,
    []
  );

  const activePanel = panels.find((p) => p.key === panel) ?? panels[0];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, marginBottom: 24 }}>
        <div style={{ maxWidth: 720 }}>
          <div className="eyebrow">Admin · Settings</div>
          <h1 className="h1-display" style={{ margin: '10px 0 8px' }}>Configuration matrix.</h1>
          <p style={{ margin: 0, color: 'var(--fg-muted)', fontSize: 14 }}>
            Runtime creation, credentials, and connector wiring live here. Operations keeps the visibility view.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '252px minmax(0, 1fr)', gap: 20 }}>
        <aside style={{ position: 'sticky', top: 20, alignSelf: 'start' }}>
          <div className="v3-card" style={{ padding: 8 }}>
            <div style={{ padding: '8px 10px 6px' }}>
              <div className="eyebrow">Settings Views</div>
              <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 6, lineHeight: 1.5 }}>
                Onboarding, credentials, and connector setup.
              </div>
            </div>
            {panels.map((item) => {
              const active = panel === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setPanel(item.key)}
                  style={{
                    width: '100%',
                    border: 'none',
                    background: active ? 'var(--bg-sunken)' : 'transparent',
                    boxShadow: active ? 'inset 0 0 0 1px var(--border-base)' : undefined,
                    borderRadius: 10,
                    padding: 12,
                    textAlign: 'left',
                    cursor: 'pointer',
                    marginTop: 4,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    color: 'var(--fg)',
                    transition: 'all 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                  }}
                >
                  <div
                    style={{
                      marginTop: 2,
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      display: 'grid',
                      placeItems: 'center',
                      background: active ? 'var(--accent-soft)' : 'var(--bg-sunken)',
                      color: active ? 'var(--accent-hue)' : 'var(--fg-muted)',
                      border: '1px solid var(--border-faint)',
                    }}
                  >
                    <item.icon size={14} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="eyebrow" style={{ fontSize: 10 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--fg-muted)', marginTop: 4, lineHeight: 1.5 }}>
                      {item.desc}
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: active ? 'var(--accent-hue)' : 'var(--fg-faint)', alignSelf: 'center' }} />
                </button>
              );
            })}
          </div>
        </aside>

        <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="v3-card" style={{ padding: '18px 20px' }}>
            <div className="eyebrow">Current view</div>
            <h2 className="h2-display" style={{ margin: '8px 0 6px' }}>{activePanel.label}</h2>
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: 0 }}>{activePanel.desc}</p>
          </div>
          <div className="v3-card" style={{ padding: 0, overflow: 'hidden' }}>
            {panel === 'integrations' ? (
              <FeishuIntegrationSettings />
            ) : (
              <UserManagement mode="settings" forcedPanel={panel === 'agents' ? 'agents' : panel === 'nodes' ? 'nodes' : 'ssh'} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
