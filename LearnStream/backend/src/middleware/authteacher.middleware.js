import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserTeacher } from "../models/user/userteachermodel.js" 
const verifyJWT = asyncHandler(async (req,res,next)=>{
   try {
     const token = req.cookies?.teacherAccessToken || req.header
     ("Authorization")?.replace("Bearer","").trim()

     if (!token){
         throw new ApiError(401,"Unauthorized Request")
     }
 
     const decodedtoken = jwt.verify(token,env.accessToken.secret)
     console.log(decodedtoken);
     const user = await UserTeacher.findById(decodedtoken?._id).select(
         "-password -refreshToken")
     console.log(user)
     if (!user){
         // Next discusssion front end
         throw new ApiError(401,"Invalid Access Token")
     }
     req.teacher= user
     console.log('Teacher user set in req:', req.teacher);
     next();
   } catch (error) {
    throw new ApiError(401,error?.message || 
        "Invalid Access Token"
    )
   }
})

export {verifyJWT}