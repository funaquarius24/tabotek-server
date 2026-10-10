import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { app } from './app.js';

const PORT = parseInt(process.env.PORT || '4000', 10);

// Vercel invokes the exported Express app directly. Keep the listener for
// local and traditional Node deployments, but do not start it in a function.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}

export default app;
