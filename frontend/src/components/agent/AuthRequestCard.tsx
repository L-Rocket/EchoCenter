import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuthRequestCardProps {
  actionId: string;
  targetAgentName: string;
  command: string;
  reason: string;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

const AuthRequestCard: React.FC<AuthRequestCardProps> = ({ 
  actionId, targetAgentName, command, reason, onApprove, onReject, status = 'PENDING' 
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const handleAction = (type: 'approve' | 'reject') => {
    setIsProcessing(true);
    setIsExpanded(false);
    if (type === 'approve') onApprove(actionId);
    else onReject(actionId);
    
    setTimeout(() => setIsProcessing(false), 5000);
  };

  const isPending = status === 'PENDING';

  return (
    <Card className={cn(
      "w-72 border shadow-lg overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500",
      isPending ? "border-amber-500/30 bg-card" : "border bg-card/50"
    )}>
      <div className={cn(
        "px-3 py-2 flex items-center justify-between border-b",
        isPending ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
      )}>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Directive Auth</span>
        </div>
        {!isPending && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-background/50">
            {status}
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md border border-border/60 bg-muted/25 px-2 py-2 text-left"
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {isPending ? 'Pending Directive' : 'Directive Summary'}
            </div>
            <div className="truncate text-[11px] font-medium">
              {command}
            </div>
          </div>
        </button>

        {isExpanded && (
          <>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold uppercase">
                <span>Target Agent</span>
                <span className="text-foreground">{targetAgentName}</span>
              </div>
              <div className="mt-1">
                <code className="text-[11px] bg-foreground text-amber-400 px-2 py-1.5 rounded block font-mono border shadow-inner truncate">
                  {command}
                </code>
              </div>
            </div>

            <div className="bg-muted/50 p-2 rounded border">
              <p className="text-[11px] text-muted-foreground leading-snug italic">
                "{reason}"
              </p>
            </div>
          </>
        )}

        <div className="flex gap-2">
          {isPending ? (
            <>
              <Button 
                size="sm" 
                disabled={isProcessing}
                className="h-8 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0 shadow-sm transition-all active:scale-95"
                onClick={() => handleAction('approve')}
              >
                {isProcessing ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1.5" />
                    <span className="text-[11px] font-bold">Approve</span>
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={isProcessing}
                className="h-8 flex-1 bg-background text-foreground border hover:bg-muted text-[11px] font-bold transition-all active:scale-95"
                onClick={() => handleAction('reject')}
              >
                <XCircle className="h-3 w-3 mr-1.5" />
                Reject
              </Button>
            </>
          ) : (
            <div className={cn(
              "w-full flex items-center justify-center gap-1.5 py-1.5 rounded border text-[10px] font-bold uppercase tracking-tight",
              status === 'APPROVED' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground border"
            )}>
              {status === 'APPROVED' ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Execution Authorized
                </>
              ) : (
                <>
                  <XCircle className="h-3 w-3" />
                  Execution Denied
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export default AuthRequestCard;
