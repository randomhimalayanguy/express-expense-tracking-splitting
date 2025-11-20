import mongoose from "mongoose";
import {config} from './environment'

export const connectDatabase = async () =>{
    try{
        await mongoose.connect(config.mongoDBURI);
        console.log(`Database connected`);
    }
    catch(err){
        console.log(`Can't connect to database: ${err}`);
        process.exit(1);
    }
}
// mongoose.connect(mongoDBURI)
// .then(() => {
//   console.log('Database connected');
//   app.listen(port, () => console.log(`Server started on: http://localhost:${port}`));
// })
// .catch((err) => {
  
// });
