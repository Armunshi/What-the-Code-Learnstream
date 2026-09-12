import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import { env } from "../config/env.js";

// Imported for their side effect: each module registers a schema with
// mongoose. Splitting courses.js into three files (BACKEND_AUDIT.md §4.5)
// removed an accident that used to protect us — importing any one of
// Courses/Lectures/Assignments registered all three, so a `.populate()` always
// found the model it needed. Now a file that imports only course.model.js
// leaves "Lectures" unregistered, and the populate fails at runtime with a
// MissingSchemaError far from the cause. Registering every model here, once,
// before the first query can run, removes the whole class of failure.
import "../models/assignment.model.js";
import "../models/cart.model.js";
import "../models/course.model.js";
import "../models/lecture.model.js";
import "../models/module.model.js";
import "../models/order.model.js";
import "../models/progress.model.js";
import "../models/user/userstudentmodel.js";
import "../models/user/userteachermodel.js";

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
