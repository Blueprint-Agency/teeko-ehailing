import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params
  return NextResponse.json({ url: `https://mock-storage.teeko.dev/documents/${kind}/mock-upload.jpg` })
}
