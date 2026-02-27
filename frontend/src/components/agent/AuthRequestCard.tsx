import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';

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
  return (
    <Card className="w-full max-w-sm border-indigo-100 bg-indigo-50/30 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
      <CardHeader className="p-4 bg-indigo-600 text-white flex flex-row items-center gap-3 space-y-0">
        <ShieldAlert className="h-5 w-5" />
        <CardTitle className="text-sm font-bold tracking-tight">Authorization Required</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Target Agent</label>
          <p className="text-sm font-semibold text-slate-900">{targetAgentName}</p>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proposed Command</label>
          <code className="text-xs bg-white px-2 py-1 rounded border border-slate-200 block text-indigo-600 font-mono">
            {command}
          </code>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Butler Reasoning</label>
          <p className="text-xs text-slate-600 leading-relaxed italic">"{reason}"</p>
        </div>
      </CardContent>
      <CardFooter className="p-3 bg-white border-t flex gap-2">
        {status === 'PENDING' ? (
          <>
            <Button 
              size="sm" 
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 h-9"
              onClick={() => onApprove(actionId)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
              Approve
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 text-slate-600 h-9"
              onClick={() => onReject(actionId)}
            >
              <XCircle className="h-3.5 w-3.5 mr-2" />
              Reject
            </Button>
          </>
        ) : (
          <div className={`w-full text-center py-1 rounded text-[10px] font-bold uppercase tracking-tighter ${
            status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {status === 'APPROVED' ? 'Action Authorized' : 'Action Denied'}
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default AuthRequestCard;
