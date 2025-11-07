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
  position: {
    page: number
    x: number
    y: number
  }
  visibleTo: string[]
  createdAt: string
}