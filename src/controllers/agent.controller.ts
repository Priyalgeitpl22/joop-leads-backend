import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateRandomPassword } from '../utils/otp.utils';
import multer from "multer";

const prisma = new PrismaClient();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const upload = multer({ storage: storage });

export const createAgent = async (req: Request, res: Response): Promise<any> => {
    try {
        upload.single("profilePicture")(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ code: 400, message: "Error uploading file", error: err.message });
            }

            const { email, fullName, phone, orgId } = req.body;
            const profilePicture = req.file ? req.file.path : null;

            if (!email || !fullName || !phone || !orgId) {
                return res.status(400).json({
                    code: 400,
                    message: "All fields (email, fullName, phone, orgId) are required."
                });
            }

            const defaultPassword = generateRandomPassword(8);

            const agent = await prisma.user.create({
                data: {
                    email,
                    fullName,
                    role: 'Agent',
                    orgId,
                    password: defaultPassword,
                    profilePicture,
                },
                select: { fullName: true, email: true, id: true, role: true, orgId: true, profilePicture: true, password: true }
            });

            res.status(200).json({
                code: 200,
                data: agent,
                message: "Agent created successfully",
            });
        });

    } catch (err) {
        console.error('Error saving agent:', err);
        res.status(500).json({
            code: 500,
            message: "Error saving agent",
        });
    }
};

export const getAgents = async (req: Request, res: Response): Promise<void> => {
    try {
        const { orgId } = req.params;

        if (!orgId) {
            res.status(400).json({ code: 400, message: "orgId is required" });
        }

        const agent = await prisma.user.findMany({
            where: { orgId: orgId as string, role: 'Agent' },
            select: { fullName: true, email: true, id: true, role: true, orgId: true, profilePicture: true }
        });

        if (!agent) {
            res.status(404).json({ code: 404, message: "Agent not found" });
        }

        res.status(200).json({
            data: agent,
            message: "Agent details fetched successfully",
            code: 200
        });

    } catch (err) {
        console.error("Error fetching agent details:", err);
        res.status(500).json({ code: 500, message: "Error fetching agent details" });
    }
};

export const getAgent = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ code: 400, message: "agent id is required" });
        }

        const agent = await prisma.user.findFirst({
            where: { id: id as string, role: 'Agent' },
            select: { fullName: true, email: true, id: true, role: true, orgId: true, profilePicture: true }
        });

        if (!agent) {
            res.status(404).json({ code: 404, message: "Agent not found" });
        }

        res.status(200).json({
            data: agent,
            message: "Agent details fetched successfully",
            code: 200
        });

    } catch (err) {
        console.error("Error fetching agent details:", err);
        res.status(500).json({ code: 500, message: "Error fetching agent details" });
    }
};

// export const updateAgent = async (req: Request, res: Response): Promise<void> => {
//     try {
//         upload.single("profilePicture")(req, res, async (err) => {
//             if (err) {
//                 return res.status(400).json({ code: 400, message: "Error uploading file", error: err.message });
//             }

//             const { id } = req.params;
//             const { fullName, phone, email } = req.body;
//             const profilePicture = req.file ? req.file.path : undefined; // Only update if a new file is uploaded

//             if (!id) {
//                 return res.status(400).json({ code: 400, message: "Agent ID is required." });
//             }

//             // Find existing agent
//             const existingAgent = await prisma.user.findFirst({
//                 where: { id, role: "Agent" }
//             });

//             if (!existingAgent) {
//                 return res.status(404).json({ code: 404, message: "Agent not found" });
//             }

//             // Update agent details
//             const updatedAgent = await prisma.user.update({
//                 where: { id },
//                 data: {
//                     fullName: fullName || existingAgent.fullName,
//                     phone: phone || existingAgent.phone,
//                     email: email || existingAgent.email,
//                     profilePicture: profilePicture || existingAgent.profilePicture,
//                 },
//                 select: { id: true, fullName: true, phone: true, email: true, profilePicture: true, role: true, orgId: true }
//             });

//             res.status(200).json({
//                 code: 200,
//                 data: updatedAgent,
//                 message: "Agent updated successfully",
//             });
//         });
//     } catch (err) {
//         console.error("Error updating agent:", err);
//         res.status(500).json({ code: 500, message: "Error updating agent" });
//     }
// };

