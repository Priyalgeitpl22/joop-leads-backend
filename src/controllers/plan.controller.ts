import { Request, Response } from 'express';
import { PrismaClient, PlanCode, Plan } from '@prisma/client';

const prisma = new PrismaClient();

export const getPlans = async (req: Request, res: Response): Promise<any> => {
  try {
    const plans = await prisma.plan.findMany();

    if (!plans) {
      return res.status(404).json({ code: 404, message: 'No plans found' });
    }

    const formattedPlans = plans.map(formatPlanResponse);
    res.status(200).json({ code: 200, message: 'Plans fetched successfully', data: formattedPlans });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: 'Failed to fetch plans successfully' });
  }
};

export const getPlanByCode = async (req: Request, res: Response): Promise<any> => {
  try {
    const { code } = req.params;
    const plan = await prisma.plan.findUnique({ where: { code: code as PlanCode } });
    res.status(200).json({ code: 200, message: 'Plan fetched successfully', data: plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: 'Failed to fetch plan' });
  }
};

const formatPlanResponse = (plan: Plan) => {
  return {
    id: plan.id,
    name: plan.name,
    code: plan.code,
    description: plan.description,
    priceUsd: plan.priceUsd,
    offer: plan.offer,
    features: {
      includeEmailVerification: plan.includeEmailVerification,
      includeEmailWarmup: plan.includeEmailWarmup,
      includeUnifiedInbox: plan.includeUnifiedInbox,
      includeTeammates: plan.includeTeammates,
      includeAiCampaignGen: plan.includeAiCampaignGen,
      includeAiTagging: plan.includeAiTagging,
      includeAiResponses: plan.includeAiResponses,
      includeAiImprovement: plan.includeAiImprovement,
      includeWebsiteLinkWarmup: plan.includeWebsiteLinkWarmup,
      supportType: plan.supportType,
      maxSenderAccounts: plan.maxSenderAccounts,
      maxLeadListPerMonth: plan.maxLeadListPerMonth,
      maxEmailsPerMonth: plan.maxEmailsPerMonth,
      maxLiveCampaigns: plan.maxLiveCampaigns,
    },
    featureNames: [
      {key: 'includeEmailVerification', name: 'Email Verification', value: plan.includeEmailVerification},
      {key: 'includeEmailWarmup', name: 'Email Warmup', value: plan.includeEmailWarmup},
      {key: 'includeUnifiedInbox', name: 'Unified Inbox', value: plan.includeUnifiedInbox},
      {key: 'includeTeammates', name: 'Teammates', value: plan.includeTeammates},
      {key: 'includeAiCampaignGen', name: 'AI Campaign Gen', value: plan.includeAiCampaignGen},
      {key: 'includeAiTagging', name: 'AI Tagging', value: plan.includeAiTagging},
      {key: 'includeAiResponses', name: 'AI Responses', value: plan.includeAiResponses},
      {key: 'includeAiImprovement', name: 'AI Improvement', value: plan.includeAiImprovement},
      {key: 'includeWebsiteLinkWarmup', name: 'Website Link Warmup', value: plan.includeWebsiteLinkWarmup},
      {key: 'supportType', name: 'Support Type', value: plan.supportType},
      {key: 'maxSenderAccounts', name: 'Max Sender Accounts', value: plan.maxSenderAccounts},
      {key: 'maxLeadListPerMonth', name: 'Max Lead List Per Month', value: plan.maxLeadListPerMonth},
      {key: 'maxEmailsPerMonth', name: 'Max Emails Per Month', value: plan.maxEmailsPerMonth},
      {key: 'maxLiveCampaigns', name: 'Max Live Campaigns', value: plan.maxLiveCampaigns},
    ],
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
};