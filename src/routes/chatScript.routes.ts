import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { Request, Response } from "express";

const router = Router();
const prisma = new PrismaClient();

router.get("/", async (req: Request, res: Response): Promise<any> => {
    try {
        const config = await prisma.chatConfig.findFirst();

        if (!config) {
            res.setHeader("Content-Type", "application/javascript");
            return res.send("console.error('Chat widget configuration not found');");
        }

        res.setHeader("Content-Type", "application/javascript");

        const allowFileUpload = config.allowFileUpload ? "true" : "false";
        const allowEmojis = config.allowEmojis ? "true" : "false";
        const availability = config.availability ? "true" : "false";

        res.send(`
            (function () {
                var chatWidgetScript = document.createElement("script");
                chatWidgetScript.src = "http://localhost:5003/api/chat-widget-core.js"; 
                chatWidgetScript.onload = function () {
                    if (typeof ChatWidget !== "undefined") {
                        ChatWidget.init({
                            elementId: "chat-widget",
                            allowFileUpload: ${allowFileUpload},
                            allowEmojis: ${allowEmojis},
                            position: "${config.position || "bottom-right"}",
                            iconColor: "${config.iconColor || "#56a2ed"}",
                            chatWindowColor: "${config.chatWindowColor || "#ffffff"}",
                            fontColor: "${config.fontColor || "#000000"}",
                            availability: ${availability},
                            socketServer: "${config.socketServer || "http://localhost:5003"}"
                        });
                    } else {
                        console.error("ChatWidget is not defined.");
                    }
                };
                document.body.appendChild(chatWidgetScript);
            })();
        `);
    } catch (err) {
        console.error("Error generating chat widget script:", err);
        res.setHeader("Content-Type", "application/javascript");
        res.send("console.error('Error loading chat widget');");
    }
});

export default router;