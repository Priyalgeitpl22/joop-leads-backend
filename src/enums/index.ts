export enum UserRoles {
    ADMIN = 'Admin',
    AGENT = 'Agent'
}

export enum ThreadType {
    UNASSIGNED = "unassigned",
    ASSIGNED_TO_ME = "assigned_to_me",
    ALL_OPEN = "all_open",
    BOT = "bot"
}

export enum PlanCode {
    FREE = 'FREE',
    SILVER = 'SILVER',
    GOLD = 'GOLD',
    PLATINUM = 'PLATINUM',
}

export enum SupportType {
    COMMUNITY = 'COMMUNITY',    
    EMAIL_24x7 = 'EMAIL_24x7',
    PRIORITY_EMAIL_CHAT = 'PRIORITY_EMAIL_CHAT',
    PHONE_WHATSAPP = 'PHONE_WHATSAPP',
}

export enum BillingPeriod {
    MONTHLY = 'MONTHLY',
    YEARLY = 'YEARLY',
    CUSTOM = 'CUSTOM',
}

export enum AnalyticsCountType {
    SENT_COUNT = 'sentCount',
    DELIVERED_COUNT = 'deliveredCount',
    OPENED_COUNT = 'openedCount',
    CLICKED_COUNT = 'clickedCount',
    REPLIED_COUNT = 'repliedCount',
    BOUNCED_COUNT = 'bouncedCount',
    UNSUBSCRIBED_COUNT = 'unsubscribedCount',
    COMPLAINED_COUNT = 'complainedCount',
    FAILED_COUNT = 'failedCount',
}


export enum AnalyticsRateType {
    OPEN_RATE = 'openRate',
    CLICK_RATE = 'clickRate',
    REPLY_RATE = 'replyRate',
    BOUNCE_RATE = 'bounceRate',
}