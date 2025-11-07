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
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">
            No documents uploaded yet.{" "}
          </p>
          {currentUser.role === "admin" && <p> Upload a PDF to get started.</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <h2 className="text-xl font-semibold text-foreground">Documents</h2>

      {documents.map((doc) => (
        <Card
          key={doc._id}
          className="hover:shadow-md transition-shadow border border-border"
        >
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
              {/* Document Details */}
              <div>
                <h3 className="font-medium text-foreground break-all">
                  {doc.filename}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Uploaded by{" "}
                  <span className="font-medium">{doc.uploadedBy}</span> on{" "}
                  {new Date(doc.uploadDate).toLocaleDateString()}
                </p>
                {doc.size && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Size: {(doc.size / 1024).toFixed(2)} KB
                  </p>
                )}
              </div>

              {/* Action Button */}
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
