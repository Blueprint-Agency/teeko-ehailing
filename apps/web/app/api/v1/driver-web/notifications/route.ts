import { NextResponse } from 'next/server'
import notificationsData from '@/data/mock-notifications.json'

// In-memory state for this dev session
const notifications = notificationsData.map((n) => ({ ...n }))

export async function GET() {
  return NextResponse.json(notifications)
}
