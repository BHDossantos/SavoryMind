/**
 * Client-side image downscale before upload. Phones routinely produce
 * 4-12MB JPEGs from the camera; Claude vision doesn't need anything
 * close to that. We resize to a max dimension and re-encode as JPEG
 * at 0.85 quality, bringing most photos to ~200-500KB without visibly
 * affecting the menu legibility.
 */
export async function downscaleImage(fileOrBlob, { maxDim = 1280, quality = 0.85 } = {}) {
  const blob = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(fileOrBlob);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = blob;
  });

  let { width, height } = img;
  if (width > maxDim || height > maxDim) {
    const scale = maxDim / Math.max(width, height);
    width  = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });
}
