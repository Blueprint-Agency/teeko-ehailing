import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    state: 'in_progress',
    currentStep: 3,
    rejectionReason: null,
  })
}
