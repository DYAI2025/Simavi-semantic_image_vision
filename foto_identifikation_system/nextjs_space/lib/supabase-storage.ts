import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = 'YOUR_SUPABASE_URL';
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Upload a file to Supabase Storage.
 * @param {string} filePath - The path where the file will be stored.
 * @param {File} file - The file to upload.
 */
export const uploadFile = async (filePath, file) => {
  const { data, error } = await supabase.storage.from('YOUR_BUCKET_NAME').upload(filePath, file);
  if (error) {
    throw error;
  }
  return data;
};

/**
 * Get a file URL from Supabase Storage.
 * @param {string} filePath - The path of the file.
 */
export const getFileUrl = (filePath) => {
  const { publicURL, error } = supabase.storage.from('YOUR_BUCKET_NAME').getPublicUrl(filePath);
  if (error) {
    throw error;
  }
  return publicURL;
};

/**
 * Delete a file from Supabase Storage.
 * @param {string} filePath - The path of the file to delete.
 */
export const deleteFile = async (filePath) => {
  const { data, error } = await supabase.storage.from('YOUR_BUCKET_NAME').remove([filePath]);
  if (error) {
    throw error;
  }
  return data;
};