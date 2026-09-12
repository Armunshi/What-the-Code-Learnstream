
import mongoose,{Schema} from 'mongoose'
const courseSchema =new Schema({
        
        thumbnail:{
            type:String,
            required:true
        },
        isLive:{
            type:Boolean,
            default:false,
        },
        title:{
            type:String, 
            required:true
        },
        description:{
            type:String, //cloudinary usrl
            required:true
        },
        // Integer paise, never rupees and never a float (BACKEND_AUDIT.md §2.7).
        // ₹499 is stored as 49900. Rupees exist only at the input and display
        // edges of the frontend; every amount crossing the API or reaching
        // Razorpay is paise. Storing rupees as a Number allowed 19.99, and
        // 19.99 * 100 is 1998.9999999999998 in IEEE-754, which Razorpay rejects.
        price:{
            type:Number,
            required:true,
            min:[0,'Price cannot be negative'],
            validate:{
                validator:Number.isInteger,
                message:'Price must be a whole number of paise (₹499 → 49900), not rupees or a fraction'
            }
        },
        author:{
            type:Schema.Types.ObjectId,
            ref:"UserTeacher",
            required:true
        },
        category:{
            type:String,
            required:true,   
        },
        rating:{
            type:Number,
            default:0
        },
        enrolledStudents:[{
            type:Schema.Types.ObjectId,
            ref:"UserStudent"
        }],
        lectures:[{
            type:Schema.Types.ObjectId,
            ref:"Lectures"
        }],
        assignments:[{
            type:Schema.Types.ObjectId,
            ref:"Assignments"
        }],
        modules: [{
            type: Schema.Types.ObjectId,
            ref: 'Modules'
        }]
    },
    {
        timestamps:true
    }
)

const lectureSchema = new Schema({

     title:{
        type:String,
        required:true
     },
     videourl:{
        type:String, //cloudinary url
        required:true
     },
     
     duration:{
        type:Number,
        required : true
    },
    public_id:{
        type:String,
        required:true
    },
    // Cloudinary's `uploader.destroy()` defaults to resource_type "image" and
    // silently no-ops otherwise — this has to be stored at upload time so
    // deletes can pass the right one back (BACKEND_AUDIT.md §2.4).
    resource_type:{
        type:String,
        default:"video"
    },
    freePreview:{
        type:Boolean,
        default:false
    },
    course_id:{
        type:Schema.Types.ObjectId,
        ref:'Courses'
    },
    module_id: { // Links assignments to modules
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Modules',
        required: true,
    }
    },
    {
        timestamps:true
})
const assignmentSchema = new Schema({
    module_id: { // Links assignments to modules
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Modules',
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    assignmentUrls: [ // URLs for assignment files
        {
            type: String, // Cloudinary or other storage URLs
            default: '',
        },
    ],
    public_id: [ // Cloudinary file IDs
        {
            type: String,
            default: '',
        },
    ],
    // Parallel to `public_id` — same reasoning as lectureSchema.resource_type
    // above (BACKEND_AUDIT.md §2.4).
    resourceTypes: [
        {
            type: String,
            default: 'raw',
        },
    ],
    deadline: {
        required:false,
        type: Date,
        default: null,
    },
    uploadedAssignments: [
        {
            studentId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'UserStudent',
                required: true,
            },
            submittedAssignmentUrls: [
                {
                    type: String,
                    required: true,
                },
            ],
            uploadedAt: {
                type: Date,
                default: Date.now,
            },
            // Was previously written by submitAssignment but absent from this
            // subschema, so Mongoose's strict mode silently dropped it on
            // every save — lateness was never actually persisted (§2.6).
            submittedOnTime: {
                type: Boolean,
                default: true,
            },
        },
    ],
    checked: [
        {
            studentId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'UserStudent',
                required: true,
            },
            isChecked: {
                type: Boolean,
                default: false,
            },
            grading: {
                type: Number, // Grade assigned to the student
                default: null,
            },
            submittedOnTime: {
                type: Boolean, // Whether the submission was on time
                default: true,
            },
        },
    ],
}, { timestamps: true });

// No course-delete endpoint exists anywhere in this codebase, so there is
// nothing for a cascade hook to protect yet. The `pre('remove')` hook that
// used to live here was dead code regardless (Mongoose 8 removed document
// `remove()` entirely, so it never fired) and also queried a field
// (`course_id`) that doesn't exist on Modules — see BACKEND_AUDIT.md §2.3.
// If a delete-course feature is added, write its cascade explicitly in the
// controller (the way deleteModule now does), not as a schema hook.

const Courses = mongoose.model("Courses",courseSchema);
const Lectures = mongoose.model("Lectures",lectureSchema);
const Assignments = mongoose.model("Assignments",assignmentSchema);
export {
    Courses,
    Lectures,
    Assignments
}