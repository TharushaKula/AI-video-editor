import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import connectDB from './config/db';

dotenv.config();

connectDB();

import http from 'http';
import { initSocket } from './services/socketService';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

import uploadRoutes from './routes/upload';
import statusRoutes from './routes/status';
import downloadRoutes from './routes/download';
import { initWorker } from './services/worker';

app.use('/api', uploadRoutes);
app.use('/api', statusRoutes);
app.use('/api', downloadRoutes);

app.get('/', (req, res) => {
    res.send('Video Generator API is running');
});

const httpServer = http.createServer(app);
initSocket(httpServer);
initWorker();

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
