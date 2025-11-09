import { useEffect, useRef, useState } from "react";
import type { Annotation, User } from "@/types";

type StrokePoint = { x: number; y: number };
type Stroke = StrokePoint[];
type BoundingBox = { left: number; top: number; width: number; height: number };

export function usePdfAnnotations(
   backendUrl: string,
   documentId: string,
   currentUser: User
) {
   const [annotations, setAnnotations] = useState<Annotation[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);

   // new annotation inputs
   const [newAnnotation, setNewAnnotation] = useState("");
   const [selectedText, setSelectedText] = useState<{
      text: string;
      page: number;
      boundingBoxes: BoundingBox[];
   } | null>(null);
   const [tempPosition, setTempPosition] = useState<{
      page: number;
      x: number;
      y: number;
   } | null>(null);
   const [visibleTo, setVisibleTo] = useState(["A1", "D1", "D2", "R1"]);

   const [drawingMode, setDrawingMode] = useState(false);
   const [isDrawing, setIsDrawing] = useState(false);
   const currentStroke = useRef<Stroke>([]);
   const [currentStrokePage, setCurrentStrokePage] = useState<number | null>(
      null
   );
   const canvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);

   /** Fetch all annotations */
   const fetchAnnotations = async () => {
      try {
         setLoading(true);
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
         console.error(err);
         setError("Failed to fetch annotations");
      } finally {
         setLoading(false);
      }
   };

   /** Add a comment annotation */
   const addComment = async () => {
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
         if (!resp.ok) throw new Error(data.error || "Failed to create annotation");
         setNewAnnotation("");
         setTempPosition(null);
         setSelectedText(null);
         fetchAnnotations();
      } catch (err) {
         console.error(err);
         setError("Failed to add annotation");
      }
   };

   /** Add highlight annotation */
   const addHighlight = async () => {
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
               content: selectedText.text,
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
      } catch (err) {
         console.error(err);
         setError("Failed to add highlight");
      }
   };

   /** Toggle visibility roles */
   const toggleVisibilityRole = (role: string) => {
      setVisibleTo((prev) =>
         prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
      );
   };

   /** Drawing helpers */
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
         console.error(err);
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

   useEffect(() => {
      fetchAnnotations();
   }, [documentId, currentUser.id]);

   return {
      annotations,
      loading,
      error,
      newAnnotation,
      setNewAnnotation,
      selectedText,
      setSelectedText,
      tempPosition,
      setTempPosition,
      visibleTo,
      toggleVisibilityRole,
      addComment,
      addHighlight,
      drawingMode,
      setDrawingMode,
      startDrawing,
      draw,
      stopDrawing,
      canvasRefs,
   };
}
