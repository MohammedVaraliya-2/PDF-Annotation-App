import type { User, Document } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DocumentListProps {
  documents: Document[];
  currentUser: User;
  onSelectDoc: (docId: string) => void;
}

export function DocumentList({
  documents,
  currentUser,
  onSelectDoc,
}: DocumentListProps) {
  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 w-full">
        <p className="text-center text-gray-500 dark:text-gray-400 text-lg">
          No documents uploaded yet.
        </p>
        {currentUser.role === "admin" && (
          <p className="mt-2 text-center text-gray-400">
            Upload a PDF to get started.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
      {documents.map((doc) => (
        <Card
          key={doc._id}
          className="flex flex-col justify-between hover:shadow-lg transition-shadow duration-200 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 w-full"
        >
          <CardContent className="flex flex-col gap-3 p-5">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white break-all">
                {doc.filename}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Uploaded by{" "}
                <span className="font-medium">{doc.uploadedBy}</span> on{" "}
                {new Date(doc.uploadDate).toLocaleDateString()}
              </p>
              {doc.size && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Size: {(doc.size / 1024).toFixed(2)} KB
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => onSelectDoc(doc._id)}
                size="sm"
                variant="default"
              >
                View & Annotate
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
