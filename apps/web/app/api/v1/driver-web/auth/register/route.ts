import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ message: 'Registration OTP sent', devOtp: '654321' })
}
