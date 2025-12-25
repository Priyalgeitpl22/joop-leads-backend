import { PrismaClient } from "@prisma/client";
import { dayjs } from "../utils/date";

const prisma = new PrismaClient();

interface UpcomingTrigger {
    campaignId: string;
    leadId: string;
    leadEmail: string;
    sequenceStep: number;
    nextTriggerAt: Date;
    status: string;
    timezone: string;
    isFollowUp: boolean;
}

interface LeadState {
    campaignLeadId: string;
    leadId: string;
    leadEmail: string;
    currentStep: number;
    lastSentAt: Date | null;
}

export class TriggerLogService {
    /**
     * Get campaign trigger logs (activity history)
     * @param campaignId - The campaign ID
     * @param limit - Number of logs to return (default 50)
     * @param offset - Offset for pagination (default 0)
     */
    static async getTriggerLogs(campaignId: string, limit = 50, offset = 0) {
        try {
            // @ts-ignore - campaignTriggerLog will be available after prisma generate & migrate
            const logs = await prisma.campaignTriggerLog.findMany({
                where: { campaignId },
                orderBy: { triggeredAt: "desc" },
                take: limit,
                skip: offset,
            });

            // @ts-ignore
            const total = await prisma.campaignTriggerLog.count({
                where: { campaignId },
            });

            return {
                logs,
                total,
                limit,
                offset,
            };
        } catch (err) {
            return { logs: [], total: 0, limit, offset };
        }
    }

