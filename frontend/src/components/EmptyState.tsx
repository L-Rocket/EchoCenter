import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Ghost } from 'lucide-react';

const EmptyState: React.FC = () => {
  return (
    <Card className="border-dashed border-2 bg-slate-50/50">
      <CardContent className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-slate-100 p-4 rounded-full mb-6 text-slate-400">
          <Ghost className="h-12 w-12" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Silent Transmission</h3>
        <p className="text-slate-500 max-w-xs mx-auto">
          No agent activity detected. Systems are standing by for incoming status reports.
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">
          <div className="h-px w-8 bg-slate-200" />
          Monitoring Active
          <div className="h-px w-8 bg-slate-200" />
        </div>
      </CardContent>
    </Card>
  );
};

export default EmptyState;
