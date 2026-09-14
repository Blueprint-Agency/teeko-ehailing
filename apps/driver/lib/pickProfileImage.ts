import * as ImagePicker from 'expo-image-picker';

export type PickedImage = { uri: string; name: string; mimeType: string };

/** Raised when the OS permission dialog was answered with "don't allow". */
export class PermissionDeniedError extends Error {
  constructor(readonly source: 'camera' | 'library') {
    super(`${source}_permission_denied`);
    this.name = 'PermissionDeniedError';
  }
}

// A square crop at 512px is all the UI ever renders, and it keeps a 12 MP
// camera shot well inside the server's 5 MB ceiling without a second
// compression pass on the device.
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.7,
};

/**
 * Ask for a profile picture from the camera or the photo library.
 * Resolves to null when the user backs out of the picker.
 */
export async function pickProfileImage(
  source: 'camera' | 'library',
): Promise<PickedImage | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new PermissionDeniedError(source);

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);

  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;

  // `fileName` is absent for camera captures on both platforms, and `mimeType`
  // is absent on some Android gallery providers — the picker always hands back
  // a JPEG for an edited crop, so that is the safe fallback.
  return {
    uri: asset.uri,
    name: asset.fileName ?? 'avatar.jpg',
    mimeType: asset.mimeType ?? 'image/jpeg',
  };
}
