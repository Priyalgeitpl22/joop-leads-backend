// services/reoon.service.ts

import axios from 'axios';
type AxiosInstance = ReturnType<typeof axios.create>;
import { IReoonVerificationResponse, IBulkVerificationTaskResponse } from '../models/emailVerificaition.model';
import FormData from 'form-data';
import { Blob } from 'buffer';

export class ReoonService {
  private apiKey: string;
  private baseUrl: string;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.apiKey = process.env.REOON_API_KEY || '';
    this.baseUrl = process.env.REOON_API_BASE_URL || 'https://emailverifier.reoon.com/api/v1';
    
    if (!this.apiKey) {
      throw new Error('REOON_API_KEY is not set in environment variables');
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  /**
   * Submit bulk email verification task
   */
  async submitBulkVerification(emails: string[], taskName: string): Promise<string> {
    try {
      const formData = new FormData();
      
      // Create a CSV string from emails
      const csvContent = emails.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      
      formData.append('file', blob, 'emails.csv');
      formData.append('key', this.apiKey);
      formData.append('name', taskName);

      const response = await this.axiosInstance.post<{ status: string; task_id?: string; reason?: string }>(
        '/bulk-email-verification-task/',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      const data = response.data;

      if (data.status === 'success' && data.task_id) {
        return data.task_id;
      }

      throw new Error(data.reason || 'Failed to submit bulk verification task');
    } catch (error: any) {
      throw new Error(`Reoon API Error: ${error.message}`);
    }
  }

  /**
   * Get bulk verification task results
   */
  async getBulkVerificationResults(taskId: string): Promise<IBulkVerificationTaskResponse> {
    try {
      const response = await this.axiosInstance.get<IBulkVerificationTaskResponse>(
        `/get-result-bulk-verification-task/`,
        {
          params: {
            key: this.apiKey,
            task_id: taskId,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      throw new Error(`Reoon API Error: ${error.message}`);
    }
  }

  /**
   * Verify single email
   */
  async verifySingleEmail(
    email: string,
    mode: 'quick' | 'power' = 'power'
  ): Promise<IReoonVerificationResponse> {
    try {
      const response = await this.axiosInstance.get<IReoonVerificationResponse>('/verify', {
        params: {
          email,
          key: this.apiKey,
          mode,
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Reoon API Error: ${error.message}`);
    }
  }

  /**
   * Poll for bulk verification results until completed
   */
  async waitForBulkVerificationCompletion(
    taskId: string,
    pollIntervalMs: number = 10000,
    maxAttempts: number = 60
  ): Promise<IBulkVerificationTaskResponse> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      const result = await this.getBulkVerificationResults(taskId);

      if (result.status === 'completed') {
        return result;
      }

      if (result.status === 'file_not_found' || result.status === 'file_loading_error') {
        throw new Error(`Verification failed: ${result.status}`);
      }

      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      attempts++;
    }

    throw new Error('Bulk verification timeout: Maximum polling attempts reached');
  }
}