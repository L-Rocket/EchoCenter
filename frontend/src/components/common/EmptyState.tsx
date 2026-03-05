import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useI18n } from '@/hooks/useI18n';
import { Ghost } from 'lucide-react';

const EmptyState: React.FC = () => {
  const { tx } = useI18n();

  return (
    <Card className="border-dashed border-2 bg-muted/30">
      <CardContent className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-muted p-4 rounded-full mb-6 text-muted-foreground">
          <Ghost className="h-12 w-12" />
        </div>
        <h3 className="text-xl font-bold mb-2">{tx('Silent Transmission', '静默传输')}</h3>
        <p className="text-muted-foreground max-w-xs mx-auto">
          {tx(
            'No agent activity detected. Systems are standing by for incoming status reports.',
            '未检测到代理活动，系统正在等待新的状态上报。'
          )}
        </p>
        <div className="mt-8 flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          <div className="h-px w-8 bg-border" />
          {tx('Monitoring Active', '监控运行中')}
          <div className="h-px w-8 bg-border" />
        </div>
      </CardContent>
    </Card>
  );
};

export default EmptyState;
