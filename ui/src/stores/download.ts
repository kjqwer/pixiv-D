import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import downloadService from '@/services/download';
import type { DownloadTask } from '@/types';

export const useDownloadStore = defineStore('download', () => {
  // 状态
  const tasks = ref<DownloadTask[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdate = ref<number>(0);

  // SSE连接管理
  const sseConnections = ref<Map<string, () => void>>(new Map());
  
  // 延迟更新管理
  const delayedUpdates = ref<Map<string, number[]>>(new Map());

  // 清理指定任务的所有延迟更新
  const clearAllDelayedUpdates = (taskId: string) => {
    const timeouts = delayedUpdates.value.get(taskId);
    if (timeouts) {
      timeouts.forEach(timeout => clearTimeout(timeout));
      delayedUpdates.value.delete(taskId);
    }
  };

  // 添加延迟更新
  const addDelayedUpdate = (taskId: string, timeout: number) => {
    if (!delayedUpdates.value.has(taskId)) {
      delayedUpdates.value.set(taskId, []);
    }
    delayedUpdates.value.get(taskId)!.push(timeout);
  };

  // 计算属性：显示活跃任务和暂停任务
  const activeTasks = computed(() => {
    return tasks.value.filter(task =>
      ['downloading', 'paused'].includes(task.status)
    );
  });

  // 计算属性：正在下载的任务
  const downloadingTasks = computed(() => {
    return tasks.value.filter(task => task.status === 'downloading');
  });

  // 计算属性：暂停的任务
  const pausedTasks = computed(() => {
    return tasks.value.filter(task => task.status === 'paused');
  });

  // 获取指定任务
  const getTask = (taskId: string) => {
    return tasks.value.find(task => task.id === taskId) || null;
  };

  // 获取指定作品的任务
  const getArtworkTask = (artworkId: number) => {
    return tasks.value.find(task => 
      task.artwork_id === artworkId && 
      ['downloading', 'paused'].includes(task.status)
    ) || null;
  };

  // 获取任务列表（优化版本）
  const fetchTasks = async () => {
    try {
      loading.value = true;
      error.value = null;
      
      // 使用增量更新API
      const response = await downloadService.getTasksChanges(lastUpdate.value);
      if (response.success) {
        const { tasks: changedTasks, lastUpdate: newLastUpdate } = response.data;
        
        // 更新任务列表
        changedTasks.forEach((changedTask: DownloadTask) => {
          const index = tasks.value.findIndex((t: DownloadTask) => t.id === changedTask.id);
          if (index !== -1) {
            tasks.value[index] = changedTask;
          } else {
            tasks.value.push(changedTask);
          }
        });
        
        lastUpdate.value = newLastUpdate;
        
        // 管理SSE连接
        manageSSEConnections();
      } else {
        throw new Error(response.error || '获取任务列表失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取任务列表失败';
      console.error('获取任务列表失败:', err);
    } finally {
      loading.value = false;
    }
  };

  // 获取活跃任务（轻量级）
  const fetchActiveTasks = async () => {
    try {
      const response = await downloadService.getActiveTasks();
      if (response.success) {
        // 只更新活跃任务
        const activeTaskIds = new Set(response.data.map((t: DownloadTask) => t.id));
        
        // 移除已完成的活跃任务
        tasks.value = tasks.value.filter((task: DownloadTask) => 
          !activeTaskIds.has(task.id) || ['downloading', 'paused'].includes(task.status)
        );
        
        // 更新或添加活跃任务
        response.data.forEach((activeTask: DownloadTask) => {
          const index = tasks.value.findIndex((t: DownloadTask) => t.id === activeTask.id);
          if (index !== -1) {
            tasks.value[index] = activeTask;
          } else {
            tasks.value.push(activeTask);
          }
        });
        
        // 管理SSE连接
        manageSSEConnections();
      }
    } catch (err) {
      console.error('获取活跃任务失败:', err);
    }
  };

  // 获取任务摘要（用于快速状态检查）
  const fetchTasksSummary = async () => {
    try {
      const response = await downloadService.getTasksSummary();
      if (response.success) {
        // 可以用于快速检查是否有新任务完成
        return response.data;
      }
    } catch (err) {
      console.error('获取任务摘要失败:', err);
    }
    return null;
  };

  // 开始SSE监听任务进度
  const startTaskStreaming = (taskId: string) => {
    // 如果已经有连接，先关闭
    if (sseConnections.value.has(taskId)) {
      sseConnections.value.get(taskId)!();
    }

    // console.log('开始SSE监听任务进度:', taskId);

    // 添加超时处理 - 增加到60秒以匹配后端
    const timeoutId = setTimeout(() => {
      console.warn('SSE连接超时，关闭连接:', taskId);
      stopTaskStreaming(taskId);
    }, 60000); // 60秒超时

    const closeConnection = downloadService.streamTaskProgress(
      taskId,
      (task) => {
        // 验证task对象是否有效
        if (!task || !task.id) {
          console.error('收到无效的任务数据:', task);
          return;
        }

        // console.log('收到SSE进度更新:', {
        //   taskId,
        //   status: task.status,
        //   progress: task.progress,
        //   completed: task.completed_files,
        //   total: task.total_files
        // });

        // 清除超时
        clearTimeout(timeoutId);

        // 更新任务状态
        const index = tasks.value.findIndex(t => t.id === taskId);
        if (index !== -1) {
          // 保留临时状态（如pausing, resuming, cancelling）
          const currentTask = tasks.value[index];
          const isTemporaryStatus = ['pausing', 'resuming', 'cancelling'].includes(currentTask.status);
          
          if (!isTemporaryStatus) {
            tasks.value[index] = task;
          } else {
            // 只更新进度相关字段，保留临时状态
            tasks.value[index] = {
              ...currentTask,
              progress: task.progress,
              completed_files: task.completed_files,
              failed_files: task.failed_files,
              recent_completed: task.recent_completed
            };
          }
        } else {
          // 如果是新任务，添加到列表
          tasks.value.push(task);
        }

        // 如果任务完成或暂停，清理连接并触发额外的状态同步
        if (['completed', 'failed', 'cancelled', 'partial', 'paused'].includes(task.status)) {
          console.log('任务状态变更，关闭SSE连接:', taskId, task.status);
          stopTaskStreaming(taskId);
          
          // 如果任务完成，立即更新本地状态并停止所有延迟操作
          if (['completed', 'failed', 'cancelled', 'partial'].includes(task.status)) {
            console.log('任务完成，立即更新状态:', taskId, task.status);
            
            // 立即更新本地任务状态，防止被其他操作覆盖
            const index = tasks.value.findIndex(t => t.id === taskId);
            if (index !== -1) {
              tasks.value[index] = { ...task };
            }
            
            // 取消所有可能的延迟状态更新操作
            clearAllDelayedUpdates(taskId);
          }
        }
      },
      () => {
        console.log('SSE连接完成:', taskId);
        clearTimeout(timeoutId);
        stopTaskStreaming(taskId);
      }
    );

    sseConnections.value.set(taskId, closeConnection);
  };

  // 停止SSE监听
  const stopTaskStreaming = (taskId: string) => {
    if (sseConnections.value.has(taskId)) {
      sseConnections.value.get(taskId)!();
      sseConnections.value.delete(taskId);
    }
  };

  // 管理SSE连接
  const manageSSEConnections = () => {
    // 清理不需要的连接
    const currentTaskIds = new Set(activeTasks.value.map(task => task.id));
    
    // 关闭已不存在的任务的连接
    sseConnections.value.forEach((closeConnection, taskId) => {
      if (!currentTaskIds.has(taskId)) {
        console.log('清理已不存在的任务连接:', taskId);
        closeConnection();
        sseConnections.value.delete(taskId);
      }
    });

    // 为正在下载的任务建立连接，增加状态检查
    activeTasks.value.forEach(task => {
      if (task.status === 'downloading' && !sseConnections.value.has(task.id)) {
        console.log('为下载任务建立SSE连接:', task.id, task.status);
        startTaskStreaming(task.id);
      }
    });
    
    // 清理已暂停或完成任务的连接
    sseConnections.value.forEach((closeConnection, taskId) => {
      const task = getTask(taskId);
      if (task && ['paused', 'completed', 'failed', 'cancelled', 'partial'].includes(task.status)) {
        console.log('清理非活跃任务的SSE连接:', taskId, task.status);
        closeConnection();
        sseConnections.value.delete(taskId);
      }
    });
  };

  // 清理所有SSE连接
  const cleanupSSEConnections = () => {
    sseConnections.value.forEach(closeConnection => {
      closeConnection();
    });
    sseConnections.value.clear();
  };

  // 定期刷新任务列表
  let refreshInterval: number | null = null;
  let summaryInterval: number | null = null;

  const startRefreshInterval = () => {
    if (refreshInterval) return;
    
    // 主要刷新：每5秒获取活跃任务（轻量级）
    refreshInterval = window.setInterval(() => {
      fetchActiveTasks();
    }, 5000);
    
    // 摘要检查：每30秒检查一次任务摘要，如果有变化则获取详细信息
    summaryInterval = window.setInterval(async () => {
      const summary = await fetchTasksSummary();
      if (summary && summary.active > 0) {
        // 如果有活跃任务，确保获取最新状态
        fetchActiveTasks();
      }
    }, 30000);
  };

  const stopRefreshInterval = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
    if (summaryInterval) {
      clearInterval(summaryInterval);
      summaryInterval = null;
    }
  };

  // 添加新任务（用于立即显示）
  const addTask = (task: DownloadTask) => {
    // 检查是否已存在
    const existingIndex = tasks.value.findIndex(t => t.id === task.id);
    if (existingIndex !== -1) {
      tasks.value[existingIndex] = task;
    } else {
      tasks.value.push(task);
    }

    // 如果是下载中的任务，立即建立SSE连接
    if (task.status === 'downloading') {
      startTaskStreaming(task.id);
    }
  };

  // 更新任务状态
  const updateTask = (taskId: string, updates: Partial<DownloadTask>) => {
    const index = tasks.value.findIndex(t => t.id === taskId);
    if (index !== -1) {
      tasks.value[index] = { ...tasks.value[index], ...updates };
    }
  };

  // 移除任务
  const removeTask = (taskId: string) => {
    const index = tasks.value.findIndex(t => t.id === taskId);
    if (index !== -1) {
      tasks.value.splice(index, 1);
    }
    stopTaskStreaming(taskId);
  };

  // 取消任务
  const cancelTask = async (taskId: string) => {
    try {
      // 立即停止SSE连接
      stopTaskStreaming(taskId);
      
      // 立即更新本地状态为取消中
      updateTask(taskId, { status: 'cancelling' as any });
      
      const response = await downloadService.cancelTask(taskId);
      if (response.success) {
        // 立即从任务列表中移除
        removeTask(taskId);
        // 异步刷新任务列表以确保同步
        setTimeout(() => fetchTasks(), 500);
      } else {
        // 如果取消失败，恢复原状态
        await fetchTasks();
        throw new Error(response.error || '取消任务失败');
      }
    } catch (err) {
      // 如果是网络错误或超时，提供更友好的错误信息
      let errorMessage = '取消任务失败';
      if (err instanceof Error) {
        if (err.message.includes('timeout') || err.message.includes('network')) {
          errorMessage = '网络连接超时，请检查网络连接后重试';
        } else if (err.message.includes('404')) {
          errorMessage = '任务不存在或已被删除';
        } else {
          errorMessage = err.message;
        }
      }
      
      error.value = errorMessage;
      console.error('取消任务失败:', err);
      
      // 恢复任务状态
      await fetchTasks();
      throw new Error(errorMessage);
    }
  };

  // 恢复任务
  const resumeTask = async (taskId: string) => {
    try {
      // 获取任务信息以确定类型
      const task = getTask(taskId);
      
      // 立即更新本地状态为恢复中
      updateTask(taskId, { status: 'resuming' as any });
      
      let response;
      
      // 判断是否为批量下载任务（batch、artist、art类型都是批量下载）
      if (task && ['batch', 'artist', 'art'].includes(task.type)) {
        // 使用批量下载专用API
        response = await downloadService.resumeBatchTask(taskId);
      } else {
        // 使用单个下载API
        response = await downloadService.resumeTask(taskId);
      }
      
      if (response.success) {
        // 清理可能存在的延迟更新
        clearAllDelayedUpdates(taskId);
        
        // 使用后端返回的最新状态，确保状态同步
        if (response.data) {
          const index = tasks.value.findIndex(t => t.id === taskId);
          if (index !== -1) {
            tasks.value[index] = { ...response.data };
          }
        } else {
          // 如果后端没有返回数据，则手动更新状态
          updateTask(taskId, { status: 'downloading' });
        }
        
        // 立即建立SSE连接
        startTaskStreaming(taskId);
      } else {
        // 如果恢复失败，恢复原状态
        await fetchTasks();
        throw new Error(response.error || '恢复任务失败');
      }
    } catch (err) {
      // 提供更友好的错误信息
      let errorMessage = '恢复任务失败';
      if (err instanceof Error) {
        if (err.message.includes('timeout') || err.message.includes('network')) {
          errorMessage = '网络连接超时，请检查网络连接后重试';
        } else if (err.message.includes('404')) {
          errorMessage = '任务不存在或已被删除';
        } else if (err.message.includes('already running')) {
          errorMessage = '任务已在运行中';
        } else {
          errorMessage = err.message;
        }
      }
      
      error.value = errorMessage;
      console.error('恢复任务失败:', err);
      
      // 恢复任务状态
      await fetchTasks();
      throw new Error(errorMessage);
    }
  };

  // 暂停任务
  const pauseTask = async (taskId: string) => {
    try {
      // 获取任务信息以确定类型
      const task = getTask(taskId);
      
      // 立即更新本地状态为暂停中
      updateTask(taskId, { status: 'pausing' as any });
      
      let response;
      
      // 判断是否为批量下载任务（batch、artist、art类型都是批量下载）
      if (task && ['batch', 'artist', 'art'].includes(task.type)) {
        // 使用批量下载专用API
        response = await downloadService.pauseBatchTask(taskId);
      } else {
        // 使用单个下载API
        response = await downloadService.pauseTask(taskId);
      }
      
      if (response.success) {
        // 清理可能存在的延迟更新
        clearAllDelayedUpdates(taskId);
        
        // 使用后端返回的最新状态，确保状态同步
        if (response.data) {
          const index = tasks.value.findIndex(t => t.id === taskId);
          if (index !== -1) {
            tasks.value[index] = { ...response.data };
          }
        } else {
          // 如果后端没有返回数据，则手动更新状态
          updateTask(taskId, { status: 'paused' });
        }
        
        // 停止SSE连接
        stopTaskStreaming(taskId);
      } else {
        // 如果暂停失败，恢复原状态
        await fetchTasks();
        throw new Error(response.error || '暂停任务失败');
      }
    } catch (err) {
      // 提供更友好的错误信息
      let errorMessage = '暂停任务失败';
      if (err instanceof Error) {
        if (err.message.includes('timeout') || err.message.includes('network')) {
          errorMessage = '网络连接超时，请检查网络连接后重试';
        } else if (err.message.includes('404')) {
          errorMessage = '任务不存在或已被删除';
        } else if (err.message.includes('already paused')) {
          errorMessage = '任务已暂停';
        } else {
          errorMessage = err.message;
        }
      }
      
      error.value = errorMessage;
      console.error('暂停任务失败:', err);
      
      // 恢复任务状态
      await fetchTasks();
      throw new Error(errorMessage);
    }
  };

  // 清理已完成的任务
  const cleanupCompletedTasks = async (keepCount = 100) => {
    try {
      const response = await downloadService.cleanupTasks(true, keepCount);
      if (response.success) {
        await fetchTasks();
      } else {
        throw new Error(response.error || '清理任务失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '清理任务失败';
      console.error('清理任务失败:', err);
      throw err;
    }
  };

  // 清理历史记录
  const cleanupHistory = async (keepCount = 500) => {
    try {
      const response = await downloadService.cleanupHistory(keepCount);
      if (response.success) {
        // 历史记录清理不影响当前任务状态
        return response.data;
      } else {
        throw new Error(response.error || '清理历史失败');
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '清理历史失败';
      console.error('清理历史失败:', err);
      throw err;
    }
  };

  // 清除错误
  const clearError = () => {
    error.value = null;
  };

  return {
    // 状态
    tasks,
    loading,
    error,
    lastUpdate,
    
    // 计算属性
    activeTasks,
    downloadingTasks,
    pausedTasks,
    
    // 方法
    getTask,
    getArtworkTask,
    fetchTasks,
    fetchActiveTasks,
    fetchTasksSummary,
    addTask,
    updateTask,
    removeTask,
    cancelTask,
    resumeTask,
    pauseTask,
    cleanupCompletedTasks,
    cleanupHistory,
    clearError,
    
    // SSE管理
    startTaskStreaming,
    stopTaskStreaming,
    manageSSEConnections,
    cleanupSSEConnections,
    
    // 定期刷新管理
    startRefreshInterval,
    stopRefreshInterval
  };
});