import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Shield, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthRequestPayload {
  action_id: string;
  target_agent_name?: string;
  target_agent_id?: number;
  command: string;
  reason?: string;
  status?: string;
}

interface AuthResponsePayload {
  action_id: string;
  approved: boolean;
  status?: string;
}

interface ProcessMessageProps {
  type: 'AUTH_REQUEST' | 'AUTH_RESPONSE' | 'SYSTEM' | 'CHAT' | 'SYSTEM_LOG' | 'CHAT_STREAM' | 'CHAT_STREAM_END';
  payload: string | Record<string, unknown>;
  timestamp: string;
  status?: string;
}

const ProcessMessage: React.FC<ProcessMessageProps> = ({ 
  type, 
  payload, 
  timestamp,
  status 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Parse payload if it's a string
  let parsedPayload: Record<string, unknown>;
  if (typeof payload === 'string') {
    try {
      parsedPayload = JSON.parse(payload) as Record<string, unknown>;
    } catch (_e) {
      parsedPayload = { content: payload };
    }
  } else {
    parsedPayload = payload;
  }

  const getIcon = () => {
    switch (type) {
      case 'AUTH_REQUEST':
        return <Shield className="h-3.5 w-3.5 text-amber-500" />;
      case 'AUTH_RESPONSE':
        return status === 'APPROVED' 
          ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
          : <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <Loader2 className="h-3.5 w-3.5 text-blue-500" />;
    }
  };

  const getLabel = () => {
    switch (type) {
      case 'AUTH_REQUEST':
        return '授权请求';
      case 'AUTH_RESPONSE':
        return status === 'APPROVED' ? '已批准' : '已拒绝';
      case 'SYSTEM':
        return '系统消息';
      default:
        return '过程信息';
    }
  };

  const getSummary = () => {
    if (type === 'AUTH_REQUEST' && parsedPayload.command) {
      return `执行指令: ${parsedPayload.command as string}`;
    }
    if (type === 'AUTH_RESPONSE') {
      return status === 'APPROVED' ? '执行已授权' : '执行被拒绝';
    }
    return typeof parsedPayload.content === 'string' 
      ? parsedPayload.content.substring(0, 50) 
      : JSON.stringify(parsedPayload).substring(0, 50);
  };

  // If it's a regular CHAT message, don't render as process message
  if (type === 'CHAT') {
    return null;
  }

  return (
    <div className="my-2">
      {/* Collapsed Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all",
          "bg-muted/50 hover:bg-muted border border-transparent hover:border-border",
          isExpanded && "bg-muted border-border"
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        
        <div className="flex items-center gap-1.5">
          {getIcon()}
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {getLabel()}
          </span>
        </div>

        <span className="text-[10px] text-muted-foreground truncate flex-1 ml-2">
          {getSummary()}
        </span>

        <span className="text-[9px] text-muted-foreground/60">
          {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-1 ml-5 pl-4 border-l-2 border-muted">
          <div className="bg-muted/30 rounded-lg p-3 text-xs">
            {type === 'AUTH_REQUEST' && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">目标 Agent:</span>
                  <span className="font-medium">{(parsedPayload as unknown as AuthRequestPayload).target_agent_name || `ID: ${(parsedPayload as unknown as AuthRequestPayload).target_agent_id}`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">指令:</span>
                  <span className="font-medium font-mono">{(parsedPayload as unknown as AuthRequestPayload).command}</span>
                </div>
                {(parsedPayload as unknown as AuthRequestPayload).reason && (
                  <div className="pt-2 border-t border-border/50">
                    <span className="text-muted-foreground block mb-1">原因:</span>
                    <span className="text-foreground/80">{(parsedPayload as unknown as AuthRequestPayload).reason}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t border-border/50">
                  <span className="text-muted-foreground">状态:</span>
                  <span className={cn(
                    "font-medium",
                    (parsedPayload as unknown as AuthRequestPayload).status === 'APPROVED' && "text-green-600",
                    (parsedPayload as unknown as AuthRequestPayload).status === 'REJECTED' && "text-red-600",
                    (parsedPayload as unknown as AuthRequestPayload).status === 'PENDING' && "text-amber-600"
                  )}>
                    {(parsedPayload as unknown as AuthRequestPayload).status || 'PENDING'}
                  </span>
                </div>
              </div>
            )}

            {type === 'AUTH_RESPONSE' && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">操作 ID:</span>
                  <span className="font-mono text-[10px]">{(parsedPayload as unknown as AuthResponsePayload).action_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">决定:</span>
                  <span className={cn(
                    "font-medium",
                    (parsedPayload as unknown as AuthResponsePayload).approved ? "text-green-600" : "text-red-600"
                  )}>
                    {(parsedPayload as unknown as AuthResponsePayload).approved ? '已批准' : '已拒绝'}
                  </span>
                </div>
              </div>
            )}

            {(type === 'SYSTEM' || !(parsedPayload as unknown as AuthRequestPayload).command) && (
              <pre className="whitespace-pre-wrap break-words text-foreground/80">
                {typeof parsedPayload.content === 'string' 
                  ? parsedPayload.content 
                  : JSON.stringify(parsedPayload, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessMessage;
