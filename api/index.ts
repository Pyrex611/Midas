import app from '../server/app';

// Export Express app directly as the Vercel Serverless Function entry point.
// Vercel's Node.js runtime natively invokes (req, res) listeners.
// Wrapping with serverless-http was preventing res.end() from closing the socket.
export default app;