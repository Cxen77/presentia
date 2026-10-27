import { Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { getCloudinarySignature } from './api';

export type CloudinaryFolder = 'student_profiles' | 'attendance_verification';
export interface CloudinaryUploadReceipt { url: string; signature: string }

/** Phone cameras capture multi-megabyte photos; a classroom of check-ins would
 *  saturate the Wi-Fi. Reviews compare at thumbnail size, so cap the long edge. */
async function downscaleForUpload(imageUri: string): Promise<string> {
  try {
    const result = await manipulateAsync(
      imageUri,
      [{ resize: { width: 1000 } }],
      { compress: 0.8, format: SaveFormat.JPEG },
    );
    return result.uri;
  } catch {
    return imageUri; // Upload the original rather than blocking the check-in.
  }
}

/** Display-size variant of a public Cloudinary URL (profile photos render at
 *  thumbnail size; loading the original wastes the student's data). */
export function optimizedAvatarUrl(url: string | null | undefined, width = 256): string {
  if (!url) return '';
  return url.includes('/image/upload/') && !url.includes(',q_') && !/\/w_\d/.test(url)
    ? url.replace('/image/upload/', `/image/upload/w_${width},q_auto:good/`)
    : url;
}

/** Upload directly with a backend signature. The API secret never enters this client. */
export async function uploadCloudinaryImage(imageUri: string, folder: CloudinaryFolder = 'student_profiles', onProgress?: (progress: number) => void, attendance?:{qrToken:string;scanTicket:string}): Promise<CloudinaryUploadReceipt> {
  if (!imageUri) throw new Error('Choose or capture a photo first.');
  onProgress?.(5);
  const signed = await getCloudinarySignature(folder,undefined,attendance);
  if (!signed.cloudName || !signed.apiKey || !signed.signature || !signed.publicId || signed.folder !== folder || !['upload','authenticated'].includes(signed.type)) {
    throw new Error('The backend did not return valid photo upload settings.');
  }
  imageUri = await downscaleForUpload(imageUri);
  const form = new FormData();
  if (Platform.OS === 'web') {
    const local = await fetch(imageUri);
    if (!local.ok) throw new Error('Could not read the selected photo.');
    const blob = await local.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Choose an image file.');
    if (blob.size > 10 * 1024 * 1024) throw new Error('Use a photo smaller than 10 MB.');
    form.append('file', blob, 'photo.jpg');
  } else {
    // SDK 58 uses expo/fetch on native. Its multipart encoder reads a Blob or
    // File's bytes; React Native's old { uri, name, type } part is unsupported.
    const nativeFile = new File(imageUri);
    if (!nativeFile.exists || nativeFile.size === 0) throw new Error('Could not read the selected photo. Retake it and try again.');
    if (nativeFile.type && !nativeFile.type.startsWith('image/')) throw new Error('Choose an image file.');
    if (nativeFile.size > 10 * 1024 * 1024) throw new Error('Use a photo smaller than 10 MB.');
    form.append('file', nativeFile);
  }
  for (const [key,value] of Object.entries({api_key:signed.apiKey,timestamp:signed.timestamp,signature:signed.signature,folder:signed.folder,public_id:signed.publicId,type:signed.type,overwrite:signed.overwrite})) form.append(key,String(value));
  onProgress?.(25);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),60000);
  try {
    const response = await expoFetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`,{method:'POST',body:form,signal:controller.signal});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Photo upload failed. Please try again.');
    const url = new URL(data.secure_url);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.pathname.split('/')[1] !== signed.cloudName || data.public_id !== `${folder}/${signed.publicId}` || !/^[a-f0-9]{40}$/i.test(data.signature || '')) {
      throw new Error('Cloudinary did not return a valid upload receipt.');
    }
    // Cloudinary may include a delivery signature in authenticated upload responses.
    // Persist the unsigned asset location; only the authorized faculty API signs delivery.
    if (folder === 'attendance_verification') {
      if (data.type !== 'authenticated' || !Number.isSafeInteger(data.version) || !/^(jpg|jpeg|png|webp)$/i.test(data.format || '')) throw new Error('Cloudinary did not return a private image.');
      url.pathname = `/${signed.cloudName}/image/authenticated/v${data.version}/${data.public_id}.${data.format}`;
      url.search = ''; url.hash = '';
    }
    onProgress?.(100);
    return {url:url.toString(),signature:data.signature};
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new Error('Photo upload timed out. Please retry.');
    throw err;
  } finally { clearTimeout(timeout); }
}

export async function uploadImageToCloudinary(imageUri: string, onProgress?: (progress: number) => void): Promise<string> {
  return (await uploadCloudinaryImage(imageUri,'student_profiles',onProgress)).url;
}
