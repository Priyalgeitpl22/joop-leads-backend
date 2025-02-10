import AWS, { S3 } from "aws-sdk";
import { bucket_name } from "./s3";

const s3 = new AWS.S3();

export const uploadImageToS3 = async (file: Express.Multer.File): Promise<string> => {
    try {
        if (!file || !file.buffer) {
            throw new Error("No file buffer provided");
        }

        const fileName = `profilepictures/${Date.now()}-${file.originalname.replace(/\s/g, "_")}`;

        const params: S3.PutObjectRequest = {
            Bucket: process.env.AWS_BUCKET_NAME!,
            Key: fileName,
            Body: file.buffer,
            ContentType: file.mimetype,
        };

        const uploadResult = await s3.upload(params).promise();
        
        console.log("File uploaded successfully:", uploadResult.Key);
        return uploadResult.Key;

    } catch (error) {
        console.error("S3 Upload Error:", error);
        throw new Error("File upload failed");
    }
};


export const getPresignedUrl = async (fileName: string) => {
    const params = {
        Bucket: bucket_name,
        Key: fileName,
        Expires: 60 * 5,
    };

    return s3.getSignedUrlPromise("getObject", params);
};

export const deleteImageFromS3 = async (fileName: string) => {
    const params = {
        Bucket: bucket_name,
        Key: fileName,
    };

    return s3.deleteObject(params).promise();
};
