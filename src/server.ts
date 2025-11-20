import app from './app';
import { connectDatabase } from './config/database';
import { config } from './config/environment';

connectDatabase().then(() => {
  app.listen(config.port, () => {
    console.log(`Server started on: http://localhost:${config.port}`);
  });
});