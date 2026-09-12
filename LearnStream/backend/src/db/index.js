import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import { env } from "../config/env.js";


const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${env.mongodbUri}/${DB_NAME}`)
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1)
    }
}

export default connectDB