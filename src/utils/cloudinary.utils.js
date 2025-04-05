import cloudinary from '../config/cloudinary.js';

/**
 * Upload image to Cloudinary
 * fileBuffer - The image file buffer from Multer
 * folder - The folder in Cloudinary ('organization_logos' or 'profile_pictures')
 * Return- The secure URL of the uploaded image
 */
export const uploadToCloudinary = (fileBuffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result.secure_url);
        }
      },
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete image from Cloudinary
 * imageUrl - The full URL of the image
 */
export const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl) {
    return;
  }

  const publicId = imageUrl.split('/').pop().split('.')[0];
  await cloudinary.uploader.destroy(publicId);
};
