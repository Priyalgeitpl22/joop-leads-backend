import { Request, Response } from 'express';
import { EmailVerificationService } from '../services/email.verification.service';
import * as XLSX from 'xlsx';
import { getPresignedUrl, uploadCSVToS3 } from '../aws/imageUtils';
import * as OrganizationAddOnService from '../services/organization.addon.service';

export const uploadAndCreateBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({
        code: 400,
        message: 'No file uploaded',
      });
      return;
    }

    const user = req.user;
    if (!user?.orgId) {
      res.status(400).json({
        code: 400,
        message: 'Organization ID is required',
      });
      return;
    }

    const { batchName } = req.body;

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][];

    const emails = data
    .flat()
    .filter(cell => {
      if (typeof cell !== 'string') return false;

      const email = cell.trim();
      const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const noDoubleDots = !email.includes('..');
      
      const noEdgeDots = !(
        email.startsWith('.') ||
        email.endsWith('.') ||
        email.includes('@.') ||
        email.includes('.@')
      );

      return (
        basicEmailRegex.test(email) &&
        noDoubleDots &&
        noEdgeDots
      );
    });


    if (emails.length === 0) {
      res.status(400).json({
        code: 400,
        message: 'No valid emails found in the file',
      });
      return;
    }
    const reoonCredits = await EmailVerificationService.checkReoonCredits();
    console.log('Reoon credits:', reoonCredits);
    if (reoonCredits?.remaining_instant_credits < emails.length) {
      res.status(400).json({
        code: 400,
        message: `Insufficient reoon credits.`,
      });
      return;
    }

    const emailVerificationCredits = await OrganizationAddOnService.getEmailVerificationCredits(user.orgId);

    if (emailVerificationCredits <= emails.length) {
      res.status(400).json({
        code: 400,
        message: "Insufficient email verification credits",
      });
      return;
    }
    const batch = await EmailVerificationService.createBatch({
      name: batchName || `Batch ${new Date().toISOString()}`,
      fileName: req.file.originalname,
      emails,
      orgId: user.orgId,
      uploadedById: user.id,
    });

    const csvUploaded = await uploadCSVToS3(`email_batches/${batch.id}`, req.file)
    console.log('CSV uploaded to S3:', csvUploaded);

    await EmailVerificationService.submitBatchForVerification(
      batch.id,
      user.orgId,
      csvUploaded
    );

    res.status(201).json({
      code: 201,
      message: 'Batch submitted for verification',
      data: {
        batchId: batch.id,
        name: batch.name,
        totalEmails: batch.totalEmails,
        fileName: batch.fileName,
        status: batch.status,
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to upload and create batch',
      error: error.message,
    });
  }
};

export const getAllBatches = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const result = await EmailVerificationService.getBatchesByOrg(user.orgId, page, limit);

    res.status(200).json({
      code: 200,
      data: result,
    });
  } catch (error: any) {
    console.error('Fetch batches error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to fetch batches',
    });
  }
};

export const getBatchDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const batch = await EmailVerificationService.getBatchById(batchId, user.orgId);

    if (!batch) {
      res.status(404).json({
        code: 404,
        message: 'Batch not found',
      });
      return;
    }

    res.status(200).json({
      code: 200,
      data: batch,
    });
  } catch (error: any) {
    console.error('Fetch batch error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to fetch batch details',
    });
  }
};

export const getBatchStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const stats = await EmailVerificationService.getBatchStatistics(batchId, user.orgId);

    res.status(200).json({
      code: 200,
      data: stats,
    });
  } catch (error: any) {
    console.error('Statistics error:', error);
    res.status(500).json({
      code: 500,
      message: error.message || 'Failed to fetch statistics',
    });
  }
};

export const getVerifiedEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const emails = await EmailVerificationService.getVerifiedEmails(batchId, user.orgId);

    res.status(200).json({
      code: 200,
      data: {
        count: emails.length,
        emails,
      },
    });
  } catch (error: any) {
    console.error('Fetch verified emails error:', error);
    res.status(500).json({
      code: 500,
      message: error.message || 'Failed to fetch verified emails',
    });
  }
};

