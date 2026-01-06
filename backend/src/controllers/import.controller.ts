import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../../uploads/imports');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create user-specific upload directory
    const userId = (req as AuthRequest).user?.userId || 'unknown';
    const userUploadDir = path.join(uploadDir, userId);
    if (!fs.existsSync(userUploadDir)) {
      fs.mkdirSync(userUploadDir, { recursive: true });
    }
    cb(null, userUploadDir);
  },
  filename: (req, file, cb) => {
    // Preserve original filename
    cb(null, file.originalname);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Only accept CSV files
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    cb(null, true);
  } else {
    cb(new Error('Only CSV files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  }
});

export class ImportController {
  /**
   * Upload CSV files for import
   */
  static async uploadFiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No files uploaded' });
        return;
      }

      const uploadedFiles = files.map(file => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size
      }));

      res.json({
        message: 'Files uploaded successfully',
        files: uploadedFiles,
        uploadDir: path.join(uploadDir, req.user.userId)
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Trigger import process with uploaded files
   */
  static async triggerImport(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Only admins can trigger imports
      if (req.user.role !== 'ADMIN') {
        res.status(403).json({ error: 'Only admins can perform imports' });
        return;
      }

      const { tenantId, clearExisting } = req.body;

      if (!tenantId) {
        res.status(400).json({ error: 'Tenant ID is required' });
        return;
      }

      const userId = req.user.userId;
      const importDir = path.join(uploadDir, userId);

      // Verify import directory exists and has files
      if (!fs.existsSync(importDir)) {
        res.status(400).json({ error: 'No files have been uploaded' });
        return;
      }

      const files = fs.readdirSync(importDir);
      if (files.length === 0) {
        res.status(400).json({ error: 'No CSV files found in upload directory' });
        return;
      }

      // Count expected CSV files (Organizations, Contacts, Deals, Activities)
      const expectedFiles = ['Organizations.csv', 'Contacts.csv', 'Deals.csv', 'Activities.csv'];
      const csvFiles = files.filter(f => expectedFiles.includes(f));

      // Create import job record
      const importJob = await prisma.importJob.create({
        data: {
          tenantId,
          userId,
          status: 'PENDING',
          clearExisting: clearExisting || false,
          totalFiles: csvFiles.length > 0 ? csvFiles.length : 4, // Default to 4 if files found
        },
      });

      // Start import process in background
      const isProduction = process.env.NODE_ENV === 'production';
      const scriptPath = path.join(__dirname, '../scripts/run-import.js');

      // Create log file for this import
      const logDir = path.join(__dirname, '../../logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, `import-${importJob.id}.log`);

      try {
        // Open file descriptors for logging
        const logFd = fs.openSync(logFile, 'a');

        const importProcess = isProduction
          ? spawn('node', [scriptPath], {
              cwd: path.join(__dirname, '../..'),
              env: {
                ...process.env,
                TENANT_ID: tenantId,
                ADMIN_USER_ID: userId,
                IMPORT_DIR: importDir,
                IMPORT_JOB_ID: importJob.id,
                CLEAR_EXISTING: clearExisting ? 'true' : 'false',
              },
              detached: true,
              stdio: ['ignore', logFd, logFd]
            })
          : spawn('npx', ['ts-node', scriptPath.replace('.js', '.ts')], {
              cwd: path.join(__dirname, '../..'),
              env: {
                ...process.env,
                TENANT_ID: tenantId,
                ADMIN_USER_ID: userId,
                IMPORT_DIR: importDir,
                IMPORT_JOB_ID: importJob.id,
                CLEAR_EXISTING: clearExisting ? 'true' : 'false',
              },
              detached: true,
              stdio: ['ignore', logFd, logFd]
            });

        // Handle process errors
        importProcess.on('error', async (err) => {
          console.error('Failed to start import process:', err);
          fs.appendFileSync(logFile, `ERROR: Failed to start: ${err.message}\n`);
          await prisma.importJob.update({
            where: { id: importJob.id },
            data: {
              status: 'FAILED',
              errorMessage: `Failed to start import: ${err.message}`,
              completedAt: new Date(),
            },
          });
        });

        // Handle process exit
        importProcess.on('exit', (code, signal) => {
          fs.appendFileSync(logFile, `Process exited with code ${code}, signal ${signal}\n`);
          fs.closeSync(logFd);
        });

        importProcess.unref();

        console.log(`Import job ${importJob.id} started. Logs: ${logFile}`);
      } catch (error: any) {
        // Update job as failed if spawn fails
        fs.appendFileSync(logFile, `ERROR: Failed to spawn: ${error.message}\n`);
        await prisma.importJob.update({
          where: { id: importJob.id },
          data: {
            status: 'FAILED',
            errorMessage: `Failed to spawn import process: ${error.message}`,
            completedAt: new Date(),
          },
        });
        throw error;
      }

      res.json({
        message: 'Import process started',
        importJobId: importJob.id,
        files: files,
        clearExisting: clearExisting || false,
        status: 'Import is running in the background. You can monitor the progress in real-time.'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Clear uploaded files for current user
   */
  static async clearFiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const userId = req.user.userId;
      const userUploadDir = path.join(uploadDir, userId);

      if (fs.existsSync(userUploadDir)) {
        // Delete all files in directory
        const files = fs.readdirSync(userUploadDir);
        for (const file of files) {
          fs.unlinkSync(path.join(userUploadDir, file));
        }

        res.json({ message: 'Files cleared successfully' });
      } else {
        res.json({ message: 'No files to clear' });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get list of uploaded files
   */
  static async listFiles(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const userId = req.user.userId;
      const userUploadDir = path.join(uploadDir, userId);

      if (!fs.existsSync(userUploadDir)) {
        res.json({ files: [] });
        return;
      }

      const files = fs.readdirSync(userUploadDir).map(filename => {
        const filePath = path.join(userUploadDir, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          size: stats.size,
          uploadedAt: stats.mtime
        };
      });

      res.json({ files });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get import job status
   */
  static async getJobStatus(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { jobId } = req.params;

      const job = await prisma.importJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        res.status(404).json({ error: 'Import job not found' });
        return;
      }

      // Verify user has access to this job
      if (job.tenantId !== req.user.tenantId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json({ job });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get import job history for current tenant
   */
  static async getJobHistory(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const jobs = await prisma.importJob.findMany({
        where: { tenantId: req.user.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20, // Last 20 imports
      });

      res.json({ jobs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get import job logs
   */
  static async getJobLogs(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { jobId } = req.params;

      // Verify job exists and belongs to user's tenant
      const job = await prisma.importJob.findUnique({
        where: { id: jobId },
      });

      if (!job) {
        res.status(404).json({ error: 'Import job not found' });
        return;
      }

      if (job.tenantId !== req.user.tenantId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      // Read log file
      const logFile = path.join(__dirname, '../../logs', `import-${jobId}.log`);

      if (!fs.existsSync(logFile)) {
        res.json({ logs: 'No logs available yet' });
        return;
      }

      const logs = fs.readFileSync(logFile, 'utf-8');
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
