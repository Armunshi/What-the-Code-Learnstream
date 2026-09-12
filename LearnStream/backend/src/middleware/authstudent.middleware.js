import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserStudent } from "../models/user/userstudentmodel.js";
const verifyJWTStudent = asyncHandler(async (req,res,next)=>{
   try {
    const token = req.cookies?.studentAccessToken || req.header("Authorization")?.replace(/^Bearer\s/, "").trim();

     if (!token){
         throw new ApiError(401,"Unauthorized Request")
     }
 
     const decodedtoken = jwt.verify(token,env.accessToken.secret)
     const user = await UserStudent.findById(decodedtoken?._id).select(
         "-password -refreshToken")
     
     if (!user){
         // Next discusssion front end
         throw new ApiError(401,"Invalid Access Token")
     }
     req.student = user
     next();
   } catch (error) {
    throw new ApiError(401,error?.message || 
        "Invalid Access Token"
    )
   }
})

export {verifyJWTStudent}