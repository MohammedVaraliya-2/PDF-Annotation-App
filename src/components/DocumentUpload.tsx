import type React from "react";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import type { User } from "../types";

interface DocumentUploadProps {
  backendUrl: string;
  currentUser: User;
  onUploadSuccess: () => void; // We will refresh document list after upload
}

export function DocumentUpload({
  backendUrl,
  currentUser,
  onUploadSuccess,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("files", files[i]); // ✅ must match backend multer config
      }

      const response = await fetch(`${backendUrl}/api/documents/upload`, {
        method: "POST",
        headers: {
          "x-user-id": currentUser.id,
          "x-user-role": currentUser.role,
          // ❗ Do NOT set Content-Type here. Browser sets it automatically for FormData.
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed");

      // Refresh document list after upload
      onUploadSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload Documents</CardTitle>
        <CardDescription>
          {currentUser.role !== "admin"
            ? "Only admins can upload documents."
            : "Upload one or more PDF files."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {currentUser.role !== "admin" ? (
          <p className="text-sm text-muted-foreground">
            You do not have permission to upload documents.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
              <input
                type="file"
                multiple
                accept="application/pdf"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer block">
                <p className="text-sm font-medium text-foreground">
                  Click to upload PDFs
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  or drag and drop here
                </p>
              </label>
            </div>

            {uploading && (
              <p className="text-sm text-muted-foreground">Uploading...</p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
