import { SenderAccountService } from "../services/sender.account.service";
import { Request, Response } from "express";

export const addSenderAccount = async (req: Request, res: Response) => {
    const data = req.body;
    const senderAccount = await SenderAccountService.createSenderAccount(data);
    res.status(201).json({ code: 201, message: "Sender account created successfully", data: senderAccount });
}

export const getSenderAccounts = async (req: Request, res: Response) => {
    const { orgId } = req.params;
    const senderAccounts = await SenderAccountService.getSenderAccounts(orgId);
    res.status(200).json({ code: 200, message: "Sender accounts fetched successfully", data: senderAccounts });
}

export const getSenderAccountById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const email = String(req.query.email);
    const senderAccount = await SenderAccountService.getSenderAccount(id, email);
    res.status(200).json({ code: 200, message: "Sender account fetched successfully", data: senderAccount });
}

export const updateSenderAccount = async (req: Request, res: Response) => {
    const { id } = req.params;
    const data = req.body;
    const senderAccount = await SenderAccountService.updateSenderAccount(id, data);
    res.status(200).json({ code: 200, message: "Sender account updated successfully", data: senderAccount });
}

export const deleteSenderAccount = async (req: Request, res: Response) => {
    const { id } = req.params;
    const senderAccount = await SenderAccountService.deleteSenderAccount(id);
    res.status(200).json({ code: 200, message: "Sender account deleted successfully", data: senderAccount });
}