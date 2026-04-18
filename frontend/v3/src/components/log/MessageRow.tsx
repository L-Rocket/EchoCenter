import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { Info, AlertTriangle, AlertCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LogMessage } from '@/types';

interface MessageRowProps {
  message: LogMessage;
}

const MessageRow: React.FC<MessageRowProps> = ({ message }) => {
  const getLevelConfig = (level: string) => {
    switch (level.toUpperCase()) {
      case 'ERROR':
        return {
          variant: 'error' as const,
          badgeVariant: 'destructive' as const,
          icon: <AlertCircle className="h-4 w-4" />,
          bgColor: 'bg-destructive/5',
          borderColor: 'border-destructive/20',
          badgeClass: '',
        };
      case 'WARNING':
        return {
          variant: 'warning' as const,
          badgeVariant: 'outline' as const,
          icon: <AlertTriangle className="h-4 w-4" />,
          bgColor: 'bg-amber-500/5 dark:bg-amber-500/10',
          borderColor: 'border-amber-500/20',
          badgeClass: 'border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10',
        };
      case 'INFO':
      default:
        return {
          variant: 'info' as const,
          badgeVariant: 'secondary' as const,
          icon: <Info className="h-4 w-4" />,
          bgColor: 'bg-primary/5',
          borderColor: 'border-primary/20',
          badgeClass: '',
        };
    }
  };

  const config = getLevelConfig(message.level);
  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Card className={cn("mb-3 overflow-hidden border transition-all hover:shadow-md", config.borderColor, config.bgColor)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="mt-1">
            <StatusIndicator variant={config.variant} pulse={message.level.toUpperCase() === 'ERROR'} />
          </div>
          
          <div className="flex-grow min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold truncate tracking-tight">{message.agent_id}</span>
                <Badge 
                  variant={config.badgeVariant} 
                  className={cn("text-[10px] px-1.5 py-0 uppercase font-bold", config.badgeClass)}
                >
                  <span className="flex items-center gap-1">
                    {config.icon}
                    {message.level}
                  </span>
                </Badge>
              </div>
              
              <div className="flex items-center gap-1.5 text-muted-foreground whitespace-nowrap">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{formattedTime}</span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed break-words">
              {message.content}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MessageRow;
