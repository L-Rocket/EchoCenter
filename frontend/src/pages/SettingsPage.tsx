import { useMemo, useState } from 'react'
import { Bot, MessageSquareShare, Server, ShieldEllipsis } from 'lucide-react'
import FeishuIntegrationSettings from '@/components/admin/FeishuIntegrationSettings'
import UserManagement from '@/components/admin/UserManagement'
import { useI18n } from '@/hooks/useI18n'
import { cn } from '@/lib/utils'

type SettingsPanel = 'agents' | 'integrations' | 'nodes' | 'ssh'

const SettingsPage = () => {
  const { tx } = useI18n()
  const [panel, setPanel] = useState<SettingsPanel>('agents')

  const panels = useMemo(() => ([
    {
      key: 'agents' as const,
      label: tx('Agent Config', 'Agent 配置'),
      desc: tx('Create and tune registered runtimes.', '创建并调整已注册运行时。'),
      icon: Bot,
    },
    {
      key: 'integrations' as const,
      label: tx('Feishu', '飞书'),
      desc: tx('Configure inbound channel routing.', '配置外部渠道接入与路由。'),
      icon: MessageSquareShare,
    },
    {
      key: 'nodes' as const,
      label: tx('Nodes', '节点'),
      desc: tx('Attach infrastructure targets for runtime use.', '添加供运行时使用的基础设施目标。'),
      icon: Server,
    },
    {
      key: 'ssh' as const,
      label: tx('SSH Vault', 'SSH 密钥'),
      desc: tx('Manage encrypted SSH credentials.', '管理加密 SSH 凭据。'),
      icon: ShieldEllipsis,
    },
  ]), [tx])

  const activePanel = panels.find((item) => item.key === panel) ?? panels[0]

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-border/70 bg-gradient-to-br from-muted/25 via-background to-background p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.75)]">
        <div className="space-y-3">
          <div className="text-[11px] font-black uppercase tracking-[0.3em] text-primary/80">
            {tx('Configuration Matrix', '配置矩阵')}
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black tracking-tight lg:text-[2rem]">
              {tx('Settings Control Center', '设置控制中心')}
            </h2>
            <p className="max-w-3xl text-[13px] text-muted-foreground">
              {tx(
                'Keep runtime creation and infrastructure onboarding in configuration space, while Operations stays focused on visibility and execution health.',
                '将运行时创建和基础设施接入保留在配置空间中，让运维页专注于可观测性和执行健康。'
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[252px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 h-fit">
          <div className="rounded-[28px] border border-border/70 bg-card/60 p-3 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.75)] backdrop-blur-sm">
            <div className="px-3 pb-3 pt-2">
              <div className="text-[10px] font-black uppercase tracking-[0.28em] text-primary/80">
                {tx('Settings Views', '设置视图')}
              </div>
              <div className="mt-2 text-[13px] text-muted-foreground">
                {tx('Use configuration views for onboarding, credentials, and connector setup.', '用配置视图处理接入、凭据与渠道配置。')}
              </div>
            </div>
            <div className="space-y-2">
              {panels.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setPanel(item.key)}
                  className={cn(
                    'w-full rounded-2xl border px-3 py-3 text-left transition-all',
                    panel === item.key
                      ? 'border-primary bg-primary/10 shadow-[0_18px_50px_-35px_rgba(255,255,255,0.55)]'
                      : 'border-border/70 bg-background/50 hover:border-border'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 rounded-xl border p-2',
                      panel === item.key ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground'
                    )}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[11px] font-black uppercase tracking-[0.22em]">{item.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.desc}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-border/70 bg-card/40 p-5 backdrop-blur-sm">
            <div className="text-[10px] font-black uppercase tracking-[0.28em] text-primary/80">
              {tx('Current View', '当前视图')}
            </div>
            <h3 className="mt-2 text-xl font-black tracking-tight lg:text-2xl">{activePanel.label}</h3>
            <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{activePanel.desc}</p>
          </div>

          {panel === 'integrations' ? (
            <FeishuIntegrationSettings />
          ) : (
            <UserManagement mode="settings" forcedPanel={panel === 'agents' ? 'agents' : panel === 'nodes' ? 'nodes' : 'ssh'} />
          )}
        </section>
      </div>
    </div>
  )
}

export default SettingsPage
