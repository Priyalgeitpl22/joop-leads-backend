export interface Account {
    _id?: string;
    account?: string;
    name: string;
    email: string;
    orgId: string;
    type: EmailAccountType;
    time_gap: number;
    limit: number;
    lastFetchTimestamp?: string;
    last_sent?: string;
    state: EmailAccountState;
    oauth2: {
        authorize: boolean;
        clientId: string;
        clientSecret: string;
        redirectUri: string;
        tokens: {
            access_token: string;
            expiry_date: Date;
            refresh_token: string;
            scope: string;
            token_type: string;
        }
    }
    smtp: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass: string;
        };
    };
    imap: {
        host: string;
        port: number;
        secure: boolean;
        auth: {
            user: string;
            pass: string;
        };
    };
    warmup: IWarmupSettings;
    signature: string | null;
}

export interface IWarmupSettings {
    enabled: boolean;
    maxPerDay: number;

    identifierTag: string;
    rampupIncrement: number;

    randomizeEmailsPerDay: boolean;
    replyRate: number;

    reputation: number;
    reputationLastCalculated: Date | null;

    startDate: Date | null;
    weekdaysOnly: boolean;

    customDomainTracking: boolean;
    dailyRampup: boolean;
    dailyReplyTarget: number;

    maxEmailsPerDay: [number, number];

    // Derived / runtime fields (not from API)
    dailyLimit?: number;
    dailyLimitUsed?: number;
    dailyLimitRemaining?: number;
}

export enum EmailAccountState {
    CONNECTED = 'connected',
    INACTIVE = 'inactive',
    PENDING = 'pending',
    VERIFIED = 'verified',
    UNVERIFIED = 'unverified',
    DISABLED = 'disabled',
    DELETED = 'deleted',
}

export enum EmailAccountType {
    GMAIL = 'gmail',
    OUTLOOK = 'outlook',
    IMAP = 'imap',
    SMTP = 'smtp',
}
