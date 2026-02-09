import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.ts';
import walletRouter from './routes/wallet.ts';
import ghostpassRouter from './routes/ghostpass.ts';
import entryTrackingRouter from './routes/entry_tracking.ts';
import scanRouter from './routes/scan.ts';
import ghostPassEntryManagementRouter from './routes/ghost_pass_entry_management.ts';
import walletAccessRouter from './routes/wallet_access.ts';

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Configure for production
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['*']
}));

app.use(express.json());

// Routes
app.use('/api/auth', authRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/ghostpass', ghostpassRouter);
app.use('/api/entry-tracking', entryTrackingRouter);
app.use('/api/scan', scanRouter);
app.use('/api/ghost-pass/entry', ghostPassEntryManagementRouter);
app.use('/api/wallet-access', walletAccessRouter);

// Add more routers as needed

export default app;