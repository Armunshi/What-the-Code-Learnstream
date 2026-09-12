import mongoose from "mongoose";
import { Assignments, Courses, Lectures } from "../../models/Course/courses.js";
// import { UserTeacher } from "../../models/student/userteachermodel.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { deleteMediaFromCloudinary, uploadMultipleFilesOnCloudinary, uploadOnCloudinary } from "../../utils/cloudinary.js";
import { Modules } from "../../models/Course/Modules.js";
// import { UserStudent } from "../../models/student/userstudentmodel.js";

// assignments

// const createAssignment = asyncHandler(async (req,res)=>{
//     const {title,deadline} = req?.body
//     const {course_id,moduleId} = req?.params;
//     if ((!course_id || !title ||!moduleId)){
//         throw new ApiError('CourseId and Title cannot be empty')
//     }
//     const assignmentFiles = req.files?.assignmentFiles;

//     if (!assignmentFiles || assignmentFiles.length==0) throw new ApiError('no assignments uploaded');
    
//     console.log(assignmentFiles)
    
//     const filePaths = assignmentFiles.map((file)=>file.path)
//     const uploadedFiles = await uploadMultipleFilesOnCloudinary(filePaths);

//     const fileUrls  = uploadedFiles.map((file)=>file.secure_url)
//     const public_ids = uploadedFiles.map((file)=>file.public_id) 

//     const assignment = await Assignments.create({
//         course_id,
//         module_id:moduleId,
//         title,
//         public_id:public_ids,
//         assignmentUrls:fileUrls,
//         deadline,
//     })

//     const assignmentObject = await Assignments.findById(assignment?._id).select('_id public_id deadline')
//     console.log(assignmentObject)
//     return res.status(200).json(
//         new ApiResponse(200,assignmentObject,'assignment Succesfully Created')
//     )
// }) 
import fs from "fs/promises"; // Use fs.promises for async operations
import { Progress } from "../../models/Course/Progress.js";
import { assertCourseOwnership } from "../../utils/verifyOwnership.js";

const createAssignment = asyncHandler(async (req, res) => {
    const { title, deadline } = req.body;
    const { course_id, moduleId } = req.params;

    // ✅ Validate required fields
    if (!course_id || !title || !moduleId) {
        throw new ApiError(400, 'CourseId, Title, and ModuleId cannot be empty');
    }

    const ownerCourse = await Courses.findById(course_id);
    assertCourseOwnership(ownerCourse, req.teacher._id);

    // ✅ Check for uploaded files
    const assignmentFiles = req.files?.assignmentFiles;
    if (!assignmentFiles || assignmentFiles.length === 0) {
        throw new ApiError(400, 'No assignments uploaded');
    }

    // ✅ Check if an assignment already exists in the module
    const existingAssignment = await Assignments.findOne({ course_id, module_id: moduleId, title });
    if (existingAssignment) {
        throw new ApiError(409, 'Assignment with the same title already exists for this module.');
    }

    // ✅ Upload files to Cloudinary
    const filePaths = assignmentFiles.map((file) => file.path);
    let uploadedFiles;
    try {
        uploadedFiles = await uploadMultipleFilesOnCloudinary(filePaths);
    } catch (error) {
        throw new ApiError(500, 'Error uploading files to Cloudinary. Please try again.');
    }

    const fileUrls = uploadedFiles.map((file) => file.secure_url);
    const public_ids = uploadedFiles.map((file) => file.public_id);
    const resourceTypes = uploadedFiles.map((file) => file.resource_type);

    const parsedDeadline = deadline && !isNaN(new Date(deadline)) ? new Date(deadline) : null;

    const assignment = await Assignments.create({
        course_id,
        module_id: moduleId,
        title,
        public_id: public_ids,
        resourceTypes,
        assignmentUrls: fileUrls,
        deadline: parsedDeadline,
    });

    const updatedModule = await Modules.findByIdAndUpdate(
        moduleId,
        { $push: { assignments: assignment._id } }, // Push assignment ID into the module
        { new: true }
    ).populate("assignments"); // ✅ Populate assignments to confirm the update

    if (!updatedModule) {
        throw new ApiError(404, "Module not found, assignment not linked.");
    }

    for (const path of filePaths) {
        try {
            await fs.unlink(path);
        } catch (error) {
            console.error(`Error deleting file ${path}:`, error);
        }
    }

    const assignmentObject = await Assignments.findById(assignment._id).select('_id public_id deadline title');

    return res.status(200).json(
        new ApiResponse(200, assignmentObject, 'Assignment successfully created and linked to the module')
    );
});



