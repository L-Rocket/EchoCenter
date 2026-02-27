import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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

  const handleAction = (type: 'approve' | 'reject') => {
    setIsProcessing(true);
    if (type === 'approve') onApprove(actionId);
    else onReject(actionId);
    
    // Safety timeout: if no state change happens from parent, reset loading
    // In a real app, the parent would update 'status' via WebSocket/API history
    setTimeout(() => setIsProcessing(false), 5000);
  };

  const isPending = status === 'PENDING';

  return (
    <Card className={cn(
      "w-72 border shadow-lg overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500",
      isPending ? "border-amber-200 bg-slate-50" : "border-slate-200 bg-slate-50/50"
    )}>
      {/* Mini Header */}
      <div className={cn(
        "px-3 py-2 flex items-center justify-between border-b",
        isPending ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
      )}>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Directive Auth</span>
        </div>
        {!isPending && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20">
            {status}
          </span>
        )}
      </div>

      <div className="p-3 space-y-3">
        {/* Target & Command Row */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
            <span>Target Agent</span>
            <span className="text-slate-900">{targetAgentName}</span>
          </div>
          <div className="mt-1">
            <code className="text-[11px] bg-slate-900 text-amber-400 px-2 py-1.5 rounded block font-mono border border-slate-800 shadow-inner truncate">
              {command}
            </code>
          </div>
        </div>

        {/* Reasoning */}
        <div className="bg-white/50 p-2 rounded border border-slate-100">
          <p className="text-[11px] text-slate-600 leading-snug italic">
            "{reason}"
          </p>
        </div>

        {/* Actions */}
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
                className="h-8 flex-1 bg-white text-slate-600 border-slate-200 hover:bg-slate-50 text-[11px] font-bold transition-all active:scale-95"
                onClick={() => handleAction('reject')}
              >
                <XCircle className="h-3 w-3 mr-1.5" />
                Reject
              </Button>
            </>
          ) : (
            <div className={cn(
              "w-full flex items-center justify-center gap-1.5 py-1.5 rounded border text-[10px] font-bold uppercase tracking-tight",
              status === 'APPROVED' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200"
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
