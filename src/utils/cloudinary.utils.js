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
export const deleteFromCloudinary = async (imageUrl, next) => {
  if (!imageUrl) {
    return;
  }

  try {
    const url = new URL(imageUrl);
    const parts = url.pathname.split('/');

    // Cloudinary's publicId includes folders, so we remove `/image/upload/` and get everything after
    const uploadIndex = parts.findIndex((part) => part === 'upload');
    const publicIdWithExtension = parts.slice(uploadIndex + 1).join('/');
    const publicId = publicIdWithExtension.replace(/\.[^/.]+$/, ''); // remove extension like .jpg/.png

    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    next(error);
  }
};
