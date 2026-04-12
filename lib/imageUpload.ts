export type CompressOptions = {
  maxWidth?: number
  maxHeight?: number
 quality?: number
  outputType?: "image/jpeg" | "image/webp"
}

export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.72,
    outputType = "image/jpeg",
  } = options

  const imageBitmap = await createImageBitmap(file)

  let { width, height } = imageBitmap

  const ratio = Math.min(maxWidth / width, maxHeight / height, 1)
  const targetWidth = Math.round(width * ratio)
  const targetHeight = Math.round(height * ratio)

  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("No se pudo procesar la imagen.")
  }

  ctx.drawImage(imageBitmap, 0, 0, targetWidth, targetHeight)

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) {
          reject(new Error("No se pudo comprimir la imagen."))
          return
        }
        resolve(result)
      },
      outputType,
      quality
    )
  })

  const extension = outputType === "image/webp" ? "webp" : "jpg"
  const newName = file.name.replace(/\.[^.]+$/, "") + `.${extension}`

  return new File([blob], newName, {
    type: outputType,
    lastModified: Date.now(),
  })
}

export async function compressImages(
  files: File[],
  options?: CompressOptions
): Promise<File[]> {
  return Promise.all(files.map((file) => compressImage(file, options)))
}

export function validateImage(file: File) {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"]

  if (!allowed.includes(file.type)) {
    throw new Error("Solo se permiten imágenes JPG, PNG o WEBP.")
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Cada imagen debe pesar menos de 8 MB.")
  }
}