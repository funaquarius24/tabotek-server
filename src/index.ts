import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { app } from './app.js';

const PORT = parseInt(process.env.PORT || '4000', 10);

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
