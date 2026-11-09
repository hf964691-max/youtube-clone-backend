import { v2 as cloudinary } from "cloudinary";
import fs from "node:fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    // upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // file has been uploaded successfully
    // console.log("File is uploaded on cloudinary", response.url);
    fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove the locally saved temporary file as the upload operation got failed
    return null;
  }
};

const deleteFromCloudinary = async (imageUrl) => {
  if (!imageUrl) return null;

  let url;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error("Invalid Cloudinary asset URL");
  }

  if (url.hostname !== "res.cloudinary.com") {
    throw new Error("Invalid Cloudinary asset URL");
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const uploadIndex = pathParts.indexOf("upload");
  const resourceType = pathParts[uploadIndex - 1];
  const versionIndex = pathParts.findIndex(
    (part, index) => index > uploadIndex && /^v\d+$/.test(part)
  );

  if (
    uploadIndex < 1 ||
    versionIndex < 0 ||
    !["image", "video", "raw"].includes(resourceType)
  ) {
    throw new Error("Invalid Cloudinary asset URL");
  }

  const publicId = decodeURIComponent(
    pathParts.slice(versionIndex + 1).join("/")
  ).replace(/\.[^/.]+$/, "");

  if (!publicId) {
    throw new Error("Invalid Cloudinary asset URL");
  }

  const response = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });

  if (!["ok", "not found"].includes(response.result)) {
    throw new Error(`Cloudinary asset deletion failed: ${response.result}`);
  }

  return response;
};

export { uploadOnCloudinary, deleteFromCloudinary };
