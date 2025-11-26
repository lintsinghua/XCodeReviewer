/**
 * 数据库状态指示器
 * 显示当前使用的数据库模式
 */

import { Database, Cloud, Eye, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { dbMode } from '@/shared/config/database';

export function DatabaseStatus() {
  const getStatusConfig = () => {
    switch (dbMode) {
      case 'api':
        return {
          icon: Server,
          label: '后端数据库',
          variant: 'default' as const,
          description: '数据存储在后端 PostgreSQL 数据库'
        };
      case 'local':
        return {
          icon: Database,
          label: '本地数据库',
          variant: 'default' as const,
          description: '数据存储在浏览器本地'
        };
      case 'supabase':
        return {
          icon: Cloud,
          label: 'Supabase 云端',
          variant: 'secondary' as const,
          description: '数据存储在云端（已废弃）'
        };
      case 'demo':
        return {
          icon: Eye,
          label: '演示模式',
          variant: 'outline' as const,
          description: '使用演示数据，不会持久化'
        };
      default:
        return {
          icon: Database,
          label: '未知模式',
          variant: 'destructive' as const,
          description: ''
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1.5">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

export function DatabaseStatusDetail() {
  const getStatusConfig = () => {
    switch (dbMode) {
      case 'api':
        return {
          icon: Server,
          label: '后端数据库模式',
          variant: 'default' as const,
          description: '数据存储在后端 PostgreSQL 数据库中，通过 REST API 访问。支持多用户、多设备同步。',
          tips: '提示：所有数据操作都通过后端 API 进行，确保网络连接正常。'
        };
      case 'local':
        return {
          icon: Database,
          label: '本地数据库模式',
          variant: 'default' as const,
          description: '数据存储在浏览器 IndexedDB 中，完全本地化，隐私安全。',
          tips: '提示：定期导出数据以防丢失。'
        };
      case 'supabase':
        return {
          icon: Cloud,
          label: 'Supabase 云端模式（已废弃）',
          variant: 'secondary' as const,
          description: '此模式已不再使用，请使用后端数据库模式。',
          tips: '提示：已迁移到后端 PostgreSQL 数据库。'
        };
      case 'demo':
        return {
          icon: Eye,
          label: '演示模式',
          variant: 'outline' as const,
          description: '使用内置演示数据，所有操作不会持久化保存。',
          tips: '提示：配置数据库以保存您的数据。'
        };
      default:
        return {
          icon: Database,
          label: '未知模式',
          variant: 'destructive' as const,
          description: '数据库配置异常',
          tips: ''
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className="flex items-start gap-3 rounded-lg border p-4">
      <div className="rounded-full bg-muted p-2">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">{config.label}</h4>
          <Badge variant={config.variant} className="text-xs">
            {dbMode}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{config.description}</p>
        {config.tips && (
          <p className="text-xs text-muted-foreground italic">{config.tips}</p>
        )}
      </div>
    </div>
  );
}
