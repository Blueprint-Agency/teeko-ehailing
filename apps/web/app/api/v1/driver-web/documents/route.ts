import { NextResponse } from 'next/server'
import documents from '@/data/mock-documents.json'

export async function GET() {
  return NextResponse.json(documents)
}
