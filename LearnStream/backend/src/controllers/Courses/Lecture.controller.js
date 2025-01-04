import mongoose from "mongoose";
import { Assignments, Courses, Lectures } from "../../models/Course/courses.js";
// import { UserTeacher } from "../../models/student/userteachermodel.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { deleteMediaFromCloudinary, uploadOnCloudinary } from "../../utils/cloudinary.js";
// import { UserStudent } from "../../models/student/userstudentmodel.js";
import { Progress } from "../../models/Course/Progress.js";


const addLecture = asyncHandler(async (req,res)=>{
    const {title} = req.body
    const {course_id} =req.params
    
    // Validate course existence
    if (!course_id) {
        throw new ApiError(404, "Course not found");
    }

    const videoLocalPath = req.file?.path

    

    if (!videoLocalPath){
        throw new ApiError(400,"file not uploaded")
    }

    const video = await uploadOnCloudinary(videoLocalPath)
    const videoUrl = video.secure_url
    if (!videoUrl){
        throw new ApiError(400,"video was not uploaded properly to cloudinary")
    }

    const video_public_id = video.public_id
    const video_duration = video.duration

    const lecture = await Lectures.create({
        title,
        videourl:videoUrl,
        duration:video_duration,
        public_id:video_public_id,
        course_id
    })

    if (!lecture){
        throw new ApiError("lecture was not added")
    }

    const updatedCourse = await Courses.findByIdAndUpdate(
        course_id,
    {$push:{lectures:lecture._id}},
    {new:true}
)
     
    if (!updatedCourse){
        throw new ApiError(404,"Course not found or failed to update")
    }
    return res.status(200).json(
        new ApiResponse(200,lecture,
            'added lecture succesfully')
    )
}) 
const updateLecture = asyncHandler(async (req,res)=>{
    // there can be a title change 
    // a video change in which case i just have to delete and add
    // enabling full preview for some lectures and not for others
})
const deleteLecture = asyncHandler(async (req,res)=>{
    // i will first recieve the lecture id to be deleted along with the courseid 
    // then i will have to first delete the given lecture from cloudinary
    // then first delete from course database lectures array
    // then i will have to delete all the details of that lecture from my database

    const {course_id,lecture_id} = req.params


    const course = await  Courses.findById(course_id)
    const lecture = await Lectures.findById(lecture_id)

    if (!course){
        throw new ApiError(404,"Course Not Found")
    }
    if (!lecture){
        throw new ApiError(404,"Lecture Not Found")
    }

    await deleteMediaFromCloudinary(lecture.public_id);
    //delete from courses array 
    course.lectures = course.lectures.filter(lectureId =>!lectureId.equals(lecture_id))

    Lectures.findByIdAndDelete(lecture_id);
   //  I have not completed this controller please do tommorrow
    return res.status(200)
    .json(new ApiResponse(200,null,"Lecture deleted succesfully"))
})
const getAllLectures = asyncHandler(async (req,res)=>{
    // to get all lectures related to a course first get the courses id 
    // then we go to the lectures field of the courses model 
    // we iterate over the ids and only send the relevant data  
    // then we send this to the frontend in the form of an object
    // {lecture_id,lecture_title,lecture_duration,freePreview}
    
    const {course_id} = req.params
    const course =  await Courses.findById(course_id).populate({
        path:'lectures',
        select:'_id title duration freePreview completed'
    });
    if (!course){
        throw new ApiError("course not found")
    }
    // console.log(course.lectures)
    return res.status(200).json(
        new ApiResponse(200,
            course.lectures,
            "All Lectures Sent "
        )
    )
})
// when user wants to view a particular lecture
const getLecturebyId = asyncHandler(async (req,res)=>{
    // user clicks on lecture the front end sends request via
    // /:course_id/lectures/:lecture_id
    const {course_id,lecture_id} = req.params
    const course = await Courses.findById(course_id)
    if (!course){
        throw new ApiError('Course for the Lecture doesnt exist')
    }
    const lecture = await Lectures.findById(lecture_id)
    if (!lecture){
        throw new ApiError('Lecture Doesnt Exist')
    }

    return res.status(200).json(
        new ApiResponse(200,
            lecture,
            "Lecture Sent "
        )
    )
})
const markLectureCompleted = asyncHandler(async(req,res) =>{
    const {courseId,lectureId } = req.params
    const studentId =  req.student?._id
    
    const updated = await Progress.findOneAndUpdate({studentId,courseId},
        {
            $push:{completedLectures:lectureId},
            $inc:{ completedLectureCount:1},
            $set:{lastUpdated : Date.now()}
        },
    {
        upsert:true,//ensures that the document is updated 
        new:true//ensures that the document returned is updated
    }
    );
    return res.status(200).json(
        new ApiResponse(200,updated,"Marked Lecture as Completed")
    );
})

export {
    addLecture,
    updateLecture,
    deleteLecture,
    getLecturebyId,
    getAllLectures,
    markLectureCompleted,
}