import { getIO } from "./socket.server";

export function emitCampaignEvent(
  campaignId: string,
  event: "ACTIVATED" | "COMPLETED" | "STOPPED",
  payload?: any
) {
  const io = getIO();

  const eventMap = {
    ACTIVATED: "campaign:activated",
    COMPLETED: "campaign:completed",
    STOPPED: "campaign:stopped",
  };

  io.to(`campaign:${campaignId}`).emit(eventMap[event], payload);

  console.log(`📡 ${event} emitted for ${campaignId}`);
}