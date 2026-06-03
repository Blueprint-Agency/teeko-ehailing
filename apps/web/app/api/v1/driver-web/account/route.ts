import { NextResponse } from 'next/server'
import profile from '@/data/mock-driver-profile.json'

export async function GET() {
  return NextResponse.json(profile)
}
