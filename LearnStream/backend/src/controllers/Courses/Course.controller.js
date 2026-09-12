import { Courses } from "../../models/Course/courses.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { UserStudent } from "../../models/user/userstudentmodel.js";
import { Progress } from "../../models/Course/Progress.js";
import { UserTeacher } from "../../models/user/userteachermodel.js";
import { assertCourseOwnership } from "../../utils/verifyOwnership.js";

const createCourse = asyncHandler(async (req,res)=> {
    // thumbnail upload using multer and cloudinary
    // save the rest of the data and link the author 
    const { title,description,price,category,isLive } = req.body;

    if (!title || !description || !price || !req.teacher || !category){
        throw new ApiError(400,'Basic info about the course required')
    }

    // `price` arrives as a multipart string and is stored as integer paise
    // (BACKEND_AUDIT.md §2.7) — the frontend converts the teacher's rupee
    // input before sending. Parsing and checking it here turns a fractional or
    // non-numeric price into a clear 400 instead of a Mongoose ValidationError.
    const priceInPaise = Number(price);
    if (!Number.isInteger(priceInPaise) || priceInPaise < 0){
        throw new ApiError(400,'Price must be a whole number of paise (₹499 is sent as 49900)')
    }
    const existingCourse = await Courses.findOne({ title: title });
    if (existingCourse) {
        throw new ApiError(400, "Course Already exists");
    }

    if (!req.teacher){
        throw new ApiError(401,'User is not logged in')
    }

    const thumbnailLocalPath = req.file?.path;
    
    if (!thumbnailLocalPath){
        throw new ApiError(401,"thumbnail file is required")
    }

    const thumbnailUrl = await uploadOnCloudinary(thumbnailLocalPath);
    const thumbnailUrlString =thumbnailUrl.secure_url;

    if (!thumbnailUrlString)throw new ApiError(400,'thumbnail must be there')
    
    
    
    const course = await Courses.create({
        thumbnail:thumbnailUrlString,
        title ,
        description,
        price:priceInPaise,
        author:req.teacher._id,
        category,
        isLive: isLive,
    })

    const teacher = await UserTeacher.findByIdAndUpdate(req.teacher._id,{
        $push:{Courses:course._id}
    },
    {new:true});

    if (!course){
        throw new ApiError(400,"something went wrong while creating course")
    }

    if (!teacher){
        throw new ApiError(400,'Error while adding reference to teacher')
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,course,"created course succesfully")
    )
})
const getCourseByStudentId = asyncHandler(async (req,res)=>{
    const student_id  = req.student._id;
    console.log(req.params)
    if (!student_id){
        throw new ApiError(401, 'user is not logged in  or is undefined')
    }
    const studentcourses = await UserStudent.findById(student_id, { Courses: 1 })
  .populate({
    path: 'Courses',
    select: 'thumbnail title description price category author',
    populate: {
      path: 'author',
      select: 'name' // Populate only the author's name
    }
  });
    console.log(studentcourses);
    if (!studentcourses){
        throw new ApiError(404, 'student doesnt have any courses')
    }

    return res.status(200).json(
        new ApiResponse(200,studentcourses,'student courses succesfully sent ')
    )

})
const getCourseByTeacherId = asyncHandler(async(req,res)=>{
    const teacher_id  = req.teacher._id;

    if (!teacher_id){
        throw new ApiError(401, 'user is not logged in  or is undefined')
    }
    const teachercourses = await UserTeacher.findById(teacher_id, { Courses: 1 })
  .populate({
    path: 'Courses',
    select: 'thumbnail title description price category author',
    populate: {
      path: 'author',
      select: 'name' 
    }
  });
    console.log(teachercourses);
    if (!teachercourses){
        throw new ApiError(404, 'teacher doesnt have any courses')
    }

    return res.status(200).json(
        new ApiResponse(200,teachercourses,'teachercourses succesfully sent ')
    )

})
const getCourseById = asyncHandler(async (req, res)=> {
    const {courseId}  = req.params

    const course = await Courses.findById(courseId).populate('author', 'name');


    if (!course){
        throw new ApiError(404, "course not found")
    }

    return res.status(200).json(
        new ApiResponse(200,course,"course sent succesfully")
    )
 })

