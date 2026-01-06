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

  static async updateAccountPartially(accountId: string, accountData: Partial<Account>): Promise<void> {
    try {
      await httpClient.patch(`/accounts/${accountId}`, accountData);
    } catch (error) {
      console.error(`Error updating account: ${accountId}`, error);
      throw error;
    }
  }
}
