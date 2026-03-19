import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Braces,
  Bot,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Cpu,
  Copy,
  Eye,
  EyeOff,
  FileCode2,
  KeyRound,
  ListTodo,
  Loader2,
  PlugZap,
  RefreshCw,
  Save,
  Search,
  Server,
  ShieldEllipsis,
  Terminal,
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
import type { Agent, InfraNode, InfraNodeTestResult, OpenHandsStatus, OpenHandsTaskRecord, SSHKey } from '@/types';

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

interface TaskWorkflowStep {
  kind: 'code' | 'command' | 'stdout' | 'stderr' | 'result' | 'note';
  title: string;
  body: string;
}

type OperationsPanel = 'overview' | 'executors' | 'agents' | 'ssh' | 'nodes' | 'openhands' | 'tasks';

interface UserManagementProps {
  mode?: 'operations' | 'settings';
  forcedPanel?: OperationsPanel;
}

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

const normalizeTaskText = (text?: string) => (text || '').replace(/\r\n/g, '\n').trim();

const extractMarkdownSections = (source: string, pattern: RegExp): Array<{ title: string; body: string }> => {
  const matches = Array.from(source.matchAll(pattern));
  return matches
    .map((match) => ({
      title: String(match[1] || '').trim(),
      body: String(match[2] || '').trim(),
    }))
    .filter((section) => section.title && section.body);
};

