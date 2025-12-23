import { PrismaClient } from "@prisma/client";
import { dayjs } from "../utils/date";

const prisma = new PrismaClient();

interface UpcomingTrigger {
    campaignId: string;
    nextTriggerAt: Date;
    status: string;
    timezone: string;
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
     * Calculates all upcoming email triggers for each lead across all sequences
     * @param campaignId - The campaign ID
     * @param limit - Number of upcoming triggers to return (default 50)
     * @param offset - Offset for pagination (default 0)
     */
    static async getUpcomingTriggers(campaignId: string, limit = 5, offset = 0) {
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

        const { timezone, intervalMinutes, maxEmailsPerDay, sendDays, windowStart, windowEnd } = campaign;
        const sequences = campaign.sequences;
        const pendingLeads = campaign.leads;

        if (pendingLeads.length === 0) {
            return { logs: [], total: 0, limit, offset };
        }

        if (sequences.length === 0) {
            return { logs: [], total: 0, limit, offset };
        }

        // Build a map of sequence delays (cumulative from sequence 1)
        const sequenceDelays = new Map<number, number>(); // seqNumber -> cumulative delay in minutes
        let cumulativeDelayMinutes = 0;
        for (const seq of sequences) {
            const seqDelayMinutes =
                seq.delayDays * 24 * 60 + seq.delayHours * 60 + seq.delayMinutes;
            cumulativeDelayMinutes += seqDelayMinutes;
            sequenceDelays.set(seq.seqNumber, cumulativeDelayMinutes);
        }

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

                let startOfWindow = checkDate.hour(startHour).minute(startMin).second(0);
                const endOfWindow = checkDate.hour(endHour).minute(endMin).second(0);

                // If same day and we're past window start, use the original time (if within window)
                if (dayOffset === 0) {
                    if (candidateTime.isAfter(endOfWindow)) {
                        // Past today's window, try next day
                        continue;
                    }
                    if (candidateTime.isBefore(startOfWindow)) {
                        // Before window, use window start
                        return startOfWindow.toDate();
                    }
                    // Within window
                    return candidateTime.toDate();
                }

                // For future days, use window start
                return startOfWindow.toDate();
            }

            // Fallback: return original time if no valid slot found in 14 days
            return fromTime;
        };

        const upcomingTriggers: UpcomingTrigger[] = [];
        let currentTriggerTime = new Date(runtime.nextRunAt);
        let emailsScheduledToday = 0;
        let currentDay = dayjs(currentTriggerTime).tz(timezone).format("YYYY-MM-DD");

        // For each lead, calculate when they will receive each remaining sequence
        for (const campaignLead of pendingLeads) {
            const lead = campaignLead.lead;
            if (!lead) continue;

            const currentStep = campaignLead.currentSequenceStep; // 0 = not started

            // Find all sequences this lead still needs
            const remainingSequences = sequences.filter((s) => s.seqNumber > currentStep);

            for (const seq of remainingSequences) {
                // Calculate the base time for this sequence
                let baseTime: Date;

                if (seq.seqNumber === currentStep + 1) {
                    // Next sequence - use current trigger slot
                    baseTime = new Date(currentTriggerTime);
                } else {
                    // Future sequence - calculate delay from last sent or first sequence
                    const delayFromFirstSeq = sequenceDelays.get(seq.seqNumber) || 0;
                    const prevSeqDelay = sequenceDelays.get(currentStep + 1) || 0;
                    const additionalDelay = delayFromFirstSeq - prevSeqDelay;

                    // Base time is the time of the first remaining sequence + additional delay
                    baseTime = dayjs(currentTriggerTime)
                        .add(additionalDelay, "minute")
                        .toDate();
                }

                // Find the next valid send time considering schedule
                const scheduledAt = findNextValidSendTime(baseTime);
                const scheduledMoment = dayjs(scheduledAt).tz(timezone);

                // Check daily limit
                const scheduleDay = scheduledMoment.format("YYYY-MM-DD");
                if (scheduleDay !== currentDay) {
                    emailsScheduledToday = 0;
                    currentDay = scheduleDay;
                }

                if (emailsScheduledToday >= maxEmailsPerDay) {
                    // Move to next day's window start
                    const nextDay = scheduledMoment.add(1, "day");
                    const [startHour, startMin] = windowStart.split(":").map(Number);
                    const adjustedTime = findNextValidSendTime(
                        nextDay.hour(startHour).minute(startMin).toDate()
                    );
                    emailsScheduledToday = 0;
                    currentDay = dayjs(adjustedTime).tz(timezone).format("YYYY-MM-DD");
                }

                upcomingTriggers.push({
                    campaignId,
                    nextTriggerAt: scheduledAt,
                    status: campaign.status,
                    timezone: campaign.timezone,
                });

                emailsScheduledToday++;

                // Move trigger time forward for next lead's same sequence
                if (seq.seqNumber === currentStep + 1) {
                    currentTriggerTime = new Date(
                        currentTriggerTime.getTime() + intervalMinutes * 60 * 1000
                    );
                }
            }
        }

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
