import dotenv from 'dotenv';

dotenv.config();

export const config = {
    port : process.env.PORT || 5000,
    mongoDBURI : process.env.MONGODB_URI || 'mongodb://localhost:27017/expense-splitter',
    SECRET_KEY : process.env.SECRET_KEY || 'Temp-Secret-Key'
}