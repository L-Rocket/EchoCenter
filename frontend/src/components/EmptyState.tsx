import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Ghost } from 'lucide-react';

const EmptyState: React.FC = () => {
  return (
    <Card className="border-dashed border-2 bg-muted/30">
      <CardContent className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-muted p-4 rounded-full mb-6 text-muted-foreground">
          <Ghost className="h-12 w-12" />
        </div>
        <h3 className="text-xl font-bold mb-2">Silent Transmission</h3>
        <p className="text-muted-foreground max-w-xs mx-auto">
          No agent activity detected. Systems are standing by for incoming status reports.
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          <div className="h-px w-8 bg-border" />
          Monitoring Active
          <div className="h-px w-8 bg-border" />
        </div>
      </CardContent>
    </Card>
  );
};

export default EmptyState;