const submitAssignment = asyncHandler(async (req,res)=>{
    const {assignmentId} = req?.params;
    const studentId = req.student._id

    if(!studentId ||!assignmentId){
        throw new ApiError(400,'assignmentId or studentId are missing')
    }

    // Lateness must be decided from the assignment's own stored deadline, not
    // a client-supplied one — a student could otherwise post any future
    // timestamp and always be recorded on time (BACKEND_AUDIT.md §2.6).
    const assignment = await Assignments.findById(assignmentId);
    if (!assignment) {
        throw new ApiError(404, "Assignment not found");
    }
    const submittedOnTime = !assignment.deadline || Date.now() <= assignment.deadline.getTime();

    const submissionFiles = req.files?.submissionFiles;

    if (!submissionFiles || submissionFiles.length==0) throw new ApiError(400, 'no assignments uploaded');

    const filePaths = submissionFiles.map((file)=>file.path)
    const uploadedFiles = await uploadMultipleFilesOnCloudinary(filePaths);

    const fileUrls  = uploadedFiles.map((file)=>file.secure_url)

    await Assignments.findByIdAndUpdate(assignmentId,
        {
            $push:{uploadedAssignments:{
                studentId,
                submittedAssignmentUrls:fileUrls,
                uploadedAt:Date.now(),
                submittedOnTime
            }}
        },
    {new:true})

    res.status(200).json(
        new ApiResponse(200,{},'submittedAssignment Succesfully')
    )
})
const getAssignmentById = asyncHandler(async (req, res)=>{
    const {assignmentId} = req?.params;
    console.log(assignmentId)
    if (!assignmentId){
        throw new ApiError(404,'AssignmentId not sent')
    }

    const assignment = await Assignments.findById(assignmentId).select('-module_id -assignmentUrls')
    if (!assignment){
        throw new ApiError(404,'The Assignment Requested was not found');
    }

    // Only return the requesting student's own submissions, never classmates'.
    const assignmentObject = assignment.toObject();
    assignmentObject.uploadedAssignments = assignmentObject.uploadedAssignments.filter(
        (submission) => submission.studentId.toString() === req.student._id.toString()
    );

    res.status(200).json(
        new ApiResponse(200,assignmentObject,'Assignment sent succesfully')
    )
})
const deleteAssignment = asyncHandler(async (req,res)=>{
    const {moduleId,courseId,assignmentId} = req.params

    const course = await  Courses.findById(courseId)
    const assignment = await Assignments.findById(assignmentId)
    const module = await Modules.findById(moduleId)

    if (!assignment){
        throw new ApiError(404,"Lecture Not Found")
    }
    if (!module){
        throw new ApiError(404,"Lecture Not Found")
    }
    assertCourseOwnership(course, req.teacher._id);

    // forEach with an async callback ignores the returned promises — any
    // rejection became an unhandled promise rejection, which terminates the
    // process on Node 15+ (BACKEND_AUDIT.md §2.5). Promise.allSettled waits
    // for every deletion and logs failures instead of crashing mid-delete.
    const cloudinaryResults = await Promise.allSettled(
        assignment.public_id.map((id, i) => deleteMediaFromCloudinary(id, assignment.resourceTypes?.[i]))
    );
    cloudinaryResults.forEach((result) => {
        if (result.status === "rejected") {
            console.error("Cloudinary cleanup failed during assignment delete:", result.reason);
        }
    });

    //delete from courses array
    course.assignments = course.assignments.filter(assignment_id =>!assignment_id
        .equals(assignment._id))
    await course.save();
    
    module.assignments = module.assignments.filter(
        (id) => !id.equals(assignment._id)
    );
    await module.save();
    
    await Assignments.findByIdAndDelete(assignmentId);
    
    return res.status(200)
    .json(new ApiResponse(200,null,"Assignment deleted succesfully"))
})
const getStudentsAndUploadedAssignments = asyncHandler(async (req, res) => {
    const { assignmentId } = req.params;

    // Find the assignment by assignmentId
    const assignment = await Assignments.findById(assignmentId)
        .populate({
            path: 'uploadedAssignments.studentId', // Populate student details
            select: 'name email', // You can add other student fields as needed
        });

    // If the assignment doesn't exist, return an error
    if (!assignment) {
        res.status(404);
        throw new ApiError( 404,'Assignment not found');
    }

    // Resolve the assignment's real course via its module — the route's
    // `courseId` param is attacker-controlled and must not be trusted on its own.
    const module = await Modules.findById(assignment.module_id);
    const course = module ? await Courses.findById(module.course) : null;
    assertCourseOwnership(course, req.teacher._id);

    // Send the response with assignment data and students who uploaded
    res.status(200).json(
        new ApiResponse(200,{
            assignmentTitle: assignment.title,
            uploadedAssignments: assignment.uploadedAssignments.map((submission) => ({
                studentId: submission.studentId._id,
                studentName: submission.studentId.name,
                studentEmail: submission.studentId.email,
                submittedAssignmentUrls: submission.submittedAssignmentUrls,
                uploadedAt: submission.uploadedAt,
            })),
        },"Students and Their Assignments sent Succesfully")
    );
});

const markAssignmentCompleted = asyncHandler(async (req, res) => {
    const { courseId, assignmentId } = req.params;
    console.log(courseId,assignmentId);
    const studentId = req.student?._id;

    // See Lecture.controller.js's markLectureCompleted for the full
    // rationale: atomic get-or-create + $addToSet guarded by a $ne filter,
    // rather than findOne-then-create, so the {studentId, courseId} unique
    // index (§3.8) can't turn a concurrent request into a duplicate-key
    // error, and rapid duplicate clicks can't silently create a second
    // completedAssignments entry for the same assignment.
    await Progress.findOneAndUpdate(
        { studentId, courseId },
        { $setOnInsert: { studentId, courseId } },
        { upsert: true }
    );

    await Progress.findOneAndUpdate(
        { studentId, courseId, "completedAssignments.assignmentId": { $ne: assignmentId } },
        {
            $addToSet: { completedAssignments: { assignmentId, completedAt: Date.now() } },
            $set: { lastUpdated: Date.now() },
        },
        { new: true }
    );

    // Respond with success
    return res.status(200).json(new ApiResponse(200, true, "Marked Assignment as Completed"));
});
export {
    createAssignment,
    submitAssignment,
    deleteAssignment,
    getAssignmentById,
    markAssignmentCompleted,
    getStudentsAndUploadedAssignments
}