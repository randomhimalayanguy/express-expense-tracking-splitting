import app from './app';
import { connectDatabase } from './config/database';
import { config } from './config/environment';

console.log('MongoDB URI:', config.mongoDBURI);

connectDatabase().then(() => {
  app.listen(config.port, () => {
    console.log(`Server started`);
  });
});