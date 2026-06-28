export * from "react-native-appwrite";

// Type guard helper for safer casting
export function isValidDocument<T>(
  doc: unknown,
  requiredKeys: (keyof T)[]
): doc is T {
  if (!doc || typeof doc !== 'object') return false;
  return requiredKeys.every(key => key in doc);
}

// Safe array casting with validation
export function safeCastDocuments<T>(
  documents: unknown[],
  requiredKeys: (keyof T)[]
): T[] {
  return documents.filter(doc => isValidDocument<T>(doc, requiredKeys)) as T[];
}
