import { S3 } from "aws-sdk";
import { bucket_name, s3Conifg } from "./s3";

export const uploadImageToS3 = async (file: Express.Multer.File): Promise<string> => {
    try {
        if (!file || !file.buffer) {
            throw new Error("No file buffer provided");
        }

        const fileName = `profilepictures/${Date.now()}-${file.originalname.replace(/\s/g, "_")}`;

        const params: S3.PutObjectRequest = {
            Bucket: bucket_name,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
        };

        const uploadResult = await s3Conifg.upload(params).promise();
        return uploadResult.Key;

    } catch (error) {
        console.error("S3 Upload Error:", error);
        throw new Error("File upload failed");
    }
};

export const getPresignedUrl = async (fileName: string) => {
    try {
        const params = {
            Bucket: bucket_name,
            Key: fileName,
            Expires: 60 * 5,
        };

        return s3Conifg.getSignedUrlPromise("getObject", params);
    } catch (err) {
        console.error("S3 get Error:", err);
        throw new Error("File get failed");
    }
};

export const deleteImageFromS3 = async (fileName: string) => {
    try {
        const params = {
            Bucket: bucket_name,
            Key: fileName,
        };

        return s3Conifg.deleteObject(params).promise();

    } catch (err) {
        console.error("S3 delete Error:", err);
        throw new Error("File delete failed");
    }
};

export const uploadCSVToS3 = async (
  campaignId: string,
  file: Express.Multer.File
): Promise<string> => {
  try {
    console.log("Environment variables:", process.env);
    if (!file || !file.buffer) {
      throw new Error("No file buffer provided");
    }

    const folderPath = `csvFiles/${campaignId}/`;

    // **Step 1: Check if CSV exists**
    const listParams: AWS.S3.ListObjectsV2Request = {
      Bucket: bucket_name,
      Prefix: folderPath, // Look for files in the campaign's folder
    };

    const listedObjects = await s3Conifg.listObjectsV2(listParams).promise();

    if (listedObjects.Contents && listedObjects.Contents.length > 0) {
      // **Step 2: Delete existing CSV files**
      const deleteParams: AWS.S3.DeleteObjectsRequest = {
        Bucket: bucket_name,
        Delete: {
          Objects: listedObjects.Contents.map((obj) => ({ Key: obj.Key! })),
        },
      };

      await s3Conifg.deleteObjects(deleteParams).promise();
      console.log(`Deleted existing CSV files for campaign ${campaignId}`);
    }

    // **Step 3: Upload the new CSV file**
    const fileName = `${folderPath}${Date.now()}-${file.originalname.replace(/\s/g, "_")}`;

    const uploadParams: AWS.S3.PutObjectRequest = {
      Bucket: bucket_name,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const uploadResult = await s3Conifg.upload(uploadParams).promise();
    console.log(`Uploaded new CSV: ${uploadResult.Key}`);

    return uploadResult.Key;
  } catch (error) {
    console.log("Environment variables:", process.env);
    console.error("S3 Upload Error:", error);
    throw new Error("File upload failed");
  }
};


