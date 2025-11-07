import { useState, useEffect } from "react";
import type { User, Annotation } from "../types";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface PDFViewerProps {
  backendUrl: string;
  documentId: string;
  currentUser: User;
}

export function PDFViewer({
  backendUrl,
  documentId,
  currentUser,
}: PDFViewerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAnnotation, setNewAnnotation] = useState("");
  const [error, setError] = useState("");
  const [numPages, setNumPages] = useState<number>(0);

  const [visibleTo] = useState<string[]>(["A1", "D1", "D2", "R1"]);

  const [tempPosition, setTempPosition] = useState<{
    page: number;
    x: number;
    y: number;
  } | null>(null);

  const handlePdfClick = (event: React.MouseEvent, page: number) => {
    if (currentUser.role === "readonly") return;

    const rect = (event.target as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    setTempPosition({ page, x, y });
  };

  useEffect(() => {
    fetchAnnotations();
  }, [documentId, currentUser.id]);

  const fetchAnnotations = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(`${backendUrl}/api/annotations/${documentId}`, {
        headers: {
          "x-user-id": currentUser.id,
          "x-user-role": currentUser.role,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAnnotations(data.annotations || []);
    } catch {
      setError("Error fetching annotations");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAnnotationWithPosition = async () => {
    if (!newAnnotation.trim() || !tempPosition) return;

    try {
      await fetch(`${backendUrl}/api/annotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id,
          "x-user-role": currentUser.role,
        },
        body: JSON.stringify({
          documentId,
          type: "comment",
          content: newAnnotation,
          position: tempPosition,
          visibleTo,
        }),
      });

      setNewAnnotation("");
      setTempPosition(null);
      fetchAnnotations();
    } catch (err) {
      console.error("Failed to add annotation:", err);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* PDF Viewer */}
      <div className="lg:col-span-2">
        <Card>
          <CardContent className="pt-4">
            <div className="flex justify-center overflow-auto border rounded-lg bg-black/5">
              <Document
                file={`${backendUrl}/api/documents/${documentId}`}
                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                loading={<p className="p-4 text-center">Loading PDF…</p>}
              >
                {Array.from({ length: numPages }, (_, index) => (
                  <div key={index} className="relative mb-4">
                    <Page
                      pageNumber={index + 1}
                      renderTextLayer={false}
                      renderAnnotationLayer={false}
                      scale={1.2}
                      onClick={(e) => handlePdfClick(e, index + 1)}
                      className="cursor-crosshair"
                    />

                    {/* Render Existing Annotations */}
                    {annotations
                      .filter((a) => a.position?.page === index + 1)
                      .map((ann) => (
                        <div
                          key={ann._id}
                          className="absolute bg-yellow-400 w-3 h-3 rounded-full border border-black cursor-pointer"
                          style={{
                            top: `${ann.position.y * 100}%`,
                            left: `${ann.position.x * 100}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                          title={`${ann.createdBy}: ${ann.content}`}
                        />
                      ))}

                    {/* Popup for new annotation */}
                    {tempPosition && tempPosition.page === index + 1 && (
                      <div
                        className="absolute bg-white border border-border shadow-md p-2 rounded-md w-48"
                        style={{
                          top: `${tempPosition.y * 100}%`,
                          left: `${tempPosition.x * 100}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <Textarea
                          className="text-sm"
                          placeholder="Add comment..."
                          value={newAnnotation}
                          onChange={(e) => setNewAnnotation(e.target.value)}
                        />
                        <Button
                          onClick={handleAddAnnotationWithPosition}
                          size="sm"
                          className="w-full mt-2"
                        >
                          Save
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </Document>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Annotation List */}
      <div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <h3 className="font-semibold text-foreground">Annotations</h3>

            {loading ? (
              <p>Loading...</p>
            ) : annotations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No annotations yet.
              </p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {annotations.map((ann) => (
                  <div
                    key={ann._id}
                    className="p-3 bg-muted rounded-lg border border-border"
                  >
                    <p className="text-xs font-medium">{ann.createdBy}</p>
                    <p>{ann.content}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Page {ann.position.page}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
