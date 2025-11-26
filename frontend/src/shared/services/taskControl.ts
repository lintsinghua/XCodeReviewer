/**
 * 任务控制服务
 * 用于管理审计任务的状态和控制
 */

import { api } from '@/shared/api/database';

class TaskControl {
  private cancelledTasks: Set<string> = new Set();

  /**
   * 取消任务
   * @param taskId 任务ID
   */
  cancelTask(taskId: string): void {
    this.cancelledTasks.add(taskId);
    
    // 调用后端API取消任务
    api.cancelAuditTask(taskId).catch((error) => {
      console.error('取消任务失败:', error);
    });
  }

  /**
   * 检查任务是否已取消
   * @param taskId 任务ID
   * @returns 是否已取消
   */
  isCancelled(taskId: string): boolean {
    return this.cancelledTasks.has(taskId);
  }

  /**
   * 清除任务取消状态
   * @param taskId 任务ID
   */
  clearCancelled(taskId: string): void {
    this.cancelledTasks.delete(taskId);
  }

  /**
   * 清除所有任务取消状态
   */
  clearAll(): void {
    this.cancelledTasks.clear();
  }
}

export const taskControl = new TaskControl();

