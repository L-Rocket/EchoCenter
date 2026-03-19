import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  PlugZap,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldEllipsis,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useI18n } from '@/hooks/useI18n';
import { getWsUrl } from '@/lib/config';
import { userService } from '@/services/userService';
import type { Agent, InfraNode, OpenHandsStatus, SSHKey } from '@/types';

type ConnectionState = 'idle' | 'testing' | 'success' | 'failed';

interface ConnectionResult {
  state: ConnectionState;
  message: string;
}

interface RuntimeStatusBadge {
  variant: 'success' | 'info' | 'muted' | 'warning';
  label: string;
  pulse: boolean;
}

type OperationsPanel = 'agents' | 'ssh' | 'nodes' | 'openhands';

const PAGE_SIZE = 5;
const TOKEN_CACHE_KEY = 'echocenter_agent_token_cache_v1';

const IDLE_CONNECTION_RESULT: ConnectionResult = {
  state: 'idle',
  message: 'You can run a connection test before creation if needed.',
};

const generateAgentToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `agent-${crypto.randomUUID().replace(/-/g, '')}`;
  }
  return `agent-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const readTokenCache = (): Record<number, string> => {
  try {
    const raw = localStorage.getItem(TOKEN_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const normalized: Record<number, string> = {};
    Object.entries(parsed).forEach(([k, v]) => {
      const id = Number(k);
      if (!Number.isNaN(id) && typeof v === 'string') {
        normalized[id] = v;
      }
    });
    return normalized;
  } catch (_err) {
    return {};
  }
};

const writeTokenCache = (next: Record<number, string>) => {
  try {
    localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(next));
  } catch (_err) {
    // ignore storage errors
  }
};

const getRuntimeStatusBadge = (agent?: Agent | null): RuntimeStatusBadge => {
  if (!agent) return { variant: 'warning', label: 'Unknown', pulse: false };
  const status = String(agent.status || '').toUpperCase();
  if (agent.online === true || status === 'ONLINE') {
    return { variant: 'success', label: 'Online', pulse: true };
  }
  if (status === 'IDLE') {
    return { variant: 'info', label: 'Idle', pulse: false };
  }
  if (agent.online === false || status === 'OFFLINE') {
    return { variant: 'muted', label: 'Offline', pulse: false };
  }
  return { variant: 'warning', label: 'Unknown', pulse: false };
};

const UserManagement = () => {
  const { tx, isZh } = useI18n();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentToken, setNewAgentToken] = useState(generateAgentToken());
  const [newAgentKind, setNewAgentKind] = useState<'generic' | 'openhands_ops'>('generic');
  const [newAgentDescription, setNewAgentDescription] = useState('');
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateTesting, setIsCreateTesting] = useState(false);
  const [createConnection, setCreateConnection] = useState<ConnectionResult>(IDLE_CONNECTION_RESULT);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [tokenDrafts, setTokenDrafts] = useState<Record<number, string>>({});
  const [tokenVisible, setTokenVisible] = useState<Record<number, boolean>>({});
  const [isSavingToken, setIsSavingToken] = useState<Record<number, boolean>>({});
  const [agentConnection, setAgentConnection] = useState<Record<number, ConnectionResult>>({});
  const [isCreateTokenCopied, setIsCreateTokenCopied] = useState(false);
  const [isAgentTokenCopied, setIsAgentTokenCopied] = useState<Record<number, boolean>>({});
  const [page, setPage] = useState(1);
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [isManageSheetOpen, setIsManageSheetOpen] = useState(false);
  const [sshKeys, setSSHKeys] = useState<SSHKey[]>([]);
  const [infraNodes, setInfraNodes] = useState<InfraNode[]>([]);
  const [newSSHKeyName, setNewSSHKeyName] = useState('');
  const [newSSHPublicKey, setNewSSHPublicKey] = useState('');
  const [newSSHPrivateKey, setNewSSHPrivateKey] = useState('');
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeHost, setNewNodeHost] = useState('');
  const [newNodePort, setNewNodePort] = useState('22');
  const [newNodeSSHUser, setNewNodeSSHUser] = useState('root');
  const [newNodeSSHKeyID, setNewNodeSSHKeyID] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');
  const [opsError, setOpsError] = useState('');
  const [isCreatingSSHKey, setIsCreatingSSHKey] = useState(false);
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [deletingSSHKeyID, setDeletingSSHKeyID] = useState<number | null>(null);
  const [deletingNodeID, setDeletingNodeID] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<OperationsPanel>('agents');
  const [openhandsStatus, setOpenhandsStatus] = useState<OpenHandsStatus | null>(null);

  const wsUrl = getWsUrl();

  const probeConnectionViaWs = useCallback(async (token: string): Promise<ConnectionResult> => {
    return new Promise<ConnectionResult>((resolve) => {
      let settled = false;
      let opened = false;
      const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);

      const finish = (result: ConnectionResult) => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch (_err) {
          // ignore close errors
        }
        resolve(result);
      };

      const timeoutId = window.setTimeout(() => {
        finish({
          state: 'failed',
          message: 'Connection timed out (5s).',
        });
      }, 5000);

      ws.onopen = () => {
        opened = true;
        window.clearTimeout(timeoutId);
        finish({
          state: 'success',
          message: 'Gateway accepted this token.',
        });
      };

      ws.onerror = () => {
        window.clearTimeout(timeoutId);
        finish({
          state: 'failed',
          message: 'Gateway rejected this token.',
        });
      };

      ws.onclose = () => {
        if (!opened) {
          window.clearTimeout(timeoutId);
          finish({
            state: 'failed',
            message: 'Connection closed before handshake completed.',
          });
        }
      };
    });
  }, [wsUrl]);

  const fetchAgents = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const data = await userService.getAgents();
      const cache = readTokenCache();
      const agentList = (Array.isArray(data) ? data : []).filter(
        (agent) => (agent.role || '').toUpperCase() === 'AGENT'
      );

      setAgents(agentList);
      setTokenDrafts((prev) => {
        const next: Record<number, string> = {};
        agentList.forEach((agent) => {
          const draft = (prev[agent.id] ?? '').trim();
          if (draft) {
            next[agent.id] = prev[agent.id];
            return;
          }
          next[agent.id] = (agent.api_token ?? cache[agent.id] ?? '').trim();
        });
        return next;
      });
      setError('');
      return agentList;
    } catch (_err) {
      if (!silent) setError('Failed to load agent list from backend.');
      return [];
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  const fetchOpsResources = useCallback(async () => {
    try {
      const [keys, nodes, status] = await Promise.all([
        userService.listSSHKeys(),
        userService.listInfraNodes(),
        userService.getOpenHandsStatus(),
      ]);
      setSSHKeys(Array.isArray(keys) ? keys : []);
      setInfraNodes(Array.isArray(nodes) ? nodes : []);
      setOpenhandsStatus(status ?? null);
      setOpsError('');
    } catch (_err) {
      setOpsError('Failed to load OpenHands ops resources from backend.');
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const init = async () => {
      await fetchAgents(false);
      await fetchOpsResources();
    };

    void init();
    const interval = window.setInterval(() => {
      if (!alive) return;
      void fetchAgents(true);
    }, 10000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [fetchAgents, fetchOpsResources]);

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter((agent) => (agent.username || '').toLowerCase().includes(q));
  }, [agents, searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, agents.length]);

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedAgents = filteredAgents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? null,
    [agents, selectedAgentId]
  );

  const runConnectionTest = useCallback(async (token: string): Promise<ConnectionResult> => {
    if (!token.trim()) {
      return { state: 'failed', message: 'Token is required for connection test.' };
    }

    try {
      const result = await userService.testAgentConnection(token);
      if (typeof result === 'object' && result && 'ok' in (result as Record<string, unknown>)) {
        const ok = Boolean((result as { ok?: boolean }).ok);
        const message = String((result as { message?: string }).message || (ok ? 'Connection succeeded.' : 'Connection failed.'));
        return { state: ok ? 'success' : 'failed', message };
      }
      return { state: 'success', message: 'Connection check completed.' };
    } catch (_err) {
      return probeConnectionViaWs(token);
    }
  }, [probeConnectionViaWs]);

  const copyToClipboard = useCallback(async (text: string) => {
    if (!text) return false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_err) {
        // fallback below
      }
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch (_err) {
      return false;
    }
  }, []);

  const handleCopyCreateToken = useCallback(async () => {
    const copied = await copyToClipboard(newAgentToken.trim());
    if (!copied) return;
    setIsCreateTokenCopied(true);
    window.setTimeout(() => setIsCreateTokenCopied(false), 1200);
  }, [copyToClipboard, newAgentToken]);

  const handleCopyAgentToken = useCallback(async (agentId: number) => {
    const draft = (tokenDrafts[agentId] || '').trim();
    const fromApi = (agents.find((agent) => agent.id === agentId)?.api_token || '').trim();
    const copied = await copyToClipboard(draft || fromApi);
    if (!copied) return;

    setIsAgentTokenCopied((prev) => ({ ...prev, [agentId]: true }));
    window.setTimeout(() => {
      setIsAgentTokenCopied((prev) => ({ ...prev, [agentId]: false }));
    }, 1200);
  }, [agents, copyToClipboard, tokenDrafts]);

  const handleTestCreateToken = async () => {
    if (isCreateTesting) return;
    setIsCreateTesting(true);
    setCreateConnection({ state: 'testing', message: 'Testing connection...' });
    const result = await runConnectionTest(newAgentToken.trim());
    setCreateConnection(result);
    setIsCreateTesting(false);
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = newAgentName.trim();
    const token = newAgentToken.trim();
    if (!username || isCreating || (newAgentKind === 'generic' && !token)) return;

    setIsCreating(true);
    setCreateError('');
    try {
      await userService.createAgent({
        username,
        apiToken: newAgentKind === 'generic' ? token : undefined,
        agentKind: newAgentKind,
        runtimeKind: newAgentKind === 'openhands_ops' ? 'openhands' : 'websocket',
        description: newAgentDescription.trim(),
      });
      const latestAgents = await fetchAgents();
      setNewAgentName('');
      setNewAgentToken(generateAgentToken());
      setNewAgentKind('generic');
      setNewAgentDescription('');
      setCreateConnection(IDLE_CONNECTION_RESULT);

      setTokenDrafts((prev) => {
        const next = { ...prev };
        const created = latestAgents.find((agent) => agent.username === username);
        if (created?.id) {
          if (token) {
            next[created.id] = token;
            const cache = readTokenCache();
            cache[created.id] = token;
            writeTokenCache(cache);
          }
        }
        return next;
      });
      setIsCreateSheetOpen(false);
    } catch (err) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setCreateError(axiosError.response?.data?.error || 'Failed to create agent.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSaveToken = async (agentId: number) => {
    const token = (tokenDrafts[agentId] || '').trim();
    if (!token) {
      setAgentConnection((prev) => ({
        ...prev,
        [agentId]: { state: 'failed', message: 'Token cannot be empty.' },
      }));
      return;
    }

    setIsSavingToken((prev) => ({ ...prev, [agentId]: true }));
    try {
      await userService.updateAgentToken(agentId, token);
      setAgentConnection((prev) => ({
        ...prev,
        [agentId]: { state: 'success', message: 'Token saved to backend.' },
      }));
      const cache = readTokenCache();
      cache[agentId] = token;
      writeTokenCache(cache);
    } catch (_err) {
      setAgentConnection((prev) => ({
        ...prev,
        [agentId]: {
          state: 'failed',
          message: 'Token update API is not ready; value is kept for this session only.',
        },
      }));
      const cache = readTokenCache();
      cache[agentId] = token;
      writeTokenCache(cache);
    } finally {
      setIsSavingToken((prev) => ({ ...prev, [agentId]: false }));
    }
  };

  const handleTestAgentToken = async (agentId: number) => {
    const token = (tokenDrafts[agentId] || '').trim();
    setAgentConnection((prev) => ({
      ...prev,
      [agentId]: { state: 'testing', message: 'Testing connection...' },
    }));
    const result = await runConnectionTest(token);
    setAgentConnection((prev) => ({
      ...prev,
      [agentId]: result,
    }));
  };

  const getStateBadge = (state: ConnectionState) => {
    if (state === 'success') return { variant: 'success' as const, label: tx('Connected', '已连接') };
    if (state === 'failed') return { variant: 'error' as const, label: tx('Failed', '失败') };
    if (state === 'testing') return { variant: 'warning' as const, label: tx('Testing', '测试中') };
    return { variant: 'muted' as const, label: tx('Idle', '空闲') };
  };

  const maskToken = (token: string) => {
    if (!token) return 'Not set';
    if (token.length <= 12) return token;
    return `${token.slice(0, 4)}${'*'.repeat(Math.max(8, token.length - 8))}${token.slice(-4)}`;
  };

  const formatCreatedAt = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  const resetCreateForm = () => {
    setNewAgentName('');
    setNewAgentToken(generateAgentToken());
    setNewAgentKind('generic');
    setNewAgentDescription('');
    setCreateError('');
    setCreateConnection(IDLE_CONNECTION_RESULT);
    setIsCreateTesting(false);
    setIsCreateTokenCopied(false);
  };

  const handleCreateSSHKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSSHKeyName.trim() || !newSSHPrivateKey.trim() || isCreatingSSHKey) return;
    setIsCreatingSSHKey(true);
    try {
      await userService.createSSHKey({
        name: newSSHKeyName.trim(),
        public_key: newSSHPublicKey.trim(),
        private_key: newSSHPrivateKey,
      });
      setNewSSHKeyName('');
      setNewSSHPublicKey('');
      setNewSSHPrivateKey('');
      await fetchOpsResources();
    } catch (_err) {
      setOpsError('Failed to create SSH key.');
    } finally {
      setIsCreatingSSHKey(false);
    }
  };

  const handleDeleteSSHKey = async (id: number) => {
    setDeletingSSHKeyID(id);
    try {
      await userService.deleteSSHKey(id);
      await fetchOpsResources();
    } catch (_err) {
      setOpsError('Failed to delete SSH key.');
    } finally {
      setDeletingSSHKeyID(null);
    }
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    const sshKeyID = Number(newNodeSSHKeyID);
    if (!newNodeName.trim() || !newNodeHost.trim() || !newNodeSSHUser.trim() || Number.isNaN(sshKeyID) || sshKeyID <= 0 || isCreatingNode) return;
    setIsCreatingNode(true);
    try {
      await userService.createInfraNode({
        name: newNodeName.trim(),
        host: newNodeHost.trim(),
        port: Math.max(1, Number(newNodePort) || 22),
        ssh_user: newNodeSSHUser.trim(),
        ssh_key_id: sshKeyID,
        description: newNodeDescription.trim(),
      });
      setNewNodeName('');
      setNewNodeHost('');
      setNewNodePort('22');
      setNewNodeSSHUser('root');
      setNewNodeSSHKeyID('');
      setNewNodeDescription('');
      await fetchOpsResources();
    } catch (_err) {
      setOpsError('Failed to create infra node.');
    } finally {
      setIsCreatingNode(false);
    }
  };

  const handleDeleteNode = async (id: number) => {
    setDeletingNodeID(id);
    try {
      await userService.deleteInfraNode(id);
      await fetchOpsResources();
    } catch (_err) {
      setOpsError('Failed to delete infra node.');
    } finally {
      setDeletingNodeID(null);
    }
  };

  const openCreateSheet = () => {
    resetCreateForm();
    setIsCreateSheetOpen(true);
  };

  const openManageSheet = (agentId: number) => {
    const cache = readTokenCache();
    setTokenDrafts((prev) => {
      if ((prev[agentId] || '').trim()) return prev;
      const agent = agents.find((item) => item.id === agentId);
      const fallbackToken = (agent?.api_token ?? cache[agentId] ?? '').trim();
      if (!fallbackToken) return prev;
      return {
        ...prev,
        [agentId]: fallbackToken,
      };
    });
    setTokenVisible((prev) => ({
      ...prev,
      [agentId]: true,
    }));
    setSelectedAgentId(agentId);
    setIsManageSheetOpen(true);
  };

  const localizeMessage = (message: string) => {
    if (!isZh) return message;
    const map: Record<string, string> = {
      'You can run a connection test before creation if needed.': '如有需要，可在创建前先测试连接。',
      'Connection timed out (5s).': '连接超时（5 秒）。',
      'Gateway accepted this token.': '网关已接受该密钥。',
      'Gateway rejected this token.': '网关拒绝了该密钥。',
      'Connection closed before handshake completed.': '握手完成前连接已关闭。',
      'Failed to load agent list from backend.': '从后端加载 agent 列表失败。',
      'Token is required for connection test.': '测试连接需要提供密钥。',
      'Connection succeeded.': '连接成功。',
      'Connection failed.': '连接失败。',
      'Connection check completed.': '连接检测已完成。',
      'Testing connection...': '正在测试连接...',
      'Failed to create agent.': '创建 agent 失败。',
      'Token cannot be empty.': '密钥不能为空。',
      'Token saved to backend.': '密钥已保存到后端。',
      'Token update API is not ready; value is kept for this session only.': '后端更新密钥 API 暂未就绪，当前值仅保留在本次会话中。',
      'Not tested yet.': '尚未进行连接测试。',
      'No agents matched your search.': '未匹配到任何 agent。',
      'No agent selected.': '未选择 agent。',
      'Failed to load OpenHands ops resources from backend.': '从后端加载 OpenHands 运维资源失败。',
      'Failed to create SSH key.': '创建 SSH 密钥失败。',
      'Failed to delete SSH key.': '删除 SSH 密钥失败。',
      'Failed to create infra node.': '创建基础设施节点失败。',
      'Failed to delete infra node.': '删除基础设施节点失败。',
    };
    return map[message] ?? message;
  };

  const panelButtonClass = (panel: OperationsPanel) =>
    `h-9 rounded-full border-2 px-4 text-[10px] uppercase tracking-widest font-black ${
      activePanel === panel ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-background'
    }`;

  const managedOpenHandsAgent = useMemo(
    () => agents.find((agent) => agent.agent_kind === 'openhands_ops') ?? null,
    [agents]
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tighter italic">
            {tx('Operations', '运维')} <span className="text-primary">{tx('Control Center', '控制中心')}</span>
          </h2>
          <p className="text-sm text-muted-foreground font-medium">
            {tx('Operate agents, SSH assets, infrastructure nodes, and OpenHands runtime from one place.', '在一个页面统一管理 agent、SSH 资产、基础设施节点与 OpenHands 运行时。')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={openCreateSheet}
            className="h-9 gap-2 border-2 uppercase font-black tracking-widest text-[10px]"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {tx('New Agent', '新建 agent')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fetchAgents();
              void fetchOpsResources();
            }}
            disabled={isLoading}
            className="h-9 gap-2 border-2 uppercase font-black tracking-widest text-[10px]"
          >
            <RefreshCw className={isLoading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
            {tx('Refresh', '刷新')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={panelButtonClass('agents')} onClick={() => setActivePanel('agents')}>
          {tx('Agents', 'Agents')}
        </button>
        <button type="button" className={panelButtonClass('ssh')} onClick={() => setActivePanel('ssh')}>
          {tx('SSH Vault', 'SSH 密钥库')}
        </button>
        <button type="button" className={panelButtonClass('nodes')} onClick={() => setActivePanel('nodes')}>
          {tx('Nodes', '基础设施节点')}
        </button>
        <button type="button" className={panelButtonClass('openhands')} onClick={() => setActivePanel('openhands')}>
          {tx('OpenHands', 'OpenHands')}
        </button>
      </div>

      {activePanel === 'agents' && (
      <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4 gap-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              {tx('Agent Tokens', 'Agent 密钥列表')}
            </CardTitle>
            <Badge variant="outline" className="h-6 text-[10px] uppercase tracking-wider">
              {tx(`Total ${filteredAgents.length}`, `共 ${filteredAgents.length} 条`)}
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tx('Search by agent name', '按 agent 名称搜索')}
              className="h-9 pl-9 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-semibold">
              {localizeMessage(error)}
            </div>
          )}

          {filteredAgents.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-8 text-center text-xs text-muted-foreground">
              {localizeMessage('No agents matched your search.')}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="hidden md:grid md:grid-cols-[160px_minmax(260px,2fr)_200px_220px] gap-3 px-4 py-2.5 border-b bg-muted/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>{tx('Agent Name', 'Agent 名称')}</span>
                <span>{tx('Token', '密钥')}</span>
                <span>{tx('Created At', '创建时间')}</span>
                <span className="text-right">{tx('Actions', '操作')}</span>
              </div>

              {paginatedAgents.map((agent) => {
                const tokenDraft = (tokenDrafts[agent.id] ?? '').trim();
                const tokenFromApi = (agent.api_token ?? '').trim();
                const tokenValue = tokenDraft || tokenFromApi;
                const tokenDisplay = tokenValue || (agent.token_hint ?? '').trim();
                const runtimeBadge = getRuntimeStatusBadge(agent);

                return (
                  <div
                    key={agent.id}
                    className="grid grid-cols-1 md:grid-cols-[160px_minmax(260px,2fr)_200px_220px] gap-3 px-4 py-3 border-b last:border-b-0 items-center"
                  >
                    <div>
                      <div className="text-sm truncate">{agent.username}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {agent.agent_kind === 'openhands_ops'
                          ? tx('OpenHands Ops', 'OpenHands 运维')
                          : tx('WebSocket Agent', 'WebSocket Agent')}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-mono truncate">
                          {tokenVisible[agent.id] ? (tokenValue || tokenDisplay || 'Not set') : maskToken(tokenDisplay)}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[10px] shrink-0"
                          onClick={() =>
                            setTokenVisible((prev) => ({
                              ...prev,
                              [agent.id]: !prev[agent.id],
                            }))
                          }
                          disabled={!tokenValue}
                        >
                          {tokenVisible[agent.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[10px] shrink-0"
                          onClick={() => handleCopyAgentToken(agent.id)}
                          disabled={!tokenValue}
                        >
                          {isAgentTokenCopied[agent.id] ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          {isAgentTokenCopied[agent.id] ? tx('Copied', '已复制') : tx('Copy', '复制')}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">ID #{agent.id}</p>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {formatCreatedAt(agent.created_at)}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden sm:flex items-center gap-1.5">
                        <StatusIndicator variant={runtimeBadge.variant} pulse={runtimeBadge.pulse} />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          {runtimeBadge.label}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] uppercase tracking-wider"
                        onClick={() => openManageSheet(agent.id)}
                      >
                        {tx('Edit', '编辑')}
                        <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredAgents.length > 0 && (
            <div className="pt-1 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">
                {tx(`Page ${currentPage} / ${totalPages}`, `第 ${currentPage} / ${totalPages} 页`)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {activePanel === 'ssh' && (
      <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4 gap-2">
          <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <ShieldEllipsis className="h-4 w-4 text-primary" />
            {tx('SSH Key Vault', 'SSH 密钥库')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {tx('Private keys are encrypted in the backend and only decrypted for OpenHands runtime execution.', '私钥会在后端加密保存，仅在 OpenHands 运行时短暂解密使用。')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateSSHKey} className="space-y-3">
            <Input value={newSSHKeyName} onChange={(e) => setNewSSHKeyName(e.target.value)} placeholder={tx('SSH key name', 'SSH 密钥名称')} className="h-9 text-xs" />
            <Input value={newSSHPublicKey} onChange={(e) => setNewSSHPublicKey(e.target.value)} placeholder={tx('Public key (optional)', '公钥（可选）')} className="h-9 text-xs font-mono" />
            <textarea value={newSSHPrivateKey} onChange={(e) => setNewSSHPrivateKey(e.target.value)} placeholder={tx('Private key', '私钥')} className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-xs font-mono" />
            <Button type="submit" className="h-9 text-[10px] uppercase tracking-widest" disabled={isCreatingSSHKey || !newSSHKeyName.trim() || !newSSHPrivateKey.trim()}>
              {isCreatingSSHKey ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}
              {tx('Add SSH Key', '添加 SSH 密钥')}
            </Button>
          </form>
          <div className="space-y-2">
            {sshKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{key.name}</div>
                  <div className="text-[11px] text-muted-foreground">{key.public_key ? maskToken(key.public_key) : tx('Private key stored securely', '私钥已安全存储')}</div>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => handleDeleteSSHKey(key.id)} disabled={deletingSSHKeyID === key.id}>
                  {deletingSSHKeyID === key.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            ))}
            {sshKeys.length === 0 && (
              <div className="rounded-md border bg-muted/20 p-4 text-xs text-muted-foreground">
                {tx('No SSH keys configured yet.', '暂未配置 SSH 密钥。')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {activePanel === 'nodes' && (
      <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4 gap-2">
          <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            {tx('Infrastructure Nodes', '基础设施节点')}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {tx('These SSH nodes are made available to the backend-managed OpenHands Ops Agent.', '这些 SSH 节点会提供给后端托管的 OpenHands 运维 Agent。')}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCreateNode} className="grid gap-3 md:grid-cols-2">
            <Input value={newNodeName} onChange={(e) => setNewNodeName(e.target.value)} placeholder={tx('Node name', '节点名称')} className="h-9 text-xs" />
            <Input value={newNodeHost} onChange={(e) => setNewNodeHost(e.target.value)} placeholder={tx('Host', '主机地址')} className="h-9 text-xs" />
            <Input value={newNodeSSHUser} onChange={(e) => setNewNodeSSHUser(e.target.value)} placeholder={tx('SSH user', 'SSH 用户')} className="h-9 text-xs" />
            <Input value={newNodePort} onChange={(e) => setNewNodePort(e.target.value)} placeholder={tx('Port', '端口')} className="h-9 text-xs" />
            <select value={newNodeSSHKeyID} onChange={(e) => setNewNodeSSHKeyID(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-xs md:col-span-2">
              <option value="">{tx('Select SSH key', '选择 SSH 密钥')}</option>
              {sshKeys.map((key) => (
                <option key={key.id} value={String(key.id)}>{key.name}</option>
              ))}
            </select>
            <Input value={newNodeDescription} onChange={(e) => setNewNodeDescription(e.target.value)} placeholder={tx('Description (optional)', '描述（可选）')} className="h-9 text-xs md:col-span-2" />
            <div className="md:col-span-2">
              <Button type="submit" className="h-9 text-[10px] uppercase tracking-widest" disabled={isCreatingNode || !newNodeName.trim() || !newNodeHost.trim() || !newNodeSSHUser.trim() || !newNodeSSHKeyID}>
                {isCreatingNode ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Server className="mr-1 h-4 w-4" />}
                {tx('Add Node', '添加节点')}
              </Button>
            </div>
          </form>
          <div className="space-y-2">
            {infraNodes.map((node) => {
              const keyName = sshKeys.find((key) => key.id === node.ssh_key_id)?.name || `#${node.ssh_key_id}`;
              return (
                <div key={node.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{node.name}</div>
                    <div className="text-[11px] text-muted-foreground">{node.ssh_user}@{node.host}:{node.port} · {keyName}</div>
                    {node.description && <div className="text-[11px] text-muted-foreground">{node.description}</div>}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => handleDeleteNode(node.id)} disabled={deletingNodeID === node.id}>
                    {deletingNodeID === node.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              );
            })}
            {infraNodes.length === 0 && (
              <div className="rounded-md border bg-muted/20 p-4 text-xs text-muted-foreground">
                {tx('No infrastructure nodes configured yet.', '暂未配置基础设施节点。')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      )}

      {activePanel === 'openhands' && (
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4 gap-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <PlugZap className="h-4 w-4 text-primary" />
              {tx('OpenHands Runtime', 'OpenHands 运行时')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {tx('Monitor the backend-managed OpenHands worker and the infrastructure context Butler can delegate into.', '监控后端托管的 OpenHands worker 以及 Butler 可委派进入的基础设施上下文。')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tx('Mode', '运行模式')}</div>
                <div className="mt-1 text-lg font-black">{openhandsStatus?.worker_mode || tx('Unknown', '未知')}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tx('Health', '健康状态')}</div>
                <div className="mt-2 flex items-center gap-2">
                  <StatusIndicator variant={openhandsStatus?.worker_reachable ? 'success' : 'warning'} pulse={Boolean(openhandsStatus?.worker_reachable)} />
                  <span className="text-sm font-semibold">
                    {openhandsStatus?.enabled
                      ? openhandsStatus?.worker_reachable
                        ? tx('Reachable', '可连接')
                        : tx('Not Reachable', '不可连接')
                      : tx('Disabled', '已关闭')}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tx('Managed Agent', '托管 Agent')}</div>
                <div className="mt-1 text-sm font-semibold">{openhandsStatus?.managed_agent_name || managedOpenHandsAgent?.username || tx('Not provisioned', '未创建')}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tx('Service URL', '服务地址')}</div>
                <div className="mt-1 break-all text-xs text-muted-foreground">{openhandsStatus?.service_url || tx('Local runner fallback', '本地 runner 回退')}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4 gap-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              {tx('Delegation Surface', '委派面')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {tx('Summarizes what OpenHands can reach when Butler delegates an operations task.', '总结 Butler 委派运维任务时，OpenHands 当前可触达的范围。')}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tx('SSH Keys', 'SSH 密钥')}</div>
                <div className="mt-1 text-lg font-black">{openhandsStatus?.ssh_key_count ?? sshKeys.length}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tx('Nodes', '节点')}</div>
                <div className="mt-1 text-lg font-black">{openhandsStatus?.node_count ?? infraNodes.length}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tx('Runtime Kind', '运行时类型')}</div>
                <div className="mt-1 text-lg font-black">{managedOpenHandsAgent?.runtime_kind || tx('OpenHands', 'OpenHands')}</div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground">
              {tx('SSH keys are encrypted at rest, nodes are reachable over SSH, and Butler can delegate concrete operations to the backend-managed OpenHands agent after approval.', 'SSH 密钥静态加密保存，节点通过 SSH 接入，Butler 在审批后可以把具体运维任务委派给后端托管的 OpenHands agent。')}
            </div>
            {managedOpenHandsAgent && (
              <div className="rounded-lg border p-4">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tx('Managed Agent Identity', '托管 Agent 身份')}</div>
                <div className="mt-2 text-sm font-semibold">{managedOpenHandsAgent.username}</div>
                <div className="text-[11px] text-muted-foreground">#{managedOpenHandsAgent.id} · {managedOpenHandsAgent.description || tx('Backend-managed operations agent', '后端托管运维 Agent')}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {opsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-semibold">
          {localizeMessage(opsError)}
        </div>
      )}

      <Sheet
        open={isCreateSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateSheetOpen(false);
            return;
          }
          openCreateSheet();
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="border-b">
            <SheetTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-primary" />
              {tx('Create Agent', '新建 agent')}
            </SheetTitle>
            <SheetDescription>
              {tx('Generate token, test connection, and create an agent.', '生成密钥、测试连接并创建 agent。')}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleCreateAgent} className="flex h-full flex-col">
            <div className="space-y-4 p-4">
              <Input
                placeholder={tx('Agent name', 'agent 名称')}
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="h-10 bg-muted/50 border-2 focus:border-primary text-xs"
                disabled={isCreating}
              />

              <select
                value={newAgentKind}
                onChange={(e) => setNewAgentKind(e.target.value as 'generic' | 'openhands_ops')}
                className="h-10 w-full rounded-md border-2 bg-muted/50 px-3 text-xs"
                disabled={isCreating}
              >
                <option value="generic">{tx('Generic WebSocket Agent', '通用 WebSocket Agent')}</option>
                <option value="openhands_ops">{tx('OpenHands Ops Agent', 'OpenHands 运维 Agent')}</option>
              </select>

              <Input
                placeholder={tx('Description (optional)', '描述（可选）')}
                value={newAgentDescription}
                onChange={(e) => setNewAgentDescription(e.target.value)}
                className="h-10 bg-muted/50 border-2 focus:border-primary text-xs"
                disabled={isCreating}
              />

              <div className="space-y-2">
                <Input
                  placeholder={tx('Agent token', 'agent 密钥')}
                  value={newAgentToken}
                  onChange={(e) => setNewAgentToken(e.target.value)}
                  className="h-10 bg-muted/50 border-2 focus:border-primary font-mono text-xs"
                  disabled={isCreating || newAgentKind === 'openhands_ops'}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-[10px] uppercase tracking-wider"
                    onClick={() => setNewAgentToken(generateAgentToken())}
                    disabled={isCreating || newAgentKind === 'openhands_ops'}
                  >
                    <KeyRound className="h-3.5 w-3.5 mr-1" />
                    {tx('Generate', '生成')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-[10px] uppercase tracking-wider"
                    onClick={handleTestCreateToken}
                    disabled={isCreating || isCreateTesting || !newAgentToken.trim() || newAgentKind === 'openhands_ops'}
                  >
                    {isCreateTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <PlugZap className="h-3.5 w-3.5 mr-1" />}
                    {tx('Test', '测试连接')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-[10px] uppercase tracking-wider"
                    onClick={handleCopyCreateToken}
                    disabled={!newAgentToken.trim() || newAgentKind === 'openhands_ops'}
                  >
                    {isCreateTokenCopied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {isCreateTokenCopied ? tx('Copied', '已复制') : tx('Copy', '复制')}
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <StatusIndicator
                    variant={getStateBadge(createConnection.state).variant}
                    pulse={createConnection.state === 'testing'}
                  />
                  <span className="text-xs font-semibold">{getStateBadge(createConnection.state).label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{localizeMessage(createConnection.message)}</p>
              </div>

              {createError && (
                <p className="text-[11px] font-semibold text-destructive">{localizeMessage(createError)}</p>
              )}
            </div>

            <SheetFooter className="border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateSheetOpen(false)} disabled={isCreating}>
                {tx('Cancel', '取消')}
              </Button>
              <Button
                type="submit"
                className="uppercase font-black tracking-widest text-[10px]"
                disabled={isCreating || !newAgentName.trim() || (newAgentKind === 'generic' && !newAgentToken.trim())}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : tx('Create Agent', '创建 agent')}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet
        open={isManageSheetOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsManageSheetOpen(false);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {selectedAgent ? (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="text-base">{tx('Manage', '管理')} {selectedAgent.username}</SheetTitle>
                <SheetDescription>
                  {tx('Edit token, test connection, and save current configuration.', '编辑密钥、测试连接并保存当前配置。')}
                </SheetDescription>
              </SheetHeader>

              <div className="p-4 space-y-4">
                <div className="rounded-md border bg-muted/20 p-3 text-[11px] text-muted-foreground">
                  {tx('Agent ID:', 'Agent ID：')} <span className="font-semibold text-foreground">#{selectedAgent.id}</span>
                </div>
                {selectedAgent.agent_kind === 'openhands_ops' && (
                  <div className="rounded-md border bg-primary/5 p-3 text-[11px] text-muted-foreground">
                    {tx('This agent is backend-managed. Token editing is disabled because Butler reaches it through the OpenHands runtime instead of a WebSocket token.', '这是一个后端托管 Agent。由于 Butler 通过 OpenHands 运行时而不是 WebSocket 密钥访问它，因此这里不提供 token 编辑。')}
                  </div>
                )}
                <div className="rounded-md border bg-muted/20 p-3">
                  {(() => {
                    const runtimeBadge = getRuntimeStatusBadge(selectedAgent);
                    return (
                      <div className="flex items-center gap-2">
                        <StatusIndicator variant={runtimeBadge.variant} pulse={runtimeBadge.pulse} />
                        <span className="text-xs font-semibold uppercase tracking-wider">{runtimeBadge.label}</span>
                      </div>
                    );
                  })()}
                </div>

                <div className="space-y-2">
                  <Input
                    type={tokenVisible[selectedAgent.id] ? 'text' : 'password'}
                    value={tokenDrafts[selectedAgent.id] ?? ''}
                    onChange={(e) =>
                      setTokenDrafts((prev) => ({
                        ...prev,
                        [selectedAgent.id]: e.target.value,
                      }))
                    }
                    placeholder={tx('Set agent token', '设置 agent 密钥')}
                    className="h-10 font-mono text-xs"
                    disabled={selectedAgent.agent_kind === 'openhands_ops'}
                  />

                  <div className="grid grid-cols-4 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() =>
                        setTokenVisible((prev) => ({
                          ...prev,
                          [selectedAgent.id]: !prev[selectedAgent.id],
                        }))
                      }
                      disabled={selectedAgent.agent_kind === 'openhands_ops'}
                    >
                      {tokenVisible[selectedAgent.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() =>
                        setTokenDrafts((prev) => ({
                          ...prev,
                          [selectedAgent.id]: generateAgentToken(),
                        }))
                      }
                      disabled={selectedAgent.agent_kind === 'openhands_ops'}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() => handleCopyAgentToken(selectedAgent.id)}
                      disabled={!((tokenDrafts[selectedAgent.id] || '').trim() || (selectedAgent.api_token || '').trim())}
                    >
                      {isAgentTokenCopied[selectedAgent.id] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() => handleTestAgentToken(selectedAgent.id)}
                      disabled={agentConnection[selectedAgent.id]?.state === 'testing' || selectedAgent.agent_kind === 'openhands_ops'}
                    >
                      {agentConnection[selectedAgent.id]?.state === 'testing' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlugZap className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {(() => {
                  const connection = agentConnection[selectedAgent.id] || {
                    state: 'idle' as ConnectionState,
                    message: 'Not tested yet.',
                  };
                  const badge = getStateBadge(connection.state);

                  return (
                    <div className="rounded-md border bg-muted/20 p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <StatusIndicator variant={badge.variant} pulse={connection.state === 'testing'} />
                        <span className="text-xs font-semibold">{badge.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">{localizeMessage(connection.message)}</p>
                    </div>
                  );
                })()}
              </div>

              <SheetFooter className="border-t">
                <Button type="button" variant="outline" onClick={() => setIsManageSheetOpen(false)}>
                  {tx('Close', '关闭')}
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSaveToken(selectedAgent.id)}
                  disabled={isSavingToken[selectedAgent.id] || selectedAgent.agent_kind === 'openhands_ops'}
                >
                  {isSavingToken[selectedAgent.id] ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  {tx('Save Token', '保存密钥')}
                </Button>
              </SheetFooter>
            </>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">{localizeMessage('No agent selected.')}</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default UserManagement;
