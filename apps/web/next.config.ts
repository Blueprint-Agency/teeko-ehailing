import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  transpilePackages: ['@teeko/shared'],
  outputFileTracingRoot: path.resolve(__dirname, '../..'),
}

export default nextConfig
