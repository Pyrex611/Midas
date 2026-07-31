import serverless from 'serverless-http';
import app from '../server/app';

export default serverless(app);