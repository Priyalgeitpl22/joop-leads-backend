import { DateTime } from "luxon";

export interface AIResponse {
  message?: string,
  status: number,
  question?: string,
  answer?: string
}

export interface Organization {
  id?: string;
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zip?: number | null;
  domain?: string;
  industry?: string;
}

export interface SequenceVariant {
  subject: string;
  emailBody: string;
}

export interface Sequence {
  id: string;
  createdAt: Date;
  campaign_id: string | null;
  seq_number: number | null;
  sequence_schedular_type: string | null;
  seq_delay_details: any;
  seq_type: string | null;
  variant_distribution_type: string | null;
  seq_variants?: any;
}

export interface campaignSchedule {
  startDate: Date,
  startTime: DateTime,
  endTime: DateTime,
  selectedDays: [],
  timeZone: string,
}
export interface Account {
  email: string
  type: string,
  imap: {
    host: string;
    port: string;
    secure: string;
    auth: {
      user: string;
      pass: string;
    },
  },
  smtp: {
    host: string;
    port: string;
    secure: string;
    auth: {
      user: string;
      pass: string;
    },
  },
  proxy: null,
  smtpEhloName: "localhost",
}