    /**
     * Get upcoming trigger information for a campaign
     * Simulates the scheduler logic to predict future email sends
     * Accounts for:
     * - sendingPriority (% follow-ups vs new leads)
     * - Sender daily limits
     * - Sequence delays
     * - Schedule windows
     * 
     * @param campaignId - The campaign ID
     * @param limit - Number of upcoming triggers to return (default 50)
     * @param offset - Offset for pagination (default 0)
     */
    static async getUpcomingTriggers(campaignId: string, limit = 50, offset = 0) {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                runtime: true,
                sequences: {
                    where: { isActive: true },
                    orderBy: { seqNumber: "asc" },
                },
                leads: {
                    where: {
                        status: "PENDING",
                        isStopped: false,
                    },
                    include: { lead: true },
                    orderBy: { createdAt: "asc" },
                },
                senders: {
                    include: { sender: true },
                },
            },
        });

        if (!campaign) {
            return { logs: [], total: 0, limit, offset };
        }

        const runtime = campaign.runtime;
        if (!runtime) {
            return { logs: [], total: 0, limit, offset };
        }

        if (campaign.status !== "ACTIVE" && campaign.status !== "SCHEDULED") {
            return { logs: [], total: 0, limit, offset };
        }

        const {
            timezone,
            intervalMinutes,
            maxEmailsPerDay,
            sendDays,
            windowStart,
            windowEnd,
            sendingPriority, // % of emails that should be follow-ups
        } = campaign;

        const sequences = campaign.sequences;
        const pendingLeads = campaign.leads;
        const senders = campaign.senders.map((cs) => cs.sender).filter(Boolean);

        if (pendingLeads.length === 0 || sequences.length === 0 || senders.length === 0) {
            return { logs: [], total: 0, limit, offset };
        }

        // Calculate total daily sending capacity from all senders
        const totalSenderDailyCapacity = senders.reduce((sum, s) => sum + (s?.dailyLimit || 0), 0);
        const effectiveDailyLimit = Math.min(maxEmailsPerDay, totalSenderDailyCapacity);

        // Build sequence delay map (seqNumber -> delay in minutes from previous seq)
        const sequenceDelays = new Map<number, { delayMinutes: number }>();
        for (const seq of sequences) {
            const delayMinutes = seq.delayDays * 24 * 60 + seq.delayHours * 60 + seq.delayMinutes;
            sequenceDelays.set(seq.seqNumber, { delayMinutes });
        }

        // Initialize lead states
        const leadStates: LeadState[] = pendingLeads
            .filter((cl) => cl.lead)
            .map((cl) => ({
                campaignLeadId: cl.id,
                leadId: cl.lead!.id,
                leadEmail: cl.lead!.email,
                currentStep: cl.currentSequenceStep,
                lastSentAt: cl.lastSentAt,
            }));

        // Helper: find the next valid send time considering schedule constraints
        const findNextValidSendTime = (fromTime: Date): Date => {
            let candidateTime = dayjs(fromTime).tz(timezone);

            // Try up to 14 days to find a valid slot
            for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
                const checkDate = candidateTime.add(dayOffset, "day");
                const dayOfWeek = checkDate.format("ddd"); // Mon, Tue, etc.

                // Check if this day is allowed
                if (!sendDays.includes(dayOfWeek)) {
                    continue;
                }

                // Parse window times
                const [startHour, startMin] = windowStart.split(":").map(Number);
                const [endHour, endMin] = windowEnd.split(":").map(Number);

                const startOfWindow = checkDate.hour(startHour).minute(startMin).second(0);
                const endOfWindow = checkDate.hour(endHour).minute(endMin).second(0);

                if (dayOffset === 0) {
                    if (candidateTime.isAfter(endOfWindow)) {
                        continue; // Past today's window
                    }
                    if (candidateTime.isBefore(startOfWindow)) {
                        return startOfWindow.toDate(); // Before window, use window start
                    }
                    return candidateTime.toDate(); // Within window
                }

                return startOfWindow.toDate(); // For future days, use window start
            }

            return fromTime; // Fallback
        };

        // Helper: get the start of the next valid day's window
        const getNextDayWindowStart = (fromTime: Date): Date => {
            const nextDay = dayjs(fromTime).tz(timezone).add(1, "day").startOf("day");
            return findNextValidSendTime(nextDay.toDate());
        };

        // Simulate sending day by day
        const upcomingTriggers: UpcomingTrigger[] = [];
        let currentTime = findNextValidSendTime(new Date(runtime.nextRunAt));
        let currentDay = dayjs(currentTime).tz(timezone).format("YYYY-MM-DD");
        let emailsSentToday = 0;

        // Max iterations to prevent infinite loops
        const maxIterations = 1000;
        let iterations = 0;

        while (iterations < maxIterations) {
            iterations++;

            // Check if we've collected enough triggers
            if (upcomingTriggers.length >= offset + limit + 100) {
                break; // Buffer extra for accurate total
            }

            // Check if any leads still need emails
            const leadsNeedingEmails = leadStates.filter(
                (ls) => ls.currentStep < sequences.length
            );
            if (leadsNeedingEmails.length === 0) {
                break; // All leads completed all sequences
            }

            // Check if day changed
            const timeDay = dayjs(currentTime).tz(timezone).format("YYYY-MM-DD");
            if (timeDay !== currentDay) {
                currentDay = timeDay;
                emailsSentToday = 0;
            }

            // Check daily limit
            if (emailsSentToday >= effectiveDailyLimit) {
                // Move to next day's window start
                currentTime = getNextDayWindowStart(currentTime);
                continue;
            }

            // Calculate slots for this tick based on sendingPriority
            // sendingPriority = % of emails for follow-ups
            // Find follow-up candidates: leads with currentStep > 0 AND delay has passed
            const now = currentTime;
            const followUpCandidates: LeadState[] = [];
            const newLeadCandidates: LeadState[] = [];

            for (const ls of leadStates) {
                if (ls.currentStep >= sequences.length) continue; // Completed

                const nextStep = ls.currentStep + 1;
                const nextSeq = sequences.find((s) => s.seqNumber === nextStep);
                if (!nextSeq) continue;

                if (ls.currentStep === 0) {
                    // New lead - hasn't received any email yet
                    newLeadCandidates.push(ls);
                } else {
                    // Follow-up candidate - check if delay has passed
                    const seqDelay = sequenceDelays.get(nextStep);
                    if (seqDelay && ls.lastSentAt) {
                        const delayMs = seqDelay.delayMinutes * 60 * 1000;
                        const eligibleAt = new Date(ls.lastSentAt.getTime() + delayMs);
                        if (now >= eligibleAt) {
                            followUpCandidates.push(ls);
                        }
                        // If delay hasn't passed, skip for now (will be eligible later)
                    }
                }
            }

            // Determine how many follow-ups vs new leads to send this tick
            // Each tick processes one email per sender (Smartlead pattern)
            // But for simulation, we'll process one at a time to show proper ordering

            let candidateToSend: LeadState | null = null;
            let isFollowUp = false;

            // Apply sendingPriority: prefer follow-ups if we have them and priority allows
            const followUpRatio = sendingPriority / 100;
            const currentFollowUpCount = upcomingTriggers.filter((t) => t.isFollowUp).length;
            const currentNewCount = upcomingTriggers.filter((t) => !t.isFollowUp).length;
            const totalScheduled = currentFollowUpCount + currentNewCount;

            // Calculate expected ratio - should we send a follow-up or new lead?
            let shouldSendFollowUp = false;
            if (followUpCandidates.length > 0 && newLeadCandidates.length > 0) {
                // Both available - use priority ratio
                const currentFollowUpRatio = totalScheduled > 0 ? currentFollowUpCount / totalScheduled : 0;
                shouldSendFollowUp = currentFollowUpRatio < followUpRatio;
            } else if (followUpCandidates.length > 0) {
                shouldSendFollowUp = true;
            } else if (newLeadCandidates.length > 0) {
                shouldSendFollowUp = false;
            } else {
                // No candidates available right now - advance time
                currentTime = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000);
                currentTime = findNextValidSendTime(currentTime);
                continue;
            }

            if (shouldSendFollowUp && followUpCandidates.length > 0) {
                candidateToSend = followUpCandidates[0];
                isFollowUp = true;
            } else if (newLeadCandidates.length > 0) {
                candidateToSend = newLeadCandidates[0];
                isFollowUp = false;
            }

            if (!candidateToSend) {
                // Advance time
                currentTime = new Date(currentTime.getTime() + intervalMinutes * 60 * 1000);
                currentTime = findNextValidSendTime(currentTime);
                continue;
            }

            // Schedule this email
            const nextStep = candidateToSend.currentStep + 1;
            const scheduledAt = findNextValidSendTime(currentTime);

            upcomingTriggers.push({
                campaignId,
                leadId: candidateToSend.leadId,
                leadEmail: candidateToSend.leadEmail,
                sequenceStep: nextStep,
                nextTriggerAt: scheduledAt,
                status: campaign.status,
                timezone: campaign.timezone,
                isFollowUp,
            });

            // Update lead state
            candidateToSend.currentStep = nextStep;
            candidateToSend.lastSentAt = scheduledAt;

            emailsSentToday++;

            // Advance time for next email
            currentTime = new Date(scheduledAt.getTime() + intervalMinutes * 60 * 1000);
            currentTime = findNextValidSendTime(currentTime);
        }

        // Sort by time
        upcomingTriggers.sort((a, b) => a.nextTriggerAt.getTime() - b.nextTriggerAt.getTime());

        const total = upcomingTriggers.length;
        const paginatedLogs = upcomingTriggers.slice(offset, offset + limit);

        return {
            logs: paginatedLogs,
            total,
            limit,
            offset,
        };
    }
}
