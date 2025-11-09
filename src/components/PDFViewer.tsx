import React, { useEffect, useRef, useState } from "react";
import type { User, Annotation } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Document, Page, pdfjs } from "react-pdf";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  MessageSquare,
  Highlighter,
  PenTool,
  Eye,
  X,
  Save,
  User2,
  FileText,
  Palette,
} from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

interface PDFViewerProps {
  backendUrl: string;
  documentId: string;
  currentUser: User;
}

type StrokePoint = { x: number; y: number };
type Stroke = StrokePoint[];
type BoundingBox = { left: number; top: number; width: number; height: number };

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
  const [selectedText, setSelectedText] = useState<{
    text: string;
    page: number;
    boundingBoxes: BoundingBox[];
  } | null>(null);

  const [visibleTo, setVisibleTo] = useState<string[]>([
    "A1",
    "D1",
    "D2",
    "R1",
  ]);
  const [tempPosition, setTempPosition] = useState<{
    page: number;
    x: number;
    y: number;
  } | null>(null);

  // Drawing state
  const [drawingMode, setDrawingMode] = useState(false);
  const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStroke = useRef<Stroke>([]);
  const [currentStrokePage, setCurrentStrokePage] = useState<number | null>(
    null
  );

  // New state for selected annotation
  const [selectedAnnotation, setSelectedAnnotation] =
    useState<Annotation | null>(null);

  // New state for annotation mode (comment or highlight)
  const [annotationMode, setAnnotationMode] = useState<"comment" | "highlight">(
    "comment"
  );

  // Function to get a color for a user
  const getUserColor = (userId: string) => {
    // Simple hash function to generate a color based on user ID
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, 70%, 80%)`;
  };

  // Fetch annotations
  useEffect(() => {
    fetchAnnotations();
    setTempPosition(null);
    setSelectedText(null);
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
      if (!res.ok) throw new Error(data.error || "Failed to fetch annotations");
      setAnnotations(data.annotations || []);
    } catch (err) {
      setError("Error fetching annotations");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    canvasRefs.current = new Array(numPages).fill(null);
  };

  const handlePdfClick = (event: React.MouseEvent, page: number) => {
    if (currentUser.role === "readonly") return;
    if (drawingMode) return;

    const pageDiv = (event.currentTarget as HTMLElement).closest(
      ".pdf-page-wrapper"
    ) as HTMLElement | null;
    const rect = pageDiv
      ? pageDiv.getBoundingClientRect()
      : (event.target as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;

    // Only set tempPosition if in comment mode
    if (annotationMode === "comment") {
      setTempPosition({ page, x, y });
      // Pre-fill with selected text if available
      if (selectedText) {
        setNewAnnotation(selectedText.text);
      } else {
        setNewAnnotation("");
      }
    }
  };

  const handleTextSelection = () => {
    try {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setSelectedText(null);
        return;
      }

      const text = sel.toString().trim();
      if (text.length === 0) {
        setSelectedText(null);
        return;
      }

      const range = sel.getRangeAt(0);

      // Only allow selection from PDF text layer
      const textLayer = (range.commonAncestorContainer as HTMLElement).closest(
        ".react-pdf__Page__textContent"
      );
      if (!textLayer) {
        setSelectedText(null);
        return;
      }

      const pageElement = textLayer.closest(".pdf-page-wrapper");
      if (!pageElement) {
        setSelectedText(null);
        return;
      }

      const pageNumber = parseInt(
        pageElement.getAttribute("data-page-number") || "1",
        10
      );
      const pageRect = pageElement.getBoundingClientRect();

      const rects = range.getClientRects();
      const boundingBoxes: BoundingBox[] = Array.from(rects).map((rect) => ({
        left: (rect.left - pageRect.left) / pageRect.width,
        top: (rect.top - pageRect.top) / pageRect.height,
        width: rect.width / pageRect.width,
        height: rect.height / pageRect.height,
      }));

      if (boundingBoxes.length > 0) {
        setSelectedText({
          text,
          page: pageNumber,
          boundingBoxes,
        });
      } else {
        setSelectedText(null);
      }
    } catch (err) {
      console.error(err);
      setSelectedText(null);
    }
  };

  const handleAddAnnotationWithPosition = async () => {
    if (!newAnnotation.trim() || !tempPosition) return;
    try {
      const resp = await fetch(`${backendUrl}/api/annotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id,
          "x-user-role": currentUser.role,
        },
        body: JSON.stringify({
          documentId,
          type: "comment",
          content: newAnnotation.trim(),
          position: tempPosition,
          visibleTo,
        }),
      });
      const data = await resp.json();
      if (!resp.ok)
        throw new Error(data.error || "Failed to create annotation");
      setNewAnnotation("");
      setTempPosition(null);
      setSelectedText(null); // Clear selected text after saving
      fetchAnnotations();
    } catch (err) {
      console.error(err);
      setError("Failed to add annotation");
    }
  };

  const handleAddHighlight = async () => {
    if (!selectedText) return;
    try {
      const resp = await fetch(`${backendUrl}/api/annotations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id,
          "x-user-role": currentUser.role,
        },
        body: JSON.stringify({
          documentId,
          type: "highlight",
          // Don't save the highlighted text content
          position: {
            page: selectedText.page,
            boundingBoxes: selectedText.boundingBoxes,
          },
          visibleTo,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Failed to create highlight");
      setSelectedText(null);
      setNewAnnotation("");
      fetchAnnotations();
      // Clear selection
      const sel = window.getSelection();
      sel?.removeAllRanges();
    } catch (err) {
      console.error(err);
      setError("Failed to add highlight");
    }
  };

  // Drawing functions
  const startDrawing = (e: React.MouseEvent, page: number) => {
    if (!drawingMode || currentUser.role === "readonly") return;
    setIsDrawing(true);
    setCurrentStrokePage(page);
    currentStroke.current = [];
    const canvas = canvasRefs.current[page - 1];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    currentStroke.current.push({ x, y });
  };

  const draw = (e: React.MouseEvent, page: number) => {
    if (!isDrawing || currentStrokePage !== page) return;
    const canvas = canvasRefs.current[page - 1];
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    currentStroke.current.push({ x, y });

    // Draw the stroke on canvas
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawStrokeOnContext(ctx, currentStroke.current, canvas);
  };

  const stopDrawing = async (page: number) => {
    if (!isDrawing || currentStrokePage !== page) return;
    setIsDrawing(false);
    const stroke = [...currentStroke.current];
    currentStroke.current = [];
    setCurrentStrokePage(null);

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
          type: "drawing",
          content: "",
          position: { page, strokes: [stroke] },
          visibleTo,
        }),
      });
      fetchAnnotations();
    } catch (err) {
      console.error("Failed to save drawing", err);
      setError("Failed to save drawing");
    }
  };

  const drawStrokeOnContext = (
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    canvas: HTMLCanvasElement
  ) => {
    if (!stroke || stroke.length === 0) return;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,0,0,0.8)";
    ctx.lineWidth = Math.max(2, canvas.width * 0.008);

    ctx.beginPath();
    const scaleX = canvas.width;
    const scaleY = canvas.height;
    for (let i = 0; i < stroke.length; i++) {
      const p = stroke[i];
      const px = p.x * scaleX;
      const py = p.y * scaleY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  };

  // Redraw all drawings for each page
  useEffect(() => {
    const redrawDrawings = () => {
      for (let p = 1; p <= numPages; p++) {
        const canvas = canvasRefs.current[p - 1];
        if (!canvas) continue;

        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const width = Math.max(1, Math.floor(rect.width * dpr));
        const height = Math.max(1, Math.floor(rect.height * dpr));

        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        // Clear the canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw each annotation of type drawing for this page
        const drawings = annotations.filter(
          (a) => a.type === "drawing" && a.position?.page === p
        );

        for (const d of drawings) {
          const strokes: Stroke[] = d.position?.strokes || [];
          for (const s of strokes) {
            drawStrokeOnContext(ctx, s, canvas);
          }
        }
      }
    };

    redrawDrawings();
  }, [annotations, numPages]);

  const toggleVisibilityRole = (role: string) => {
    setVisibleTo((prev) => {
      if (prev.includes(role)) return prev.filter((r) => r !== role);
      return [...prev, role];
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg">
                <FileText className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  PDF Annotation System
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Document ID: {documentId}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg">
                <User2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  {currentUser.id}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {currentUser.role}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Responsive Design */}
      <main className="flex-1 overflow-auto p-2 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto h-full flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* PDF Viewer Section */}
          <div className="w-full lg:w-2/3 flex flex-col min-h-[70vh] md:min-h-[75vh] lg:min-h-[80vh]">
            <Card className="flex-1 flex flex-col shadow-lg border-0 bg-white dark:bg-slate-800 overflow-hidden">
              {/* Sticky Header */}
              <CardHeader className="pb-3 flex-shrink-0 sticky top-0 bg-white dark:bg-slate-800 z-10 border-b border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Document Viewer
                  </CardTitle>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Drawing Mode Toggle */}
                    <Button
                      onClick={() => setDrawingMode((s) => !s)}
                      size="sm"
                      variant={drawingMode ? "default" : "outline"}
                      className="gap-1"
                    >
                      <PenTool className="h-4 w-4" />
                      {drawingMode ? "Exit Draw" : "Draw"}
                    </Button>

                    {/* Annotation Mode Toggle */}
                    <div className="flex border rounded-md overflow-hidden">
                      <Button
                        size="sm"
                        variant={
                          annotationMode === "comment" ? "default" : "ghost"
                        }
                        className="rounded-none gap-1"
                        onClick={() => setAnnotationMode("comment")}
                      >
                        <MessageSquare className="h-4 w-4" />
                        <span className="hidden sm:inline">Comment</span>
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          annotationMode === "highlight" ? "default" : "ghost"
                        }
                        className="rounded-none gap-1"
                        onClick={() => setAnnotationMode("highlight")}
                      >
                        <Highlighter className="h-4 w-4" />
                        <span className="hidden sm:inline">Highlight</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Scrollable PDF Content */}
              <CardContent
                className="flex-1 p-0 overflow-y-auto relative"
                style={{
                  minHeight: "60vh", // minimum height on small screens
                  maxHeight: "calc(100vh - 100px)", // make it scrollable in mobile/tablet
                }}
              >
                <div
                  className="relative select-text p-4"
                  onMouseUp={() => {
                    setTimeout(handleTextSelection, 10);
                  }}
                  style={{ minHeight: 400 }}
                >
                  <Document
                    file={`${backendUrl}/api/documents/${documentId}`}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                      <div className="flex items-center justify-center h-96">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                          <p className="mt-4 text-slate-600 dark:text-slate-400">
                            Loading PDF…
                          </p>
                        </div>
                      </div>
                    }
                  >
                    {Array.from({ length: numPages }, (_, index) => (
                      <div
                        key={index}
                        className="pdf-page-wrapper relative mb-6 bg-white dark:bg-slate-700 shadow-md rounded-lg overflow-hidden mx-auto"
                        style={{
                          display: "block",
                          position: "relative",
                          width: "100%",
                          maxWidth: "min(900px, 100%)",
                        }}
                        data-page-number={index + 1}
                      >
                        <div className="relative flex justify-center w-full">
                          <Page
                            pageNumber={index + 1}
                            renderTextLayer={true}
                            renderAnnotationLayer={false}
                            scale={1.2}
                            width={Math.min(800, window.innerWidth - 100)}
                            className="cursor-crosshair w-full"
                            onClick={(e) => handlePdfClick(e as any, index + 1)}
                          />
                        </div>

                        {/* Canvas overlay for drawing */}
                        <canvas
                          ref={(el) => {
                            canvasRefs.current[index] = el;
                          }}
                          className="absolute top-0 left-0 w-full h-full"
                          style={{
                            pointerEvents: drawingMode ? "auto" : "none",
                            zIndex: drawingMode ? 20 : 5,
                          }}
                          onMouseDown={(e) => startDrawing(e as any, index + 1)}
                          onMouseMove={(e) => draw(e as any, index + 1)}
                          onMouseUp={() => stopDrawing(index + 1)}
                          onMouseLeave={() => {
                            if (isDrawing) stopDrawing(index + 1);
                          }}
                        />

                        {/* Render existing comments pins */}
                        {annotations
                          .filter(
                            (a) =>
                              a.type === "comment" &&
                              a.position?.page === index + 1
                          )
                          .map((ann) => (
                            <div
                              key={ann._id}
                              className="absolute bg-yellow-400 w-5 h-5 rounded-full border-2 border-white shadow-md cursor-pointer flex items-center justify-center"
                              style={{
                                top: `${(ann.position?.y ?? 0) * 100}%`,
                                left: `${(ann.position?.x ?? 0) * 100}%`,
                                transform: "translate(-50%, -50%)",
                                zIndex: 10,
                              }}
                              title={`${ann.createdBy}: ${ann.content}`}
                              onClick={() => setSelectedAnnotation(ann)}
                            >
                              <MessageSquare className="h-3 w-3 text-white" />
                            </div>
                          ))}

                        {/* Render highlights with user labels */}
                        {annotations
                          .filter(
                            (a) =>
                              a.type === "highlight" &&
                              a.position?.page === index + 1 &&
                              a.position?.boundingBoxes
                          )
                          .map((ann) => (
                            <React.Fragment key={ann._id}>
                              {ann.position?.boundingBoxes?.map(
                                (
                                  box: {
                                    left: number;
                                    top: number;
                                    width: number;
                                    height: number;
                                  },
                                  boxIndex: any
                                ) => (
                                  <React.Fragment
                                    key={`${ann._id}-${boxIndex}`}
                                  >
                                    {/* Highlight box */}
                                    <div
                                      className="absolute"
                                      style={{
                                        left: `${box.left * 100}%`,
                                        top: `${box.top * 100}%`,
                                        width: `${box.width * 100}%`,
                                        height: `${box.height * 100}%`,
                                        backgroundColor: getUserColor(
                                          ann.createdBy
                                        ),
                                        opacity: 0.2,
                                        pointerEvents: "none",
                                      }}
                                    />
                                    {/* User label at the left of the highlight */}
                                    <div
                                      className="absolute flex items-center justify-center rounded-full text-xs font-bold text-white shadow-md"
                                      style={{
                                        left: `${(box.left - 0.02) * 100}%`,
                                        top: `${
                                          (box.top + box.height / 2) * 100
                                        }%`,
                                        transform: "translate(-50%, -50%)",
                                        backgroundColor: getUserColor(
                                          ann.createdBy
                                        ),
                                        width: "20px",
                                        height: "20px",
                                        zIndex: 15,
                                      }}
                                      title={`${ann.createdBy} highlighted this text`}
                                    >
                                      {ann.createdBy.charAt(0)}
                                    </div>
                                  </React.Fragment>
                                )
                              )}
                            </React.Fragment>
                          ))}

                        {/* Popup for new comment at clicked position - only in comment mode */}
                        {tempPosition &&
                          tempPosition.page === index + 1 &&
                          !drawingMode &&
                          annotationMode === "comment" && (
                            <div
                              className="absolute bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl p-4 w-72 z-20"
                              style={{
                                top: `${tempPosition.y * 100}%`,
                                left: `${tempPosition.x * 100}%`,
                                transform: "translate(-50%, -50%)",
                              }}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <MessageSquare className="h-4 w-4 text-indigo-600" />
                                <h4 className="font-medium text-slate-900 dark:text-white">
                                  Add Comment
                                </h4>
                              </div>
                              <Textarea
                                className="text-sm mb-3"
                                placeholder="Add comment..."
                                value={newAnnotation}
                                onChange={(e) =>
                                  setNewAnnotation(e.target.value)
                                }
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={handleAddAnnotationWithPosition}
                                  size="sm"
                                  className="flex-1 gap-1"
                                >
                                  <Save className="h-4 w-4" />
                                  Save
                                </Button>
                                <Button
                                  onClick={() => {
                                    setTempPosition(null);
                                    setNewAnnotation("");
                                    setSelectedText(null);
                                  }}
                                  variant="outline"
                                  size="sm"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}

                        {/* Popup for highlight at selected text position - only in highlight mode */}
                        {selectedText &&
                          selectedText.page === index + 1 &&
                          !drawingMode &&
                          annotationMode === "highlight" && (
                            <div
                              className="absolute bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-xl p-4 w-72 z-20"
                              style={{
                                top: `${
                                  selectedText.boundingBoxes[0].top * 100
                                }%`,
                                left: `${
                                  selectedText.boundingBoxes[0].left * 100
                                }%`,
                                transform: "translate(-50%, -50%)",
                              }}
                            >
                              <div className="flex items-center gap-2 mb-3">
                                <Highlighter className="h-4 w-4 text-indigo-600" />
                                <h4 className="font-medium text-slate-900 dark:text-white">
                                  Save Highlight
                                </h4>
                              </div>
                              <div className="text-sm mb-3 p-2 bg-slate-100 dark:bg-slate-700 rounded">
                                {selectedText.text}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={handleAddHighlight}
                                  size="sm"
                                  className="flex-1 gap-1"
                                >
                                  <Save className="h-4 w-4" />
                                  Save
                                </Button>
                                <Button
                                  onClick={() => {
                                    setSelectedText(null);
                                    setNewAnnotation("");
                                  }}
                                  variant="outline"
                                  size="sm"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                      </div>
                    ))}
                  </Document>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Annotation Panel - Responsive */}
          <div className="w-full lg:w-1/3 flex flex-col gap-4 md:gap-6 min-h-0">
            {/* Annotation Controls */}
            <Card className="shadow-lg border-0 bg-white dark:bg-slate-800 flex-shrink-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Annotation Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Visibility Settings */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      Visibility
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["A1", "D1", "D2", "R1"].map((r) => (
                      <label
                        key={r}
                        className="inline-flex items-center gap-1.5 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={visibleTo.includes(r)}
                          onChange={() => toggleVisibilityRole(r)}
                          disabled={currentUser.role === "readonly"}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-slate-700 dark:text-slate-300">
                          {r}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Manual comment input (without clicking) - only in comment mode */}
                {currentUser.role !== "readonly" &&
                  annotationMode === "comment" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          Add Comment
                        </span>
                      </div>
                      <Textarea
                        placeholder="Add a comment..."
                        value={newAnnotation}
                        onChange={(e) => setNewAnnotation(e.target.value)}
                        className="text-sm"
                      />
                      <Button
                        onClick={() => {
                          setTempPosition({ page: 1, x: 0.1, y: 0.1 });
                          handleAddAnnotationWithPosition();
                        }}
                        size="sm"
                        className="w-full gap-1"
                      >
                        <Save className="h-4 w-4" />
                        Add Comment
                      </Button>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* Annotations List */}
            <Card className="shadow-lg border-0 bg-white dark:bg-slate-800 flex flex-col flex-1 lg:flex-initial lg:h-[500px] min-h-[400px]">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Annotations
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0 flex flex-col min-h-0">
                <Tabs defaultValue="all" className="h-full flex flex-col">
                  <TabsList className="grid w-full grid-cols-3 mb-0 flex-shrink-0 mx-2 mt-2">
                    <TabsTrigger value="all" className="text-xs">
                      All
                    </TabsTrigger>
                    <TabsTrigger value="comments" className="text-xs">
                      Comments
                    </TabsTrigger>
                    <TabsTrigger value="highlights" className="text-xs">
                      Highlights
                    </TabsTrigger>
                  </TabsList>

                  <div className="flex-1 overflow-y-auto px-2 pb-2 min-h-0">
                    <TabsContent value="all" className="mt-0 space-y-3">
                      {loading ? (
                        <div className="flex items-center justify-center h-32">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                              Loading annotations...
                            </p>
                          </div>
                        </div>
                      ) : annotations.length === 0 ? (
                        <div className="text-center py-8">
                          <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            No annotations yet.
                          </p>
                        </div>
                      ) : (
                        annotations.map((ann) => (
                          <div
                            key={ann._id}
                            className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            onClick={() => setSelectedAnnotation(ann)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium"
                                  style={{
                                    backgroundColor: getUserColor(
                                      ann.createdBy
                                    ),
                                  }}
                                >
                                  {ann.createdBy.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {ann.createdBy}
                                  </p>
                                  <div className="flex items-center gap-1 mt-1">
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      {ann.type}
                                    </Badge>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                      Page {ann.position?.page ?? "-"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {ann.content && (
                              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                                {ann.content}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="comments" className="mt-0 space-y-3">
                      {annotations
                        .filter((a) => a.type === "comment")
                        .map((ann) => (
                          <div
                            key={ann._id}
                            className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            onClick={() => setSelectedAnnotation(ann)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium"
                                  style={{
                                    backgroundColor: getUserColor(
                                      ann.createdBy
                                    ),
                                  }}
                                >
                                  {ann.createdBy.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {ann.createdBy}
                                  </p>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Page {ann.position?.page ?? "-"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {ann.content && (
                              <p className="mt-2 text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                                {ann.content}
                              </p>
                            )}
                          </div>
                        ))}
                    </TabsContent>

                    <TabsContent value="highlights" className="mt-0 space-y-3">
                      {annotations
                        .filter((a) => a.type === "highlight")
                        .map((ann) => (
                          <div
                            key={ann._id}
                            className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            onClick={() => setSelectedAnnotation(ann)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-medium"
                                  style={{
                                    backgroundColor: getUserColor(
                                      ann.createdBy
                                    ),
                                  }}
                                >
                                  {ann.createdBy.charAt(0)}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                                    {ann.createdBy}
                                  </p>
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    Page {ann.position?.page ?? "-"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                              <div className="flex items-center gap-1">
                                <Highlighter className="h-3 w-3" />
                                <span>Text highlighted by user</span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Annotation Detail Modal */}
      {selectedAnnotation && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Annotation Details
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAnnotation(null)}
                  className="h-8 w-8 p-0 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div
                  className="h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{
                    backgroundColor: getUserColor(selectedAnnotation.createdBy),
                  }}
                >
                  {selectedAnnotation.createdBy.charAt(0)}
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-900 dark:text-white">
                    {selectedAnnotation.createdBy}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="capitalize">
                      {selectedAnnotation.type}
                    </Badge>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      Page {selectedAnnotation.position?.page ?? "-"}
                    </span>
                  </div>
                </div>
              </div>

              {selectedAnnotation.content &&
                selectedAnnotation.type !== "highlight" && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                      Content
                    </h4>
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                      <p className="text-slate-700 dark:text-slate-300">
                        {selectedAnnotation.content}
                      </p>
                    </div>
                  </div>
                )}

              {selectedAnnotation.type === "highlight" && (
                <div>
                  <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                    Highlight
                  </h4>
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
                    <p className="text-slate-700 dark:text-slate-300">
                      Text highlighted by {selectedAnnotation.createdBy}
                    </p>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                  Visible To
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedAnnotation.visibleTo?.map((role) => (
                    <Badge key={role} variant="outline" className="text-xs">
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700">
              <Button
                onClick={() => setSelectedAnnotation(null)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
