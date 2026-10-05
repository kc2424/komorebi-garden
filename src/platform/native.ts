import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

export async function capturePhotoNative(): Promise<File | null> {
  if (!isNativePlatform()) return null;
  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
  });
  if (!photo.path && !photo.webPath) return null;
  const path = photo.webPath ?? photo.path!;
  const response = await fetch(path);
  const blob = await response.blob();
  return new File([blob], 'capture.jpg', { type: blob.type || 'image/jpeg' });
}

export async function pickPhotoNative(): Promise<File | null> {
  if (!isNativePlatform()) return null;
  const photo = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri,
    source: CameraSource.Photos,
  });
  if (!photo.webPath) return null;
  const response = await fetch(photo.webPath);
  const blob = await response.blob();
  return new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' });
}

export function registerBackButton(handler: () => boolean): () => void {
  if (!isNativePlatform()) return () => {};
  const sub = App.addListener('backButton', () => {
    const handled = handler();
    if (!handled) App.exitApp();
  });
  return () => {
    void sub.then((s) => s.remove());
  };
}

export async function writeBackupFile(filename: string, content: string): Promise<string | null> {
  if (!isNativePlatform()) return null;
  const result = await Filesystem.writeFile({
    path: filename,
    data: content,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
  });
  return result.uri;
}
