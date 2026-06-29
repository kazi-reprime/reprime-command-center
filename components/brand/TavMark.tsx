'use client'

// RePrime brand mark — placeholder, replace with final logo asset
export function TavMark({ size = 32, color = '#FFCC33' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="48" height="48" rx="6" stroke={color} strokeWidth="4" />
      <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" fontFamily="Georgia, serif" fontSize="32" fontWeight="700" fill={color}>R</text>
    </svg>
  )
}
