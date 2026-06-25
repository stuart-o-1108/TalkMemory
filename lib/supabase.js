import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.SUPABASE_URL;
const supabaseKey = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function getFavorites(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('favorites')
    .select('image_id')
    .eq('user_id', userId);
  if (error) return [];
  return data;
}

export async function addFavorite(userId, imageId) {
  if (!userId) return;
  await supabase.from('favorites').insert({ user_id: userId, image_id: imageId });
}

export async function removeFavorite(userId, imageId) {
  if (!userId) return;
  await supabase
    .from('favorites')
    .delete()
    .eq('user_id', userId)
    .eq('image_id', imageId);
}
