import { supabase } from './supabase'

/** Extrait l'extension d'un fichier (sans le point), 'jpg' par défaut si absente. */
export function getFileExtension(file: File): string {
  return file.name.split('.').pop() || 'jpg'
}

/**
 * Upload un fichier/blob dans un bucket Supabase Storage puis retourne son URL
 * publique. `error` est retourné plutôt que jeté : à l'appelant de décider
 * s'il doit throw, ignorer, ou afficher un message (les usages actuels varient).
 */
export async function uploadAndGetPublicUrl(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { upsert?: boolean; contentType?: string },
): Promise<{ publicUrl: string | null; error: Error | null }> {
  const { error } = await supabase.storage.from(bucket).upload(path, file, options)
  if (error) return { publicUrl: null, error }
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path)
  return { publicUrl, error: null }
}
