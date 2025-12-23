import { Request, Response } from "express";
import { TrackingService } from "../services/tracking.service";

export const trackEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { trackingId, type } = req.params;
    const { redirect } = req.query;

    const response = await TrackingService.trackEvent(trackingId, type, redirect as string);

    if (response.type === "image" && response.imagePath) {
      res.setHeader("Content-Type", "image/png");
      res.sendFile(response.imagePath);
      return;
    }

    if (response.type === "redirect" && response.redirectUrl) {
      res.redirect(response.redirectUrl);
      return;
    }

    res.status(response.code).json({ message: response.message });
  } catch (error: any) {
    console.error("Error tracking event:", error.message);
    res.status(500).json({ message: "Error tracking event", details: error.message });
  }
};

export const getAllThreadFormEmailId = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.params;
    const response = await TrackingService.getAllThreadsFromEmail(email);
    res.status(response.code).json(response);
  } catch (err: any) {
    console.error("Error getting data from email:", err.message);
    res.status(500).json({ code: 500, message: "Error getting data from email", details: err.message });
  }
};
