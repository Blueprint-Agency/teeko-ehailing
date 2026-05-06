import { NextResponse } from 'next/server'
import profile from '@/data/mock-driver-profile.json'

export async function POST() {
  return NextResponse.json({
    id: profile.id,
    phone: profile.phone,
    fullName: profile.fullName,
    locale: 'ms',
  })
}
