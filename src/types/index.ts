// Common types used across the application

export type CampaignStatus = 'pending' | 'in_progress' | 'paused' | 'completed' | 'failed';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type CallLogStatus = 'initiated' | 'in_progress' | 'completed' | 'failed';
export type PhoneNumberStatus = 'valid' | 'invalid' | 'do_not_call';

export interface CreateUserRequest {
  name: string;
  email: string;
}

export interface CreateCampaignRequest {
  user_id: string;
  name: string;
  schedule_id: string;
  max_concurrent_calls?: number;
  max_retries?: number;
  retry_delay_seconds?: number;
}

export interface StartCampaignResponse {
  message: string;
  tasksEnqueued: number;
}

export interface CampaignStats {
  campaign: {
    id: string;
    name: string;
    status: CampaignStatus;
    total_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    retries_attempted: number;
  };
  task_breakdown: Array<{
    status: TaskStatus;
    _count: number;
  }>;
  total_call_logs: number;
}

