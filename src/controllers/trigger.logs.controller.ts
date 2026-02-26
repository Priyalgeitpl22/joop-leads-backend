import { Request, Response } from "express";
import { TriggerLogService } from "../services/trigger.log.service";

export const getTriggerLogs = async (req: Request, res: Response) => {
    try {
        const response = await TriggerLogService.getTriggerLogs(req.params.campaignId as any);
        res.status(200).json({ code: 200, message: "Trigger logs fetched successfully", data: response });
    } catch (err: any) {
        res.status(500).json({ code: 500, message: "Failed to fetch trigger logs", error: err.message });
    }
};

export const getUpcomingTriggers = async (req: Request, res: Response) => {
    try {
        const response = await TriggerLogService.getUpcomingTriggers(req.params.campaignId as any);
        res.status(200).json({ code: 200, message: "Upcoming trigger fetched successfully", data: response });
    } catch (err: any) {
        res.status(500).json({ code: 500, message: "Failed to fetch upcoming trigger", error: err.message });
    }
};