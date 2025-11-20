import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import route from './routes/route';
import { errorHandler } from './utils/errorHandler';

const app = express();

app.use(express.json());
app.use(cors());


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/lists', route);

app.use(errorHandler);


export default app;
