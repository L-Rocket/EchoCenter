import { useState } from 'react'
import FeishuIntegrationSettings from '@/components/admin/FeishuIntegrationSettings'
import UserManagement from '@/components/admin/UserManagement'
import { useI18n } from '@/hooks/useI18n'
import { cn } from '@/lib/utils'

const TeamPage = () => {
  const [panel, setPanel] = useState<'agents' | 'integrations'>('agents')
  const { tx } = useI18n()

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="space-y-1 text-center md:text-left">
          <h2 className="text-2xl font-bold tracking-tight">
            {panel === 'agents' ? tx('Agent Operations', '代理管理') : tx('Integrations', '集成配置')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {panel === 'agents'
              ? tx('Create agents, manage tokens, and verify connectivity.', '创建代理、管理密钥并验证连接。')
              : tx('Configure external channels and route them into Butler.', '配置外部渠道并将消息路由到 Butler。')}
          </p>
        </div>
        <div className="grid w-full max-w-md grid-cols-2 gap-1 rounded-xl border bg-muted/30 p-1">
          <button
            type="button"
            onClick={() => setPanel('agents')}
            className={cn(
              'h-8 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors',
              panel === 'agents' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tx('Agents', '代理')}
          </button>
          <button
            type="button"
            onClick={() => setPanel('integrations')}
            className={cn(
              'h-8 px-3 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors',
              panel === 'integrations' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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
