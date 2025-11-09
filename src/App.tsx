import { useEffect, useState } from "react";
import { UserSwitcher } from "@/components/UserSwitcher";
import { DocumentUpload } from "@/components/DocumentUpload";
import { DocumentList } from "@/components/DocumentList";
import { PDFViewer } from "@/components/PDFViewer";
import { Button } from "@/components/ui/button";
import type { User } from "@/types";

const BACKEND_URL = "https://pdf-annotation-app.onrender.com";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User>({
    id: "A1",
    name: "Admin",
    role: "admin", // admin | default | readonly
  });

  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      setError(null);

      const res = await fetch(`${BACKEND_URL}/api/documents`, {
        headers: {
          "x-user-id": currentUser.id,
          "x-user-role": currentUser.role,
        },
      });

      const data = await res.json();
      if (res.ok) {
        setDocuments(data.documents || []);
      } else {
        setError(data.error || "Failed to fetch documents");
      }
    } catch (err) {
      setError("Network error while fetching documents");
    } finally {
      setLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [currentUser]);

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              PDF Annotator
            </h1>
            <p className="text-sm text-muted-foreground">
              Collaborate on documents with role-based access
            </p>
          </div>

          <UserSwitcher
            currentUser={currentUser}
            onUserChange={setCurrentUser}
          />
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="lg:max-w-3/4 mx-auto px-4 py-8">
        {selectedDoc ? (
          <>
            <Button
              variant="outline"
              onClick={() => setSelectedDoc(null)}
              className="mb-4"
            >
              ← Back to Documents
            </Button>

            <PDFViewer
              documentId={selectedDoc}
              currentUser={currentUser}
              backendUrl={BACKEND_URL}
            />
          </>
        ) : (
          <div className="w-full max-w-7xl mx-auto px-4 py-8">
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-xl p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
              {/* LEFT PANEL: Upload (Admin Only) */}
              {currentUser.role === "admin" && (
                <div className="w-full lg:w-1/4">
                  <DocumentUpload
                    backendUrl={BACKEND_URL}
                    currentUser={currentUser}
                    onUploadSuccess={fetchDocuments}
                  />
                </div>
              )}

              {/* RIGHT PANEL: Document List */}
              <div
                className={`w-full ${
                  currentUser.role === "admin" ? "lg:w-3/4" : "lg:w-full"
                }`}
              >
                {loadingDocs ? (
                  <p className="text-gray-500 dark:text-gray-400 text-center py-6">
                    Loading documents...
                  </p>
                ) : error ? (
                  <p className="text-red-500 text-center py-6">{error}</p>
                ) : (
                  <DocumentList
                    currentUser={currentUser}
                    documents={documents}
                    onSelectDoc={setSelectedDoc}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
