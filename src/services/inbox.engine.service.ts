import { httpClient } from "./http.client.service";
import { Account } from "../models";

export class InboxEngineApiService {
  /** GET example */
  static async getAccountByEmail(email: string): Promise<Account> {
    try {
      const { data } = await httpClient.get<Account>(
        `/accounts/email?email=${email}`
      );
      return data;
    } catch (error) {
      console.error(`Error getting account by email: ${email}`, error);
      throw error;
    }
  }
}
