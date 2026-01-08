import axios from 'axios';
type AxiosInstance = ReturnType<typeof axios.create>;
import { IReoonVerificationResponse, IBulkVerificationTaskResponse } from '../models/email.verificaition.model';
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

  async checkAccountBalance(): Promise<object> {
    try {
      const response = await this.axiosInstance.get<{ result: object }>('/check-account-balance/', {
        params: {
          key: this.apiKey,
        },
      });

      return response.data;
    } catch (error: any) {
      throw new Error(`Reoon API Error: ${error.message}`);
    }
  }

  async submitBulkVerification(emails: string[], taskName: string): Promise<string> {
    const url = `${this.baseUrl}/create-bulk-verification-task/`;

    const payload = {
      name: taskName,
      emails: emails,
      key: process.env.REOON_API_KEY,
    };  
    try {
      const response : any= await this.axiosInstance.post<{
        status: string;
        task_id: number;
      }>(url, payload, {
          headers: {
            'Content-Type': 'application/json',
          },
      });

      return String(response.data.task_id);
    } catch (error: any) {
      if (error.response) {
        console.error('Reoon error:', error.response.data);
      } else {
        console.error('Network error:', error.message);
      }
      throw error;
    }
  }

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

  async checkBulkStatusOnce(taskId: string): Promise<{
    completed: boolean;
    result?: IBulkVerificationTaskResponse;
  }> {
    const result = await this.getBulkVerificationResults(taskId);

    if (result.status === 'completed') {
      return { completed: true, result };
    }

    if (
      result.status === 'file_not_found' ||
      result.status === 'file_loading_error'
    ) {
      throw new Error(`Verification failed: ${result.status}`);
    }

    return { completed: false };
  }
}