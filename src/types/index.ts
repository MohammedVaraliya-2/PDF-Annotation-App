export type UserRole = "admin" | "default" | "readonly"

export interface User {
  id: string
  name: string
  role: UserRole
}

export interface Document {
  _id: string
  filename: string
  uploadedBy: string
  uploadDate: string
  size: number
  mimeType: string
}

export interface Annotation {
  _id: string
  documentId: string
  createdBy: string
  type: "highlight" | "comment" | "drawing"
  content: string
  // position varies by annotation type:
  // - highlight: boundingBoxes (array of rects) + page
  // - comment: page + x + y
  // - drawing: page + strokes (array of strokes, each stroke is array of points)
  position: {
    page?: number
    x?: number
    y?: number
    boundingBoxes?: { left: number; top: number; width: number; height: number }[]
    strokes?: { x: number; y: number }[][]
  }
  visibleTo: string[]
  createdAt: string
}