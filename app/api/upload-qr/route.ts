import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { errorResponse } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * POST /api/upload-qr
 * Body: { imageBase64: string, walletAddress: string, field: "qr" | "agentQr" }
 * Returns: { url: string }
 */
export async function POST(req: NextRequest) {
  try {
    const { imageBase64, walletAddress, field } = await req.json();

    if (!imageBase64 || !walletAddress) {
      return NextResponse.json(
        { error: "imageBase64 and walletAddress are required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Ensure it's a proper data URI
    const dataUri = imageBase64.startsWith("data:")
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    const publicId = `stl-remit/qr/${walletAddress}_${field ?? "qr"}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      overwrite: true,
      folder: undefined, // public_id already includes folder path
      resource_type: "image",
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    return errorResponse(err);
  }
}
