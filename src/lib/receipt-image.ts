import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export type PreparedImage = {
  uri: string;
  base64: string;
  mediaType: 'image/jpeg';
};

// Resize + compress so uploads and AI requests stay small while keeping text legible.
const MAX_WIDTH = 1600;
const COMPRESS = 0.7;

/** Downscale + compress a captured/picked image and return its bytes as base64. */
export async function compressReceiptImage(uri: string): Promise<PreparedImage> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: MAX_WIDTH });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: COMPRESS,
    format: SaveFormat.JPEG,
    base64: true,
  });
  return { uri: result.uri, base64: result.base64 ?? '', mediaType: 'image/jpeg' };
}
