import { Router } from 'express';
import multer from 'multer';
import {
  uploadAndCreateBatch,
  submitBatch,
  processResults,
  getAllBatches,
  getBatchDetails,
  getBatchStatistics,
  getVerifiedEmails,
  getUnverifiedEmails,
  exportVerifiedEmails,
  exportUnverifiedEmails,
  deleteBatch,
} from '../controllers/email.verification.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel and CSV files are allowed.'));
    }
  },
});

router.get('/batches', getAllBatches);

router.post('/upload', upload.single('file'), uploadAndCreateBatch);

router.post('/:batchId/submit', submitBatch);

router.post('/:batchId/process', processResults);

router.get('/:batchId', getBatchDetails);

router.get('/:batchId/statistics', getBatchStatistics);

router.get('/:batchId/verified', getVerifiedEmails);

router.get('/:batchId/unverified', getUnverifiedEmails);

router.get('/:batchId/export/verified', exportVerifiedEmails);

router.get('/:batchId/export/unverified', exportUnverifiedEmails);

router.delete('/:batchId', deleteBatch);

export default router;