const getCoursesByCategory = asyncHandler(async (req, res) => {
    const { category } = req.query;
   
    if (!category) {
        throw new ApiError(400, 'Category is required');
    }
    console.log(category)
    const courses = await Courses.find({ category }).select('thumbnail title author modules price ');
    const updatedCourses = await Promise.all(
        courses.map(async (course) => {
            const author = await UserTeacher.findById(course.author).select('name');
            return {
                ...course._doc, // Spread course data (MongoDB documents have `_doc` for raw data)
                author: author, // Add author details
            };
        })
    );
    console.log(updatedCourses)
    return res.status(200).json(new ApiResponse(200, updatedCourses, 'Courses fetched successfully'));
});

const getAllCourses = asyncHandler(async (req,res) =>{
    // to get all courses i will only send back basic details 
    // such as the course object containing lecture
    const courses = await Courses.find().
    select('thumbnail title description price category rating')
     
    if (!courses){
        throw new ApiError(500, 'There was Some Error Fetching Courses')
    }

    return res.status(200).json(
        new ApiResponse (200,courses, 'Courses Fetched Succesfully')
    )
})

const checkEnrollment = asyncHandler(async(req,res)=>{
    const { courseId:course_id}  = req.params

    const student_id = req.student._id
   
    
    console.log('req.student:', req.student);
    console.log('courseid',course_id)
    console.log('student_id:', student_id);

    if (!student_id) {
        throw new ApiError(401, 'User not authenticated');
    }

    const studenttobeEnrolled =await UserStudent.findById(student_id);
    const courseTobeEnrolled = await Courses.findById(course_id);
    if (!studenttobeEnrolled){
        throw new ApiError(404, 'course id not found')
    }
    if (!courseTobeEnrolled){
        throw new ApiError(404, 'student not found')
    }
    
    const alreadyEnrolled = studenttobeEnrolled.Courses.includes(course_id);

    return res.status(200).json( 
        new ApiResponse(200,alreadyEnrolled,'Student Already enrolled')
    )
    
})
const getEnrolledStudents = asyncHandler(async (req,res)=>{
    const {courseId} = req.params

    const course = await Courses.findById(courseId).select('enrolledStudents author')
    assertCourseOwnership(course, req.teacher._id);

    return res.status(200).json(
        new ApiResponse(200,course,"Succesfully Sent Student Data")
    )
})
const CourseProgress = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const studentId = req?.student?._id;

    if (!courseId) {
        throw new ApiError(400, "The course sent doesn't exist or is undefined");
    }

    // Fetch progress for the student in the given course
    const progress = await Progress.findOne({ courseId, studentId }).select('completedLectures completedLectureCount completedAssignments');

    if (!progress) {
        return res.status(200).json(new ApiResponse(200, 0, "No progress found, returning 0%"));
    }

    // Fetch total lectures and assignments in the course
    const course = await Courses.findById(courseId).select('lectures assignments');

    if (!course || (!course.lectures && !course.assignments)) {
        throw new ApiError(404, "Encountered an error while fetching course details");
    }

    const totalLectures = course?.lectures.length || 0;
    const totalAssignments = course?.assignments.length || 0;

    // Calculate progress percentage based on completed lectures
    const progressPercentage = totalLectures > 0 ? (progress.completedLectureCount / totalLectures) * 100 : 0;

    // Get the completed lectures and assignments counts from the progress
    const completedLecturesCount = progress.completedLectures.length;
    const completedAssignmentsCount = progress.completedAssignments.length;

    return res.status(200).json(new ApiResponse(200, {
        progressPercentage,
        completedLecturesCount,
        completedAssignmentsCount,
        totalLectures,
        totalAssignments
    }, "Progress data sent successfully"));
});

const getCourseOwner = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  if (!courseId) {
    throw new ApiError(400, "courseId not found");
  }

  const owner = await Courses.findById(courseId).select("author");

  if (!owner) {
    throw new ApiError(404, "Course not found");
  }

  return res.status(200).json(
    new ApiResponse(200, owner, "Owner fetched successfully")
  );
});

export {
    createCourse,
    getCoursesByCategory,
    getAllCourses,
    getCourseById,
    getCourseByStudentId,
    CourseProgress,
    getEnrolledStudents,
    checkEnrollment,
    getCourseByTeacherId,
    getCourseOwner
}
