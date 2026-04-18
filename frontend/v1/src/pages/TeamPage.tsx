import { useState } from 'react'
import FeishuIntegrationSettings from '@/components/admin/FeishuIntegrationSettings'
import UserManagement from '@/components/admin/UserManagement'
import { useI18n } from '@/hooks/useI18n'
import { cn } from '@/lib/utils'

const TeamPage = () => {
  const [panel, setPanel] = useState<'agents' | 'integrations'>('agents')
  const { tx } = useI18n()

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-muted/30 via-background to-background p-6 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.75)]">
        <div className="space-y-3">
          <div className="text-[11px] font-black uppercase tracking-[0.32em] text-primary/80">
            {tx('Control Plane', '控制平面')}
          </div>
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-3xl font-black tracking-tight">
              {panel === 'agents' ? tx('Operations Studio', '运维工作台') : tx('Channel Integrations', '渠道集成')}
            </h2>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {panel === 'agents'
                ? tx('Manage agent runtimes, SSH assets, infrastructure nodes, and OpenHands delegation flows from one control surface.', '在一个控制面里统一管理 agent 运行时、SSH 资产、基础设施节点以及 OpenHands 委派链路。')
                : tx('Configure external channels and route their messages into Butler with explicit visibility and control.', '配置外部渠道，并将消息在可观测、可控的前提下路由给 Butler。')}
            </p>
          </div>
        </div>
        <div className="mt-5 grid w-full max-w-md grid-cols-2 gap-1 rounded-2xl border border-border/70 bg-background/60 p-1.5 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setPanel('agents')}
            className={cn(
              'h-10 px-3 text-xs font-black uppercase tracking-[0.2em] rounded-xl transition-all',
              panel === 'agents'
                ? 'bg-foreground text-background shadow-[0_10px_30px_-18px_rgba(255,255,255,0.95)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tx('Agents', 'agent')}
          </button>
          <button
            type="button"
            onClick={() => setPanel('integrations')}
            className={cn(
              'h-10 px-3 text-xs font-black uppercase tracking-[0.2em] rounded-xl transition-all',
              panel === 'integrations'
                ? 'bg-foreground text-background shadow-[0_10px_30px_-18px_rgba(255,255,255,0.95)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tx('Integrations', '集成')}
          </button>
        </div>
      </div>
      {panel === 'agents' ? <UserManagement /> : <FeishuIntegrationSettings />}
    </div>
  )
}

export default TeamPage
