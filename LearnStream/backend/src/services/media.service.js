import fs from "fs"
import { cloudinary } from "../config/cloudinary.js"

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // file has been uploaded successfull
        //console.log("file is uploaded on cloudinary ", response.url);
        fs.unlinkSync(localFilePath)
        return response;

    } catch (error) {
        console.error(`Cloudinary upload failed for ${localFilePath}:`, error?.http_code, error?.message || error?.error?.message || error);

        if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the upload operation got failed
        else console.warn(`File not found at file path${localFilePath}`);
        
        return null;
    }
}
const uploadMultipleFilesOnCloudinary = async (filePaths) => {
  try {
      // Validate input
      if (!Array.isArray(filePaths) || filePaths.length === 0) {
          throw new Error("No files provided for upload.");
      }

      // Use the existing `uploadOnCloudinary` for each file
      const uploadPromises = filePaths.map((path) => uploadOnCloudinary(path));

      // Wait for all uploads to complete
      const responses = await Promise.all(uploadPromises);

      // Filter out any null responses (if `uploadOnCloudinary` returns null for failed uploads)
      const successfulUploads = responses.filter((res) => res !== null);

      // If no uploads succeeded, throw an error
      if (successfulUploads.length === 0) {
          throw new Error("All file uploads failed.");
      }

      // Return successful uploads
      return successfulUploads;

  } catch (error) {
      // Log and propagate the error for the caller
      console.error(`Error in uploadMultipleFiles: ${error.message}`);
      throw error;
  }
};
const deleteMediaFromCloudinary = async (publicId, resourceType = "image") => {
    try {
      // uploader.destroy() defaults to resource_type "image" and silently
      // no-ops against anything else — videos and raw files need the real
      // type passed explicitly, which callers now store on the model at
      // upload time (BACKEND_AUDIT.md §2.4).
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      if (result.result !== "ok" && result.result !== "not found") {
        console.error(`Cloudinary destroy did not succeed for ${publicId} (${resourceType}):`, result);
      }
      return result;
    } catch (error) {
      console.log(error);
      throw new Error("failed to delete assest from cloudinary");
    }
  };

export {uploadOnCloudinary,uploadMultipleFilesOnCloudinary,deleteMediaFromCloudinary}