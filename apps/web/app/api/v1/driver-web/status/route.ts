import { NextResponse } from 'next/server'
import status from '@/data/mock-application-status.json'

export async function GET() {
  return NextResponse.json(status)
}