export const getUnverifiedEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const emails = await EmailVerificationService.getUnverifiedEmails(batchId, user.orgId);

    res.status(200).json({
      code: 200,
      data: {
        count: emails.length,
        emails,
      },
    });
  } catch (error: any) {
    console.error('Fetch unverified emails error:', error);
    res.status(500).json({
      code: 500,
      message: error.message || 'Failed to fetch unverified emails',
    });
  }
};

export const exportVerifiedEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const emails = await EmailVerificationService.getVerifiedEmails(batchId, user.orgId);

    const workbook = XLSX.utils.book_new();
    const worksheetData = emails.map(e => ({
      Email: e.email,
      Status: e.status,
      Username: e.username,
      Domain: e.domain,
      'Safe to Send': e.isSafeToSend ? 'Yes' : 'No',
      'Deliverable': e.isDeliverable ? 'Yes' : 'No',
      'Verified At': e.createdAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Verified Emails');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=verified-emails-${batchId}.xlsx`
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.send(buffer);
  } catch (error: any) {
    console.error('Export verified error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to export verified emails',
    });
  }
};

export const getBatchResultDownloadUrl = async ( req: Request, res: Response ): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user = req.user;

    if (!batchId) {
      res.status(400).json({ message: "Batch ID required" });
      return;
    }

    if (!user?.orgId) {
      res.status(400).json({ message: "Organization ID required" });
      return;
    }

    const batch =await EmailVerificationService.getBatchVerificationResultKey(
        batchId,
        user.orgId
      );

    if (!batch?.csvResultFile) {
      res.status(404).json({ message: "Result file not found" });
      return;
    }

    const url = await getPresignedUrl(batch.csvResultFile);

    res.status(200).json({
      success: true,
      downloadUrl: url,
    });
  } catch (error) {
    console.error("Download URL error:", error);
    res.status(500).json({
      message: "Failed to generate download URL",
    });
  }
};

export const exportUnverifiedEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const emails = await EmailVerificationService.getUnverifiedEmails(batchId, user.orgId);

    const workbook = XLSX.utils.book_new();
    const worksheetData = emails.map(e => ({
      Email: e.email,
      Status: e.status,
      Username: e.username,
      Domain: e.domain,
      Reason: e.status || 'Other',
      'Verified At': e.createdAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Unverified Emails');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Disposition',
      `attachment; filename=unverified-emails-${batchId}.xlsx`
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.send(buffer);
  } catch (error: any) {
    console.error('Export unverified error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to export unverified emails',
    });
  }
};

export const deleteBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    await EmailVerificationService.deleteBatch(batchId, user.orgId);

    res.status(200).json({
      code: 200,
      message: 'Batch deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete batch error:', error);
    res.status(500).json({
      code: 500,
      message: error.message || 'Failed to delete batch',
    });
  }
};

export const verifyEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const { emails, mode = 'power' } = req.body;

    if (!emails || typeof emails !== 'string') {
      res.status(400).json({
        code: 400,
        message: 'Emails are required (comma-separated string)',
      });
      return;
    }

    if (mode !== 'quick' && mode !== 'power') {
      res.status(400).json({
        code: 400,
        message: 'Mode must be either "quick" or "power"',
      });
      return;
    }
    
    const result = await EmailVerificationService.verifyEmails(
      emails,
      user.orgId,
      user.id,
      mode
    );

    const response: any = {
      code: 200,
      message: 'Email verification completed',
      data: {
        verified: result.verified,
        verifiedCount: result.verified.length,
      },
    };

    // Include failed emails if any
    if (result.failed.length > 0) {
      response.data.failed = result.failed;
      response.data.failedCount = result.failed.length;
      response.message = `Verified ${result.verified.length} email(s), ${result.failed.length} failed`;
    }

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Verify emails error:', error);
    res.status(500).json({
      code: 500,
      message: error.message || 'Failed to verify emails',
    });
  }
};

export const getEmails = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const verifications = await EmailVerificationService.getVerificationHistory(
      user.orgId,
      limit,
      offset
    );

    res.status(200).json({
      code: 200,
      data: verifications,
    });
  } catch (error: any) {
    console.error('Get history error:', error);
    res.status(500).json({
      code: 500,
      message: 'Failed to fetch verification history',
    });
  }
};