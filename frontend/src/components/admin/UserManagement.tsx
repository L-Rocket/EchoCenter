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
  UserPlus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { getWsUrl } from '@/lib/config';
import { userService } from '@/services/userService';
import type { Agent } from '@/types';

type ConnectionState = 'idle' | 'testing' | 'success' | 'failed';

interface ConnectionResult {
  state: ConnectionState;
  message: string;
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

const UserManagement = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentToken, setNewAgentToken] = useState(generateAgentToken());
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

  const fetchAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await userService.getAgents();
      const cache = readTokenCache();
      const agentList = (Array.isArray(data) ? data : []).filter(
        (agent) => (agent.role || '').toUpperCase() === 'AGENT'
      );

      setAgents(agentList);
      setTokenDrafts((prev) => {
        const next: Record<number, string> = {};
        agentList.forEach((agent) => {
          next[agent.id] = prev[agent.id] ?? agent.api_token ?? cache[agent.id] ?? '';
        });
        return next;
      });
      setError('');
      return agentList;
    } catch (_err) {
      setError('Failed to load agent list from backend.');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

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
    const copied = await copyToClipboard((tokenDrafts[agentId] || '').trim());
    if (!copied) return;

    setIsAgentTokenCopied((prev) => ({ ...prev, [agentId]: true }));
    window.setTimeout(() => {
      setIsAgentTokenCopied((prev) => ({ ...prev, [agentId]: false }));
    }, 1200);
  }, [copyToClipboard, tokenDrafts]);

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
    if (!username || !token || isCreating) return;

    setIsCreating(true);
    setCreateError('');
    try {
      await userService.createAgent(username, token);
      const latestAgents = await fetchAgents();
      setNewAgentName('');
      setNewAgentToken(generateAgentToken());
      setCreateConnection(IDLE_CONNECTION_RESULT);

      setTokenDrafts((prev) => {
        const next = { ...prev };
        const created = latestAgents.find((agent) => agent.username === username);
        if (created?.id) {
          next[created.id] = token;
          const cache = readTokenCache();
          cache[created.id] = token;
          writeTokenCache(cache);
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
    if (state === 'success') return { variant: 'success' as const, label: 'Connected' };
    if (state === 'failed') return { variant: 'error' as const, label: 'Failed' };
    if (state === 'testing') return { variant: 'warning' as const, label: 'Testing' };
    return { variant: 'muted' as const, label: 'Idle' };
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
    setCreateError('');
    setCreateConnection(IDLE_CONNECTION_RESULT);
    setIsCreateTesting(false);
    setIsCreateTokenCopied(false);
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

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-black tracking-tighter italic">
            Agent <span className="text-primary">Token Console</span>
          </h2>
          <p className="text-sm text-muted-foreground font-medium">
            Search, create, and maintain agent tokens in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={openCreateSheet}
            className="h-9 gap-2 border-2 uppercase font-black tracking-widest text-[10px]"
          >
            <UserPlus className="h-3.5 w-3.5" />
            New Agent
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchAgents()}
            disabled={isLoading}
            className="h-9 gap-2 border-2 uppercase font-black tracking-widest text-[10px]"
          >
            <RefreshCw className={isLoading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="border-2 shadow-xl bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-4 gap-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-black uppercase tracking-[0.2em] flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Agent Tokens
            </CardTitle>
            <Badge variant="outline" className="h-6 text-[10px] uppercase tracking-wider">
              Total {filteredAgents.length}
            </Badge>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by agent name"
              className="h-9 pl-9 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive font-semibold">
              {error}
            </div>
          )}

          {filteredAgents.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-8 text-center text-xs text-muted-foreground">
              No agents matched your search.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="hidden md:grid md:grid-cols-[160px_minmax(260px,2fr)_200px_220px] gap-3 px-4 py-2.5 border-b bg-muted/20 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Agent Name</span>
                <span>Token</span>
                <span>Created At</span>
                <span className="text-right">Actions</span>
              </div>

              {paginatedAgents.map((agent) => {
                const tokenValue = (tokenDrafts[agent.id] ?? agent.api_token ?? '').trim();
                const connection = agentConnection[agent.id] || { state: 'idle', message: 'Not tested yet.' };
                const stateBadge = getStateBadge(connection.state);

                return (
                  <div
                    key={agent.id}
                    className="grid grid-cols-1 md:grid-cols-[160px_minmax(260px,2fr)_200px_220px] gap-3 px-4 py-3 border-b last:border-b-0 items-center"
                  >
                    <div className="text-sm truncate">{agent.username}</div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-mono truncate">{maskToken(tokenValue)}</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-[10px] shrink-0"
                          onClick={() => handleCopyAgentToken(agent.id)}
                          disabled={!tokenValue}
                        >
                          {isAgentTokenCopied[agent.id] ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                          {isAgentTokenCopied[agent.id] ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">ID #{agent.id}</p>
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {formatCreatedAt(agent.created_at)}
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden sm:flex items-center gap-1.5">
                        <StatusIndicator variant={stateBadge.variant} pulse={connection.state === 'testing'} />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          {stateBadge.label}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] uppercase tracking-wider"
                        onClick={() => openManageSheet(agent.id)}
                      >
                        Edit
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
                Page {currentPage} / {totalPages}
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
              Create Agent
            </SheetTitle>
            <SheetDescription>
              Generate token, test connection, and create an agent.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleCreateAgent} className="flex h-full flex-col">
            <div className="space-y-4 p-4">
              <Input
                placeholder="Agent name"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                className="h-10 bg-muted/50 border-2 focus:border-primary text-xs"
                disabled={isCreating}
              />

              <div className="space-y-2">
                <Input
                  placeholder="Agent token"
                  value={newAgentToken}
                  onChange={(e) => setNewAgentToken(e.target.value)}
                  className="h-10 bg-muted/50 border-2 focus:border-primary font-mono text-xs"
                  disabled={isCreating}
                />
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-[10px] uppercase tracking-wider"
                    onClick={() => setNewAgentToken(generateAgentToken())}
                    disabled={isCreating}
                  >
                    <KeyRound className="h-3.5 w-3.5 mr-1" />
                    Generate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-[10px] uppercase tracking-wider"
                    onClick={handleTestCreateToken}
                    disabled={isCreating || isCreateTesting || !newAgentToken.trim()}
                  >
                    {isCreateTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <PlugZap className="h-3.5 w-3.5 mr-1" />}
                    Test
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 text-[10px] uppercase tracking-wider"
                    onClick={handleCopyCreateToken}
                    disabled={!newAgentToken.trim()}
                  >
                    {isCreateTokenCopied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                    {isCreateTokenCopied ? 'Copied' : 'Copy'}
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
                <p className="text-[11px] text-muted-foreground">{createConnection.message}</p>
              </div>

              {createError && (
                <p className="text-[11px] font-semibold text-destructive">{createError}</p>
              )}
            </div>

            <SheetFooter className="border-t">
              <Button type="button" variant="outline" onClick={() => setIsCreateSheetOpen(false)} disabled={isCreating}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="uppercase font-black tracking-widest text-[10px]"
                disabled={isCreating || !newAgentName.trim() || !newAgentToken.trim()}
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Agent'}
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
                <SheetTitle className="text-base">Manage {selectedAgent.username}</SheetTitle>
                <SheetDescription>
                  Edit token, test connection, and save current configuration.
                </SheetDescription>
              </SheetHeader>

              <div className="p-4 space-y-4">
                <div className="rounded-md border bg-muted/20 p-3 text-[11px] text-muted-foreground">
                  Agent ID: <span className="font-semibold text-foreground">#{selectedAgent.id}</span>
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
                    placeholder="Set agent token"
                    className="h-10 font-mono text-xs"
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
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() => handleCopyAgentToken(selectedAgent.id)}
                      disabled={!(tokenDrafts[selectedAgent.id] || '').trim()}
                    >
                      {isAgentTokenCopied[selectedAgent.id] ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9"
                      onClick={() => handleTestAgentToken(selectedAgent.id)}
                      disabled={agentConnection[selectedAgent.id]?.state === 'testing'}
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
                      <p className="text-[11px] text-muted-foreground">{connection.message}</p>
                    </div>
                  );
                })()}
              </div>

              <SheetFooter className="border-t">
                <Button type="button" variant="outline" onClick={() => setIsManageSheetOpen(false)}>
                  Close
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSaveToken(selectedAgent.id)}
                  disabled={isSavingToken[selectedAgent.id]}
                >
                  {isSavingToken[selectedAgent.id] ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  Save Token
                </Button>
              </SheetFooter>
            </>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">No agent selected.</div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default UserManagement;
