import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { isFirebaseConfigured, requireFirebaseApp } from "./firebaseApp";

import { runtimeSessionStorage } from "./runtimeSessionStorage";
const firebaseAuth = () => {
  if (!isFirebaseConfigured) throw new Error("Google Drive için Firebase yapılandırması eksik veya geçersiz.");
  return getAuth(requireFirebaseApp());
};

// Google Auth Provider setup with Drive & Forms scopes
const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/drive");
provider.addScope("https://www.googleapis.com/auth/drive.file");
provider.addScope("https://www.googleapis.com/auth/drive.readonly");
provider.addScope("https://www.googleapis.com/auth/forms.body");
provider.addScope("https://www.googleapis.com/auth/forms.body.readonly");
provider.addScope("https://www.googleapis.com/auth/forms.responses.readonly");

let isSigningIn = false;
let cachedAccessToken: string | null = null;

// Initialize auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  // Try to load cached token from session memory if we had one during this tab session
  const sessionToken = runtimeSessionStorage.getItem("drive_access_token");
  if (sessionToken) {
    cachedAccessToken = sessionToken;
  }

  if (!isFirebaseConfigured) { onAuthFailure?.(); return () => undefined; }
  return onAuthStateChanged(firebaseAuth(), async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else {
        // If logged in but token is not in cache, we need a fresh sign in
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      runtimeSessionStorage.removeItem("drive_access_token");
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Start Google sign-in flow
export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(firebaseAuth(), provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Google Drive access token'ı alınamadı.");
    }

    cachedAccessToken = credential.accessToken;
    // Store in runtimeSessionStorage to survive simple page refreshes without losing login
    runtimeSessionStorage.setItem("drive_access_token", cachedAccessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Sign out from Google Account
export const logout = async () => {
  if (isFirebaseConfigured) await firebaseAuth().signOut();
  cachedAccessToken = null;
  runtimeSessionStorage.removeItem("drive_access_token");
};

// Retrieve token helper
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

// --- GOOGLE DRIVE API OPERATIONS ---

/**
 * Ensures the backup folder exists on Google Drive, creating it if necessary.
 * Folder name: "Okul Yönetim Sistemi Yedekleri"
 */
export const getOrCreateBackupFolder = async (
  token: string
): Promise<string> => {
  const folderName = "Okul Yönetim Sistemi Yedekleri";

  try {
    // 1. Search for existing folder
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
    )}&fields=files(id)`;

    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!searchRes.ok) {
      throw new Error("Folder search failed");
    }

    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }

    // 2. Create the folder if not found
    const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });

    if (!createRes.ok) {
      throw new Error("Folder creation failed");
    }

    const folderData = await createRes.json();
    return folderData.id;
  } catch (error) {
    console.error("Error getOrCreateBackupFolder:", error);
    throw error;
  }
};

/**
 * Lists files in a specific folder, or all files with certain mimeTypes.
 */
export const listFilesInFolder = async (
  token: string,
  folderId?: string
): Promise<any[]> => {
  try {
    let q = "trashed = false";
    if (folderId) {
      q += ` and '${folderId}' in parents`;
    }

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&fields=files(id,name,mimeType,size,createdTime,webViewLink)&orderBy=createdTime desc`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error("Failed to list files");
    }

    const data = await res.json();
    return data.files || [];
  } catch (error) {
    console.error("Error listing files:", error);
    return [];
  }
};

/**
 * Uploads a file to Google Drive (Two-step method: Create metadata then upload media)
 */
export const uploadFileToDrive = async (
  token: string,
  fileName: string,
  content: string | Blob,
  mimeType: string,
  folderId?: string
): Promise<any> => {
  try {
    // Step 1: Create file metadata
    const metadataBody: any = {
      name: fileName,
      mimeType: mimeType,
    };
    if (folderId) {
      metadataBody.parents = [folderId];
    }

    const metadataRes = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadataBody),
    });

    if (!metadataRes.ok) {
      const errText = await metadataRes.text();
      throw new Error(`Metadata creation failed: ${errText}`);
    }

    const metadata = await metadataRes.json();
    const fileId = metadata.id;

    // Step 2: Upload media content
    const uploadRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": mimeType,
        },
        body: content,
      }
    );

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Media upload failed: ${errText}`);
    }

    return await uploadRes.json();
  } catch (error) {
    console.error("Error uploading file to Drive:", error);
    throw error;
  }
};

/**
 * Downloads text/JSON file content from Google Drive
 */
export const downloadFileContentFromDrive = async (
  token: string,
  fileId: string
): Promise<string> => {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      throw new Error("Failed to download file content");
    }

    return await res.text();
  } catch (error) {
    console.error("Error downloading file:", error);
    throw error;
  }
};

/**
 * Deletes a file from Google Drive
 */
export const deleteFileFromDrive = async (
  token: string,
  fileId: string
): Promise<boolean> => {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      throw new Error("Failed to delete file");
    }

    return true;
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
};
