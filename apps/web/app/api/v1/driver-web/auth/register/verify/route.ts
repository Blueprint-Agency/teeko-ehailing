import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { phone = '0112345678', fullName = 'New Driver' } = body as Record<string, string>
  return NextResponse.json({
    id: `drv_mock_${Date.now()}`,
    phone,
    fullName,
  })
}
