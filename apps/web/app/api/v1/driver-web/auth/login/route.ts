import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ message: 'OTP sent', devOtp: '123456' })
}
