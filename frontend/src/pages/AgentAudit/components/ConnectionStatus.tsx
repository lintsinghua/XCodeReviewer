/**
 * Connection Status Indicator
 * Shows real-time connection state with reconnection progress
 */

import { Wifi, WifiOff, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import type { ConnectionState } from '../hooks';

interface ConnectionStatusProps {
  state: ConnectionState;
  reconnectAttempts?: number;
  maxReconnectAttempts?: number;
  className?: string;
}

const STATUS_CONFIG: Record<ConnectionState, {
  icon: typeof Wifi;
  label: string;
  color: string;
  bgColor: string;
  animate?: boolean;
}> = {
  disconnected: {
    icon: WifiOff,
    label: 'Disconnected',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted/30',
  },
  connecting: {
    icon: RefreshCw,
    label: 'Connecting',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    animate: true,
  },
  connected: {
    icon: Wifi,
    label: 'Live',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  reconnecting: {
    icon: RefreshCw,
    label: 'Reconnecting',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    animate: true,
  },
  failed: {
    icon: AlertCircle,
    label: 'Connection Failed',
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
  },
};

export function ConnectionStatus({
  state,
  reconnectAttempts = 0,
  maxReconnectAttempts = 5,
  className,
}: ConnectionStatusProps) {
  const config = STATUS_CONFIG[state];
  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className={cn(
        'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        config.bgColor,
        config.color
      )}>
        <Icon className={cn(
          'w-3 h-3',
          config.animate && 'animate-spin'
        )} />
        <span>{config.label}</span>
        {state === 'reconnecting' && reconnectAttempts > 0 && (
          <span className="opacity-70">
            ({reconnectAttempts}/{maxReconnectAttempts})
          </span>
        )}
      </div>

      {state === 'connected' && (
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
      )}
    </div>
  );
}

export default ConnectionStatus;
