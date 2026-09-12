import { env } from "./config/env.js";
import connectDB from "./db/index.js";
import { app } from "./app.js";

connectDB()
    .then(() => {
        // Log the port actually bound, not process.env.PORT — that printed
        // "undefined" whenever the fallback was used (BACKEND_AUDIT.md §4.6).
        app.listen(env.port, () => {
            console.log(`⚙️ Server is running at port : ${env.port}`);
        })
    })
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
    })
