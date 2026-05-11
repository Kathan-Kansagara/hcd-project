import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth.routes.js';
import farmerRoutes from './routes/farmer.routes.js';
import productRoutes from './routes/product.routes.js';
import batchRoutes from './routes/batch.routes.js';
import trialRoutes from './routes/trial.routes.js';
import applicationRoutes from './routes/application.routes.js';
import photoRoutes from './routes/photo.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import userRoutes from './routes/user.routes.js';
import profileRoutes from './routes/profile.routes.js';
import rawMaterialRoutes from './routes/raw-material.routes.js';
import rawMaterialBatchRoutes from './routes/raw-material-batch.routes.js';
import bomRoutes from './routes/bom.routes.js';
import productionRoutes from './routes/production.routes.js';
import companySettingsRoutes from './routes/company-settings.routes.js';
import customerRoutes from './routes/customer.routes.js';
import supplierRoutes from './routes/supplier.routes.js';
import purchaseOrderRoutes from './routes/purchase-order.routes.js';
import salesOrderRoutes from './routes/sales-order.routes.js';
import deliveryNoteRoutes from './routes/delivery-note.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import pricingRuleRoutes from './routes/pricing-rule.routes.js';
import locationRoutes from './routes/location.routes.js';
import stockMovementRoutes from './routes/stock-movement.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import logger from './config/logger.js';
import { execSync } from 'child_process';

dotenv.config();

// Run database migrations on startup in production
async function runMigrations() {
  if (process.env.NODE_ENV === 'production') {
    try {
      logger.info('🗄️ Running database migrations...');
      execSync('npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma', {
        stdio: 'inherit',
        cwd: '/app'
      });
      logger.info('✅ Database migrations completed');
    } catch (error) {
      logger.error('❌ Migration failed:', error);
      // Don't crash the server if migrations fail - it might already be up to date
      logger.warn('⚠️ Server will start anyway. Run migrations manually if needed.');
    }
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://localhost:4173'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 20 : 100, // stricter in production
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Zenon CropTrial API is running' });
});

// Serve static files from uploads directory
// NOTE: Uploads are served without auth because <img> tags cannot send Authorization headers.
// For production, consider using signed URLs or a proxy endpoint with token-based auth.
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// API routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/farmers', farmerRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/batches', batchRoutes);
app.use('/api/v1/trials', trialRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1', photoRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/raw-materials', rawMaterialRoutes);
app.use('/api/v1/raw-material-batches', rawMaterialBatchRoutes);
app.use('/api/v1/bom', bomRoutes);
app.use('/api/v1/production', productionRoutes);
app.use('/api/v1/company-settings', companySettingsRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/suppliers', supplierRoutes);
app.use('/api/v1/purchase-orders', purchaseOrderRoutes);
app.use('/api/v1/sales-orders', salesOrderRoutes);
app.use('/api/v1/delivery-notes', deliveryNoteRoutes);
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/pricing-rules', pricingRuleRoutes);
app.use('/api/v1/location', locationRoutes);
app.use('/api/v1/locations', locationRoutes); // plural alias for consistency
app.use('/api/v1/stock-movements', stockMovementRoutes);

// Error handlers (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server with migrations
async function startServer() {
  try {
    // Run migrations first
    await runMigrations();

    // Then start the server
    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Server running on http://localhost:${PORT}`);
      if (process.env.NODE_ENV !== 'production') {
        logger.info(`🌐 Network: http://192.168.29.247:${PORT}`);
      }
      logger.info(`📍 API endpoints: http://localhost:${PORT}/api/v1`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
