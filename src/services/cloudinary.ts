import { Platform } from 'react-native';

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

export const isCloudinaryConfigured = (): boolean => {
  return (
    Boolean(CLOUD_NAME) &&
    CLOUD_NAME !== 'your-cloudinary-cloud-name' &&
    Boolean(UPLOAD_PRESET) &&
    UPLOAD_PRESET !== 'your-unsigned-preset'
  );
};

export interface CloudinaryUploadResult {
  url: string;
  publicId?: string;
}

/**
 * Uploads an image to Cloudinary using a secure, client-safe unsigned upload preset.
 * No API secrets or privileged credentials are ever exposed in the mobile bundle.
 */
export const uploadImageToCloudinary = async (
  imageUri: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  if (!isCloudinaryConfigured()) {
    console.warn(
      'Cloudinary is not yet configured with real credentials (EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME, EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET).'
    );
    // If not configured, we return the local image URI so the user can continue testing the UI seamlessly
    return imageUri;
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
  const formData = new FormData();

  if (Platform.OS === 'web') {
    // On web, if imageUri is a data URI or blob URL, fetch it to a blob or pass directly
    if (imageUri.startsWith('data:')) {
      formData.append('file', imageUri);
    } else {
      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        formData.append('file', blob, 'profile_photo.jpg');
      } catch {
        formData.append('file', imageUri);
      }
    }
  } else {
    // React Native Mobile
    const filename = imageUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri: imageUri,
      name: filename,
      type,
    } as any);
  }

  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'student_profiles');

  try {
    if (onProgress) onProgress(30);

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (onProgress) onProgress(80);

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data?.error?.message || 'Failed to upload photo to Cloudinary';
      throw new Error(errMsg);
    }

    if (onProgress) onProgress(100);
    return data.secure_url;
  } catch (err: any) {
    console.error('Cloudinary upload error:', err);
    throw new Error(err.message || 'Image upload failed. Please try again.');
  }
};