const parseOpenHandsWorkflow = (task: OpenHandsTaskRecord): TaskWorkflowStep[] => {
  const source = normalizeTaskText(task.success ? task.summary : task.error);
  if (!source) return [];

  const steps: TaskWorkflowStep[] = [];
  const resultSections = extractMarkdownSections(source, /^##\s+(Code|Output|Final Result)\s*\n([\s\S]*?)(?=^##\s+|\Z)/gm);
  resultSections.forEach((section) => {
    const lowered = section.title.toLowerCase();
    steps.push({
      kind: lowered === 'code' ? 'code' : lowered === 'output' ? 'stdout' : 'result',
      title: section.title,
      body: section.body.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n```$/, '').trim(),
    });
  });

  const commandBlocks = extractMarkdownSections(source, /^##\s+(Command[^\n]*)\s*\n([\s\S]*?)(?=^##\s+|\Z)/gm);
  commandBlocks.forEach((section) => {
    const body = section.body.trim();
    const commandLine = body
      .replace(/^```[a-zA-Z]*\n?/, '')
      .replace(/\n```[\s\S]*$/, '')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    if (commandLine) {
      steps.push({ kind: 'command', title: section.title, body: commandLine });
    }

    const stdoutMatch = body.match(/###\s+stdout\s*\n```text\n([\s\S]*?)\n```/m);
    if (stdoutMatch?.[1]?.trim()) {
      steps.push({ kind: 'stdout', title: `${section.title} stdout`, body: stdoutMatch[1].trim() });
    }

    const stderrMatch = body.match(/###\s+stderr\s*\n```text\n([\s\S]*?)\n```/m);
    if (stderrMatch?.[1]?.trim()) {
      steps.push({ kind: 'stderr', title: `${section.title} stderr`, body: stderrMatch[1].trim() });
    }
  });

  if (steps.length === 0) {
    steps.push({
      kind: task.success ? 'note' : 'stderr',
      title: task.success ? 'Summary' : 'Failure',
      body: source,
    });
  }

  return steps;
};

const taskPreview = (task: OpenHandsTaskRecord) => {
  const steps = parseOpenHandsWorkflow(task);
  const preferred = steps.find((step) => step.kind === 'result')
    || steps.find((step) => step.kind === 'stdout')
    || steps.find((step) => step.kind === 'command')
    || steps[0];

  return preferred?.body
    ? preferred.body.split('\n').map((line) => line.trim()).find(Boolean) || ''
    : '';
};

const UserManagement = ({ mode = 'operations', forcedPanel }: UserManagementProps) => {
  const { tx, isZh } = useI18n();
  const isSettingsMode = mode === 'settings';
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
  const [editingSSHKeyID, setEditingSSHKeyID] = useState<number | null>(null);
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeHost, setNewNodeHost] = useState('');
  const [newNodePort, setNewNodePort] = useState('22');
  const [newNodeSSHUser, setNewNodeSSHUser] = useState('root');
  const [newNodeSSHKeyID, setNewNodeSSHKeyID] = useState('');
  const [newNodeDescription, setNewNodeDescription] = useState('');
  const [editingNodeID, setEditingNodeID] = useState<number | null>(null);
  const [opsError, setOpsError] = useState('');
  const [isCreatingSSHKey, setIsCreatingSSHKey] = useState(false);
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [isSSHFormOpen, setIsSSHFormOpen] = useState(false);
  const [isNodeFormOpen, setIsNodeFormOpen] = useState(false);
  const [deletingSSHKeyID, setDeletingSSHKeyID] = useState<number | null>(null);
  const [deletingNodeID, setDeletingNodeID] = useState<number | null>(null);
  const [testingNodeID, setTestingNodeID] = useState<number | null>(null);
  const [nodeTestResults, setNodeTestResults] = useState<Record<number, InfraNodeTestResult>>({});
  const [activePanel, setActivePanel] = useState<OperationsPanel>('overview');
  const [openhandsStatus, setOpenhandsStatus] = useState<OpenHandsStatus | null>(null);
  const [openhandsTasks, setOpenhandsTasks] = useState<OpenHandsTaskRecord[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
      const [keys, nodes, status, tasks] = await Promise.all([
        userService.listSSHKeys(),
        userService.listInfraNodes(),
        userService.getOpenHandsStatus(),
        userService.listOpenHandsTasks(),
      ]);
      setSSHKeys(Array.isArray(keys) ? keys : []);
      setInfraNodes(Array.isArray(nodes) ? nodes : []);
      setOpenhandsStatus(status ?? null);
      setOpenhandsTasks(Array.isArray(tasks) ? tasks : []);
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
      void fetchOpsResources();
    }, 10000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [fetchAgents, fetchOpsResources]);

  useEffect(() => {
    if (sshKeys.length === 0 && !editingSSHKeyID) {
      setIsSSHFormOpen(true);
    }
  }, [editingSSHKeyID, sshKeys.length]);

  useEffect(() => {
    if (infraNodes.length === 0 && !editingNodeID) {
      setIsNodeFormOpen(true);
    }
  }, [editingNodeID, infraNodes.length]);

  useEffect(() => {
    const allowedPanels: OperationsPanel[] = isSettingsMode
      ? ['agents', 'ssh', 'nodes']
      : ['overview', 'executors', 'openhands', 'tasks'];

    if (forcedPanel && activePanel !== forcedPanel) {
      setActivePanel(forcedPanel);
      return;
    }

    if (!allowedPanels.includes(activePanel)) {
      setActivePanel(allowedPanels[0]);
    }
  }, [activePanel, forcedPanel, isSettingsMode]);

  useEffect(() => {
    if (openhandsTasks.length === 0) {
      setSelectedTaskId(null);
      return;
    }
    if (!selectedTaskId || !openhandsTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(openhandsTasks[0].id);
    }
  }, [openhandsTasks, selectedTaskId]);

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
    if (!newSSHKeyName.trim() || isCreatingSSHKey || (!editingSSHKeyID && !newSSHPrivateKey.trim())) return;
    setIsCreatingSSHKey(true);
    try {
      if (editingSSHKeyID) {
        await userService.updateSSHKey(editingSSHKeyID, {
          name: newSSHKeyName.trim(),
          public_key: newSSHPublicKey.trim(),
          private_key: newSSHPrivateKey.trim() || undefined,
        });
      } else {
        await userService.createSSHKey({
          name: newSSHKeyName.trim(),
          public_key: newSSHPublicKey.trim(),
          private_key: newSSHPrivateKey,
        });
      }
      resetSSHKeyForm();
      setIsSSHFormOpen(false);
      await fetchOpsResources();
    } catch (_err) {
      setOpsError(editingSSHKeyID ? 'Failed to update SSH key.' : 'Failed to create SSH key.');
    } finally {
      setIsCreatingSSHKey(false);
    }
  };

  const handleDeleteSSHKey = async (id: number) => {
    setDeletingSSHKeyID(id);
    try {
      await userService.deleteSSHKey(id);
      if (editingSSHKeyID === id) {
        resetSSHKeyForm();
      }
      await fetchOpsResources();
    } catch (_err) {
      setOpsError('Failed to delete SSH key.');
    } finally {
      setDeletingSSHKeyID(null);
    }
  };

  const handleEditSSHKey = (key: SSHKey) => {
    setEditingSSHKeyID(key.id);
    setNewSSHKeyName(key.name);
    setNewSSHPublicKey(key.public_key || '');
    setNewSSHPrivateKey('');
    setIsSSHFormOpen(true);
    setActivePanel('ssh');
  };

  const resetSSHKeyForm = () => {
    setEditingSSHKeyID(null);
    setNewSSHKeyName('');
    setNewSSHPublicKey('');
    setNewSSHPrivateKey('');
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    const sshKeyID = Number(newNodeSSHKeyID);
    if (!newNodeName.trim() || !newNodeHost.trim() || !newNodeSSHUser.trim() || Number.isNaN(sshKeyID) || sshKeyID <= 0 || isCreatingNode) return;
    setIsCreatingNode(true);
    try {
      const payload = {
        name: newNodeName.trim(),
        host: newNodeHost.trim(),
        port: Math.max(1, Number(newNodePort) || 22),
        ssh_user: newNodeSSHUser.trim(),
        ssh_key_id: sshKeyID,
        description: newNodeDescription.trim(),
      };
      if (editingNodeID) {
        await userService.updateInfraNode(editingNodeID, payload);
      } else {
        await userService.createInfraNode(payload);
      }
      setNewNodeName('');
      setNewNodeHost('');
      setNewNodePort('22');
      setNewNodeSSHUser('root');
      setNewNodeSSHKeyID('');
      setNewNodeDescription('');
      setEditingNodeID(null);
      setIsNodeFormOpen(false);
      await fetchOpsResources();
    } catch (_err) {
      setOpsError(editingNodeID ? 'Failed to update infra node.' : 'Failed to create infra node.');
    } finally {
      setIsCreatingNode(false);
    }
  };

  const handleDeleteNode = async (id: number) => {
    setDeletingNodeID(id);
    try {
      await userService.deleteInfraNode(id);
      if (editingNodeID === id) {
        resetNodeForm();
      }
      setNodeTestResults((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await fetchOpsResources();
    } catch (_err) {
      setOpsError('Failed to delete infra node.');
    } finally {
      setDeletingNodeID(null);
    }
  };

  const handleEditNode = (node: InfraNode) => {
    setEditingNodeID(node.id);
    setNewNodeName(node.name);
    setNewNodeHost(node.host);
    setNewNodePort(String(node.port || 22));
    setNewNodeSSHUser(node.ssh_user || 'root');
    setNewNodeSSHKeyID(String(node.ssh_key_id));
    setNewNodeDescription(node.description || '');
    setIsNodeFormOpen(true);
    setActivePanel('nodes');
  };

  const resetNodeForm = () => {
    setEditingNodeID(null);
    setNewNodeName('');
    setNewNodeHost('');
    setNewNodePort('22');
    setNewNodeSSHUser('root');
    setNewNodeSSHKeyID('');
    setNewNodeDescription('');
  };

  const handleTestNode = async (id: number) => {
    setTestingNodeID(id);
    try {
      const result = await userService.testInfraNode(id);
      setNodeTestResults((prev) => ({
        ...prev,
        [id]: result,
      }));
      setOpsError('');
    } catch (_err) {
      setOpsError('Failed to test infra node.');
    } finally {
      setTestingNodeID(null);
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
      'Failed to update SSH key.': '更新 SSH 密钥失败。',
      'Failed to delete SSH key.': '删除 SSH 密钥失败。',
      'Failed to create infra node.': '创建基础设施节点失败。',
      'Failed to update infra node.': '更新基础设施节点失败。',
      'Failed to delete infra node.': '删除基础设施节点失败。',
      'Failed to test infra node.': '测试基础设施节点失败。',
    };
    return map[message] ?? message;
  };

  const managedOpenHandsAgent = useMemo(
    () => agents.find((agent) => agent.agent_kind === 'openhands_ops') ?? null,
    [agents]
  );

  const onlineAgents = useMemo(
    () => agents.filter((agent) => agent.online || String(agent.status || '').toUpperCase() === 'ONLINE').length,
    [agents]
  );

  const summaryCards = [
    {
      key: 'agents',
      label: tx('Agent Runtimes', 'Agent 运行时'),
      value: String(agents.length),
      sublabel: tx(`${onlineAgents} online`, `${onlineAgents} 个在线`),
    },
    {
      key: 'ssh',
      label: tx('SSH Assets', 'SSH 资产'),
      value: String(sshKeys.length),
      sublabel: tx('Encrypted at rest', '静态加密保存'),
    },
    {
      key: 'nodes',
      label: tx('Reachable Nodes', '可达节点'),
      value: String(infraNodes.length),
      sublabel: tx('Backed by SSH keys', '通过 SSH 密钥接入'),
    },
    {
      key: 'openhands',
      label: tx('OpenHands Runtime', 'OpenHands 运行时'),
      value: openhandsStatus?.enabled
        ? openhandsStatus.worker_reachable
          ? tx('Healthy', '健康')
          : tx('Booting', '启动中')
        : tx('Disabled', '已关闭'),
      sublabel: openhandsStatus?.worker_mode || tx('No runtime wired', '尚未接入运行时'),
    },
  ];

  const panelMeta: Array<{ key: OperationsPanel; label: string; zh: string; count?: number | string; desc: string; icon: 'overview' | 'executors' | 'agents' | 'ssh' | 'nodes' | 'openhands' | 'tasks' }> = [
    { key: 'overview', label: 'Overview', zh: '总览', count: 'live', desc: tx('Runtime pulse, recent activity, and delegation posture.', '运行态脉搏、近期活动与委派态势。'), icon: 'overview' },
    { key: 'executors', label: 'Executors', zh: '执行器', count: openhandsStatus?.enabled ? 3 : 2, desc: tx('Track the engines Butler can delegate into.', '查看 Butler 可委派进入的执行器。'), icon: 'executors' },
    { key: 'agents', label: 'Agents', zh: 'Agents', count: agents.length, desc: '', icon: 'agents' },
    { key: 'ssh', label: 'SSH Vault', zh: 'SSH 密钥库', count: sshKeys.length, desc: tx('Store and rotate encrypted SSH keys.', '保存并轮换加密 SSH 密钥。'), icon: 'ssh' },
    { key: 'nodes', label: 'Nodes', zh: '基础设施节点', count: infraNodes.length, desc: tx('Attach non-agent infrastructure targets.', '接入非 Agent 基础设施节点。'), icon: 'nodes' },
    { key: 'openhands', label: 'OpenHands', zh: 'OpenHands', count: openhandsStatus?.enabled ? 'on' : 'off', desc: tx('Inspect the managed OpenHands runtime.', '查看托管 OpenHands 运行时。'), icon: 'openhands' },
    { key: 'tasks', label: 'Tasks', zh: '任务', count: openhandsTasks.length, desc: tx('Browse recent delegated operations.', '查看近期委派任务。'), icon: 'tasks' },
  ];

  panelMeta[2].desc = tx('Manage registered agent runtimes.', '管理已注册的 agent 运行时。');

  const visiblePanels: OperationsPanel[] = isSettingsMode
    ? ['agents', 'ssh', 'nodes']
    : ['overview', 'executors', 'openhands', 'tasks'];
  const visiblePanelMeta = panelMeta.filter((panel) => visiblePanels.includes(panel.key));
  const activePanelMeta = visiblePanelMeta.find((panel) => panel.key === activePanel) ?? visiblePanelMeta[0];
  const recentTaskPreview = openhandsTasks.slice(0, 3);
  const hasHealthyExecutor = Boolean(openhandsStatus?.enabled && openhandsStatus?.worker_reachable);
  const selectedTask = useMemo(
    () => openhandsTasks.find((task) => task.id === selectedTaskId) ?? openhandsTasks[0] ?? null,
    [openhandsTasks, selectedTaskId]
  );
  const selectedTaskWorkflow = useMemo(
    () => (selectedTask ? parseOpenHandsWorkflow(selectedTask) : []),
    [selectedTask]
  );

  const renderPanelIcon = (icon: typeof panelMeta[number]['icon']) => {
    switch (icon) {
      case 'overview':
        return <RefreshCw className="h-4 w-4" />;
      case 'executors':
        return <Cpu className="h-4 w-4" />;
      case 'agents':
        return <Bot className="h-4 w-4" />;
      case 'ssh':
        return <ShieldEllipsis className="h-4 w-4" />;
      case 'nodes':
        return <Server className="h-4 w-4" />;
      case 'openhands':
        return <PlugZap className="h-4 w-4" />;
      case 'tasks':
        return <ListTodo className="h-4 w-4" />;
      default:
        return <RefreshCw className="h-4 w-4" />;
    }
  };

  return (
    <div className={`${isSettingsMode ? 'space-y-5' : 'space-y-6 animate-in fade-in duration-700'}`}>
      {!isSettingsMode && (
      <div className="rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-background to-muted/20 p-5 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.75)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <div className="text-[11px] font-black uppercase tracking-[0.32em] text-primary/80">
              {tx('Operations Fabric', '运维织网')}
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight lg:text-[2rem]">
                {tx('Operations Control Center', '运维控制中心')}
              </h2>
              <p className="max-w-3xl text-[13px] text-muted-foreground font-medium">
                {tx('Operate agents, SSH assets, infrastructure nodes, and OpenHands runtime from one place.', '在一个页面统一管理 agent、SSH 资产、基础设施节点与 OpenHands 运行时。')}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {summaryCards.map((card) => (
                <div key={card.key} className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">{card.label}</div>
                  <div className="mt-2 text-xl font-black tracking-tight lg:text-2xl">{card.value}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{card.sublabel}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 self-start">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void fetchAgents();
                void fetchOpsResources();
              }}
              disabled={isLoading}
              className="h-11 gap-2 rounded-2xl border-2 uppercase font-black tracking-[0.18em] text-[10px]"
            >
              <RefreshCw className={isLoading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
              {tx('Refresh', '刷新')}
            </Button>
          </div>
        </div>

      </div>
      )}

      {!isSettingsMode && (
      <div className="grid gap-6 xl:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="xl:sticky xl:top-24 h-fit">
          <div className="rounded-[28px] border border-border/70 bg-card/60 p-3 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.75)] backdrop-blur-sm">
            <div className="px-3 pb-3 pt-2">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">
                {tx('Runtime Views', '运行视图')}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {tx('Move between the control layers Butler relies on during delegated operations.', '在 Butler 委派运维时依赖的各层控制面之间切换。')}
              </div>
            </div>
            <div className="space-y-2">
              {visiblePanelMeta.map((panel) => (
                <button
                  key={panel.key}
                  type="button"
                  className={`w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                    activePanel === panel.key
                      ? 'border-primary bg-primary/10 shadow-[0_18px_50px_-35px_rgba(255,255,255,0.55)]'
                      : 'border-border/70 bg-background/50 hover:border-border'
                  }`}
                  onClick={() => setActivePanel(panel.key)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 rounded-xl border p-2 ${activePanel === panel.key ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border/70 text-muted-foreground'}`}>
                        {renderPanelIcon(panel.icon)}
                      </div>
                      <div>
                        <div className="text-[11px] font-black uppercase tracking-[0.24em]">{tx(panel.label, panel.zh)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{panel.desc}</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="h-6 rounded-full px-2.5 text-[10px] uppercase tracking-wider">
                      {panel.count}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-border/70 bg-background/60 px-4 py-3">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">{tx('Executor Pulse', '执行器脉搏')}</div>
              <div className="mt-2 flex items-center gap-2">
                <StatusIndicator variant={hasHealthyExecutor ? 'success' : 'warning'} pulse={hasHealthyExecutor} />
                <div className="text-sm font-semibold">
                  {hasHealthyExecutor ? tx('OpenHands reachable', 'OpenHands 可连接') : tx('Executor attention needed', '执行器需要关注')}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {openhandsStatus?.service_url || tx('Local runner fallback active.', '本地 runner 回退路径已启用。')}
              </div>
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-border/70 bg-card/40 p-5 backdrop-blur-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.28em] text-primary/80">{tx('Current View', '当前视图')}</div>
                <h3 className="mt-2 text-xl font-black tracking-tight lg:text-2xl">{tx(activePanelMeta.label, activePanelMeta.zh)}</h3>
                <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">{activePanelMeta.desc}</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <StatusIndicator variant={hasHealthyExecutor ? 'success' : 'warning'} pulse={hasHealthyExecutor} />
                <span>{tx('Butler delegation plane is live.', 'Butler 委派平面已联通。')}</span>
              </div>
            </div>
          </div>

          {activePanel === 'overview' && (
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-4 gap-2">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    {tx('Runtime Pulse', '运行态脉搏')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {tx('A live overview of runtimes, delegation readiness, and infrastructure reach.', '运行时、委派准备度与基础设施可达性的实时总览。')}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-3 md:grid-cols-2">
                  {summaryCards.map((card) => (
                      <div key={card.key} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">{card.label}</div>
                      <div className="mt-3 text-2xl font-black tracking-tight">{card.value}</div>
                      <div className="mt-1 text-[11px] text-muted-foreground">{card.sublabel}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-4 gap-2">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    {tx('Executor Snapshot', '执行器快照')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {tx('What powers runtime operations right now.', '当前支撑运行态运维的执行器概览。')}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{tx('OpenHands Worker', 'OpenHands 执行器')}</div>
                        <div className="text-[11px] text-muted-foreground">{openhandsStatus?.worker_mode || tx('Runtime unknown', '运行时未知')}</div>
                      </div>
                      <Badge variant="outline">{openhandsStatus?.enabled ? tx('Enabled', '启用') : tx('Disabled', '关闭')}</Badge>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-semibold">{tx('SSH Transport', 'SSH 传输层')}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{tx('Backs non-agent nodes and task delegation targets.', '承载非 Agent 节点以及委派任务目标。')}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-semibold">{tx('Approval Gate', '审批闸门')}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{tx('Butler-approved actions are routed into the runtime executor plane.', 'Butler 批准后的动作会被路由到运行时执行平面。')}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm xl:col-span-2">
                <CardHeader className="pb-4 gap-2">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-primary" />
                    {tx('Recent Delegations', '近期委派')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {tx('A condensed trail of the most recent operations Butler pushed into the runtime plane.', 'Butler 最近推入运行时平面的操作摘要。')}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentTaskPreview.length === 0 ? (
                    <div className="rounded-md border bg-muted/20 p-4 text-xs text-muted-foreground">
                      {tx('No delegated operations yet.', '暂时还没有委派运维操作。')}
                    </div>
                  ) : (
                    recentTaskPreview.map((task) => (
                      <div key={task.id} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{task.task}</div>
                            <div className="mt-1 text-[11px] text-muted-foreground">{formatCreatedAt(task.finished_at)}</div>
                          </div>
                          <Badge variant="outline">{task.success ? tx('Success', '成功') : tx('Failed', '失败')}</Badge>
                        </div>
                        {(task.summary || task.error) && (
                          <div className="mt-3 text-xs text-muted-foreground">{task.success ? task.summary : task.error}</div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activePanel === 'executors' && (
            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm xl:col-span-2">
                <CardHeader className="pb-4 gap-2">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    {tx('Executor Fleet', '执行器舰队')}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {tx('A structured view of the execution surfaces available to Butler.', 'Butler 当前可用执行面的结构化视图。')}
                  </p>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold">{tx('OpenHands Primary', 'OpenHands 主执行器')}</div>
                      <Badge variant="outline">{openhandsStatus?.worker_mode || '--'}</Badge>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <StatusIndicator variant={hasHealthyExecutor ? 'success' : 'warning'} pulse={hasHealthyExecutor} />
                      <span className="text-sm">{hasHealthyExecutor ? tx('Reachable', '可连接') : tx('Attention required', '需要关注')}</span>
                    </div>
                    <div className="mt-3 text-[11px] text-muted-foreground">{openhandsStatus?.service_url || tx('Using local runner fallback for execution.', '当前使用本地 runner 回退执行。')}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-semibold">{tx('SSH Transport Layer', 'SSH 传输层')}</div>
                    <div className="mt-3 text-2xl font-black tracking-tight">{infraNodes.length}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{tx('connected infrastructure targets', '个已接入基础设施目标')}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-semibold">{tx('Credential Vault', '凭据保险库')}</div>
                    <div className="mt-3 text-2xl font-black tracking-tight">{sshKeys.length}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{tx('encrypted SSH materials available to runtime', '份可供运行时使用的加密 SSH 凭据')}</div>
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                    <div className="text-sm font-semibold">{tx('Delegation Trail', '委派轨迹')}</div>
                    <div className="mt-3 text-2xl font-black tracking-tight">{openhandsTasks.length}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{tx('recent operations recorded in memory', '条近期内存态任务记录')}</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-4 gap-2">
                  <CardTitle className="text-sm font-black uppercase tracking-[0.2em]">
                    {tx('Routing Notes', '路由说明')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                    {tx('Butler remains the decision maker and only delegates concrete operations into executors.', 'Butler 仍是决策者，只把具体运维动作委派给执行器。')}
                  </div>
                  <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                    {tx('OpenHands handles execution, SSH handles non-agent nodes, and approvals remain in the business loop.', 'OpenHands 负责执行，SSH 负责非 Agent 节点接入，审批仍留在业务回路中。')}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

      {isSettingsMode && activePanel === 'agents' && (
      <div className="flex items-center justify-end">
        <Button
          size="sm"
          onClick={openCreateSheet}
          className="h-10 gap-2 rounded-2xl border-2 uppercase font-black tracking-[0.14em] text-[10px]"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {tx('New Agent', '新建 agent')}
        </Button>
      </div>
      )}

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
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <ShieldEllipsis className="h-4 w-4 text-primary" />
                {tx('SSH Key Vault', 'SSH 密钥库')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {tx('Private keys are encrypted in the backend and only decrypted for OpenHands runtime execution.', '私钥会在后端加密保存，仅在 OpenHands 运行时短暂解密使用。')}
              </p>
            </div>
            <Button
              type="button"
              variant={isSSHFormOpen ? 'outline' : 'default'}
              className="h-9 rounded-xl text-[10px] uppercase tracking-[0.18em]"
              onClick={() => {
                if (editingSSHKeyID) {
                  resetSSHKeyForm();
                }
                setIsSSHFormOpen((prev) => !prev);
              }}
            >
              <ChevronDown className={`mr-1 h-3.5 w-3.5 transition-transform ${isSSHFormOpen ? 'rotate-180' : ''}`} />
              {isSSHFormOpen
                ? tx('Collapse Editor', '收起编辑器')
                : editingSSHKeyID
                  ? tx('Resume Edit', '继续编辑')
                  : tx('Add SSH Key', '添加 SSH 密钥')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isSSHFormOpen && (
            <div className="rounded-2xl border border-border/70 bg-background/65 p-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">
                    {editingSSHKeyID ? tx('Edit Asset', '编辑资产') : tx('New Secret Material', '新增凭据')}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {editingSSHKeyID
                      ? tx('Update metadata or rotate the private key material.', '更新密钥元数据，或轮换这份私钥材料。')
                      : tx('Add a new SSH identity for OpenHands and other managed executors.', '为 OpenHands 和其他托管执行器录入新的 SSH 身份。')}
                  </div>
                </div>
                {editingSSHKeyID && (
                  <Badge variant="outline" className="h-6 text-[10px] uppercase tracking-wider">
                    {tx('Editing', '编辑中')}
                  </Badge>
                )}
              </div>
              <form onSubmit={handleCreateSSHKey} className="space-y-3">
                <Input value={newSSHKeyName} onChange={(e) => setNewSSHKeyName(e.target.value)} placeholder={tx('SSH key name', 'SSH 密钥名称')} className="h-9 text-xs" />
                <Input value={newSSHPublicKey} onChange={(e) => setNewSSHPublicKey(e.target.value)} placeholder={tx('Public key (optional)', '公钥（可选）')} className="h-9 text-xs font-mono" />
                <textarea value={newSSHPrivateKey} onChange={(e) => setNewSSHPrivateKey(e.target.value)} placeholder={editingSSHKeyID ? tx('Replace private key (optional)', '替换私钥（可选）') : tx('Private key', '私钥')} className="min-h-[120px] w-full rounded-md border bg-background px-3 py-2 text-xs font-mono" />
                <div className="flex items-center gap-2">
                  <Button type="submit" className="h-9 text-[10px] uppercase tracking-widest" disabled={isCreatingSSHKey || !newSSHKeyName.trim() || (!editingSSHKeyID && !newSSHPrivateKey.trim())}>
                    {isCreatingSSHKey ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <KeyRound className="mr-1 h-4 w-4" />}
                    {editingSSHKeyID ? tx('Update SSH Key', '更新 SSH 密钥') : tx('Add SSH Key', '添加 SSH 密钥')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-[10px] uppercase tracking-widest"
                    onClick={() => {
                      resetSSHKeyForm();
                      setIsSSHFormOpen(false);
                    }}
                  >
                    {editingSSHKeyID ? tx('Cancel Edit', '取消编辑') : tx('Collapse', '收起')}
                  </Button>
                </div>
              </form>
            </div>
          )}
          <div className="space-y-2">
            {sshKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between rounded-md border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{key.name}</div>
                  <div className="text-[11px] text-muted-foreground">{key.public_key ? maskToken(key.public_key) : tx('Private key stored securely', '私钥已安全存储')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => handleEditSSHKey(key)}>
                    {tx('Edit', '编辑')}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => handleDeleteSSHKey(key.id)} disabled={deletingSSHKeyID === key.id}>
                    {deletingSSHKeyID === key.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </div>
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
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                {tx('Infrastructure Nodes', '基础设施节点')}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {tx('These SSH nodes are made available to the backend-managed OpenHands Ops Agent.', '这些 SSH 节点会提供给后端托管的 OpenHands 运维 Agent。')}
              </p>
            </div>
            <Button
              type="button"
              variant={isNodeFormOpen ? 'outline' : 'default'}
              className="h-9 rounded-xl text-[10px] uppercase tracking-[0.18em]"
              onClick={() => {
                if (editingNodeID) {
                  resetNodeForm();
                }
                setIsNodeFormOpen((prev) => !prev);
              }}
            >
              <ChevronDown className={`mr-1 h-3.5 w-3.5 transition-transform ${isNodeFormOpen ? 'rotate-180' : ''}`} />
              {isNodeFormOpen
                ? tx('Collapse Editor', '收起编辑器')
                : editingNodeID
                  ? tx('Resume Edit', '继续编辑')
                  : tx('Add Node', '添加节点')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isNodeFormOpen && (
            <div className="rounded-2xl border border-border/70 bg-background/65 p-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">
                    {editingNodeID ? tx('Edit Node Profile', '编辑节点档案') : tx('Attach Node', '接入节点')}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {editingNodeID
                      ? tx('Adjust host, identity, or SSH binding before the next delegation run.', '在下一次委派执行前调整主机、身份或 SSH 绑定。')
                      : tx('Register a non-agent machine so OpenHands can reach it through SSH.', '登记一台非 Agent 机器，让 OpenHands 通过 SSH 访问它。')}
                  </div>
                </div>
                {editingNodeID && (
                  <Badge variant="outline" className="h-6 text-[10px] uppercase tracking-wider">
                    {tx('Editing', '编辑中')}
                  </Badge>
                )}
              </div>
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
                  <div className="flex items-center gap-2">
                    <Button type="submit" className="h-9 text-[10px] uppercase tracking-widest" disabled={isCreatingNode || !newNodeName.trim() || !newNodeHost.trim() || !newNodeSSHUser.trim() || !newNodeSSHKeyID}>
                      {isCreatingNode ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Server className="mr-1 h-4 w-4" />}
                      {editingNodeID ? tx('Update Node', '更新节点') : tx('Add Node', '添加节点')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 text-[10px] uppercase tracking-widest"
                      onClick={() => {
                        resetNodeForm();
                        setIsNodeFormOpen(false);
                      }}
                    >
                      {editingNodeID ? tx('Cancel Edit', '取消编辑') : tx('Collapse', '收起')}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          )}
          <div className="space-y-2">
            {infraNodes.map((node) => {
              const keyName = sshKeys.find((key) => key.id === node.ssh_key_id)?.name || `#${node.ssh_key_id}`;
              const nodeTest = nodeTestResults[node.id];
              return (
                <div key={node.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{node.name}</div>
                    <div className="text-[11px] text-muted-foreground">{node.ssh_user}@{node.host}:{node.port} · {keyName}</div>
                    {node.description && <div className="text-[11px] text-muted-foreground">{node.description}</div>}
                    {nodeTest && (
                      <div className={`mt-2 text-[11px] ${nodeTest.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {nodeTest.ok ? tx('SSH reachable', 'SSH 可连接') : tx('SSH not reachable', 'SSH 不可连接')}
                        {nodeTest.round_trip_ms > 0 ? ` · ${nodeTest.round_trip_ms}ms` : ''}
                        <span className="ml-1 text-muted-foreground">{nodeTest.message}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[10px]"
                      onClick={() => handleEditNode(node)}
                    >
                      {tx('Edit', '编辑')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[10px]"
                      onClick={() => handleTestNode(node.id)}
                      disabled={testingNodeID === node.id}
                    >
                      {testingNodeID === node.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <PlugZap className="h-3.5 w-3.5 mr-1" />}
                      {tx('Test', '测试')}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => handleDeleteNode(node.id)} disabled={deletingNodeID === node.id}>
                      {deletingNodeID === node.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
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

        <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm xl:col-span-2">
          <CardHeader className="pb-4 gap-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              {tx('Workflow Playback', '工作流回放')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {tx('Inspect the latest delegated run as a sequence of code, commands, and outputs.', '按代码、命令和输出的顺序查看最近一次委派执行。')}
            </p>
          </CardHeader>
          <CardContent>
            {!selectedTask ? (
              <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground">
                {tx('Dispatch a task from Butler to see the OpenHands workflow appear here.', '先让 Butler 下发一次任务，OpenHands 的执行流程就会出现在这里。')}
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
                <div className="space-y-3">
                  {openhandsTasks.slice(0, 6).map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className={`w-full rounded-2xl border px-4 py-3 text-left transition-all ${
                        selectedTask?.id === task.id
                          ? 'border-primary bg-primary/10 shadow-[0_18px_50px_-38px_rgba(255,255,255,0.55)]'
                          : 'border-border/70 bg-background/60 hover:border-border'
                      }`}
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-sm font-semibold">{task.task}</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {taskPreview(task) || tx('No condensed summary yet.', '暂时还没有提炼后的摘要。')}
                          </div>
                        </div>
                        <Badge variant="outline" className="h-6 shrink-0 text-[10px] uppercase tracking-wider">
                          {task.success ? tx('Success', '成功') : tx('Failed', '失败')}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>{task.worker_mode || '--'}</span>
                        <span>{formatCreatedAt(task.finished_at)}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <div className="rounded-[24px] border border-border/70 bg-background/55 p-4 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.8)]">
                  <div className="flex flex-col gap-3 border-b border-border/60 pb-4 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">
                        {tx('Execution Trace', '执行轨迹')}
                      </div>
                      <div className="text-base font-black leading-tight">{selectedTask.task}</div>
                      {selectedTask.reasoning && (
                        <div className="text-xs text-muted-foreground">{selectedTask.reasoning}</div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <Badge variant="outline">{selectedTask.worker_mode || '--'}</Badge>
                      <Badge variant="outline">{selectedTask.duration_ms}ms</Badge>
                      <Badge variant="outline">{selectedTask.success ? tx('Success', '成功') : tx('Failed', '失败')}</Badge>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    {selectedTaskWorkflow.map((step, index) => (
                      <div key={`${selectedTask.id}-${step.title}-${index}`} className="grid gap-3 md:grid-cols-[28px_minmax(0,1fr)]">
                        <div className="flex flex-col items-center">
                          <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                            step.kind === 'stderr'
                              ? 'border-amber-300 bg-amber-500/10 text-amber-600'
                              : step.kind === 'command'
                                ? 'border-sky-300 bg-sky-500/10 text-sky-600'
                                : step.kind === 'code'
                                  ? 'border-violet-300 bg-violet-500/10 text-violet-600'
                                  : step.kind === 'result'
                                    ? 'border-emerald-300 bg-emerald-500/10 text-emerald-600'
                                    : 'border-border bg-muted/40 text-muted-foreground'
                          }`}>
                            {step.kind === 'command' && <Terminal className="h-3.5 w-3.5" />}
                            {step.kind === 'code' && <FileCode2 className="h-3.5 w-3.5" />}
                            {step.kind === 'stdout' && <Braces className="h-3.5 w-3.5" />}
                            {step.kind === 'stderr' && <PlugZap className="h-3.5 w-3.5" />}
                            {step.kind === 'result' && <Check className="h-3.5 w-3.5" />}
                            {step.kind === 'note' && <ListTodo className="h-3.5 w-3.5" />}
                          </div>
                          {index < selectedTaskWorkflow.length - 1 && (
                            <div className="mt-2 h-full min-h-8 w-px bg-border/80" />
                          )}
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{step.title}</div>
                          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-muted/25 p-3 text-xs text-foreground/90">
                            {step.body}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {activePanel === 'tasks' && (
      <div className="grid gap-6 xl:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4 gap-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <ListTodo className="h-4 w-4 text-primary" />
              {tx('Task History', '任务历史')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {tx('Browse the latest operations Butler delegated through the managed runtime.', '查看 Butler 最近通过托管运行时委派出去的运维任务。')}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {openhandsTasks.length === 0 ? (
              <div className="rounded-md border bg-muted/20 p-4 text-xs text-muted-foreground">
                {tx('No OpenHands task has been executed yet.', '暂时还没有执行过 OpenHands 任务。')}
              </div>
            ) : (
              openhandsTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selectedTask?.id === task.id
                      ? 'border-primary bg-primary/10 shadow-[0_18px_50px_-35px_rgba(255,255,255,0.55)]'
                      : 'border-border/70 bg-background/70 hover:border-border'
                  }`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold break-words">{task.task}</div>
                      {task.reasoning && (
                        <div className="mt-1 text-[11px] text-muted-foreground break-words">{task.reasoning}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIndicator variant={task.success ? 'success' : 'warning'} pulse={false} />
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {task.success ? tx('Success', '成功') : tx('Failed', '失败')}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3 text-[11px] text-muted-foreground">
                    <div>
                      <div className="uppercase tracking-wider">{tx('Duration', '耗时')}</div>
                      <div className="mt-1 text-foreground">{task.duration_ms}ms</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider">{tx('Mode', '模式')}</div>
                      <div className="mt-1 text-foreground">{task.worker_mode || tx('Unknown', '未知')}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider">{tx('Finished', '完成时间')}</div>
                      <div className="mt-1 text-foreground">{formatCreatedAt(task.finished_at)}</div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    {taskPreview(task) || tx('Open the task to inspect the execution trace.', '点开任务查看完整执行轨迹。')}
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4 gap-2">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              {tx('OpenHands Execution Flow', 'OpenHands 执行流程')}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {tx('See how Butler delegated the task and what OpenHands actually ran.', '查看 Butler 如何委派任务，以及 OpenHands 实际执行了什么。')}
            </p>
          </CardHeader>
          <CardContent>
            {!selectedTask ? (
              <div className="rounded-md border bg-muted/20 p-4 text-xs text-muted-foreground">
                {tx('Choose a task on the left to inspect the execution flow.', '从左侧选择一个任务查看执行过程。')}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">
                    {tx('Delegated Objective', '委派目标')}
                  </div>
                  <div className="mt-2 text-base font-black leading-tight">{selectedTask.task}</div>
                  {selectedTask.reasoning && (
                    <div className="mt-2 text-xs text-muted-foreground">{selectedTask.reasoning}</div>
                  )}
                </div>

                <div className="space-y-4">
                  {selectedTaskWorkflow.map((step, index) => (
                    <div key={`${selectedTask.id}-${step.title}-${index}`} className="grid gap-3 md:grid-cols-[28px_minmax(0,1fr)]">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                          step.kind === 'stderr'
                            ? 'border-amber-300 bg-amber-500/10 text-amber-600'
                            : step.kind === 'command'
                              ? 'border-sky-300 bg-sky-500/10 text-sky-600'
                              : step.kind === 'code'
                                ? 'border-violet-300 bg-violet-500/10 text-violet-600'
                                : step.kind === 'result'
                                  ? 'border-emerald-300 bg-emerald-500/10 text-emerald-600'
                                  : 'border-border bg-muted/40 text-muted-foreground'
                        }`}>
                          {step.kind === 'command' && <Terminal className="h-3.5 w-3.5" />}
                          {step.kind === 'code' && <FileCode2 className="h-3.5 w-3.5" />}
                          {step.kind === 'stdout' && <Braces className="h-3.5 w-3.5" />}
                          {step.kind === 'stderr' && <PlugZap className="h-3.5 w-3.5" />}
                          {step.kind === 'result' && <Check className="h-3.5 w-3.5" />}
                          {step.kind === 'note' && <ListTodo className="h-3.5 w-3.5" />}
                        </div>
                        {index < selectedTaskWorkflow.length - 1 && <div className="mt-2 h-full min-h-8 w-px bg-border/80" />}
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{step.title}</div>
                        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl bg-muted/25 p-3 text-xs text-foreground/90">
                          {step.body}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

        </section>
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
