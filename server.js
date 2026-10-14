import express from 'express';
import { configureApp } from './project-api.js';
import { db } from './database.js';
const app = express();
configureApp(app, db);
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Open http://localhost:${port}`));
