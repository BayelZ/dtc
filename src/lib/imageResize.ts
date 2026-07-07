const AVATAR_SIZE = 512;
const WEBP_QUALITY = 0.85;

export async function resizeImageToSquareWebp(file:File):Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width-side)/2;
    const sy = (bitmap.height-side)/2;

    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas not supported in this browser.");
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

    return await new Promise<Blob>((resolve,reject)=>{
      canvas.toBlob(blob=>{ blob ? resolve(blob) : reject(new Error("Failed to encode image.")); }, "image/webp", WEBP_QUALITY);
    });
  } finally {
    bitmap.close();
  }
}
