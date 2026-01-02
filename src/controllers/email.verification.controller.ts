import { Request, Response } from 'express';
import { EmailVerificationService } from '../services/email.verification.service';
import * as XLSX from 'xlsx';

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
        if (typeof cell === 'string') {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cell.trim());
        }
        return false;
      });

    if (emails.length === 0) {
      res.status(400).json({
        code: 400,
        message: 'No valid emails found in the file',
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

    res.status(201).json({
      code: 201,
      message: 'Batch created successfully',
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

export const submitBatch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const batch = await EmailVerificationService.submitBatchForVerification(
      batchId,
      user.orgId
    );

    res.status(200).json({
      code: 200,
      message: 'Batch submitted for verification',
      data: batch,
    });
  } catch (error: any) {
    console.error('Submit error:', error);
    res.status(500).json({
      code: 500,
      message: error.message || 'Failed to submit batch',
    });
  }
};

export const processResults = async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params;
    const user = req.user;

    if (!user?.orgId) {
      res.status(400).json({ code: 400, message: 'Organization ID is required' });
      return;
    }

    const batch = await EmailVerificationService.processVerificationResults(
      batchId,
      user.orgId
    );

    res.status(200).json({
      code: 200,
      message: 'Verification results processed successfully',
      data: batch,
    });
  } catch (error: any) {
    console.error('Process error:', error);
    res.status(500).json({
      code: 500,
      message: error.message || 'Failed to process results',
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

    const batches = await EmailVerificationService.getBatchesByOrg(user.orgId);

    res.status(200).json({
      code: 200,
      data: batches,
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
      'Is Disposable': e.isDisposable ? 'Yes' : 'No',
      'Is Role Account': e.isRoleAccount ? 'Yes' : 'No',
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
      Reason: e.isDisposable
        ? 'Disposable'
        : e.isDisabled
        ? 'Disabled'
        : e.hasInboxFull
        ? 'Inbox Full'
        : e.status || 'Other',
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