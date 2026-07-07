/**
 * Gateway Health API
 * 
 * Returns truthful health status for all registered providers.
 * Replaces the env-var checking health endpoint with live probing.
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { initializeGateway, gateway } = await import('@/lib/gateway')

    // Ensure providers are registered
    await initializeGateway()

    const report = gateway.getHealth()

    // Build response compatible with existing HealthPill component
    const services: Record<string, { status: string; message?: string; latencyMs?: number }> = {}
    
    for (const p of report.providers) {
      services[p.providerId] = {
        status: p.health.state === 'healthy' ? 'ok' :
                p.health.state === 'not_configured' ? 'not_configured' :
                p.health.state === 'degraded' ? 'degraded' : 'error',
        message: p.health.errorMessage,
        latencyMs: p.health.latencyMs,
      }
    }

    // Aggregate capability availability
    const capabilities = {
      whatsapp: gateway.hasCapability('whatsapp:send'),
      email: gateway.hasCapability('email:send'),
      ai: gateway.hasCapability('ai:chat'),
      stt: gateway.hasCapability('stt:transcribe'),
      tts: gateway.hasCapability('tts:synthesize'),
      calendar: !!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'mock',
      zoom: !!process.env.ZOOM_ACCOUNT_ID && !!process.env.ZOOM_CLIENT_ID,
    }

    return NextResponse.json({
      overall: report.overall,
      timestamp: report.timestamp,
      capabilities,
      providers: report.providers.map(p => ({
        id: p.providerId,
        name: p.name,
        capabilities: p.capabilities,
        state: p.health.state,
        latencyMs: p.health.latencyMs,
        failureStreak: p.health.failureStreak,
        circuitBreaker: p.circuitBreaker.state,
        lastSuccessAt: p.health.lastSuccessAt,
        lastFailureAt: p.health.lastFailureAt,
        error: p.health.errorMessage,
      })),
      services, // backward compat with existing HealthPill
    })
  } catch (err) {
    return NextResponse.json(
      { overall: 'critical', error: (err as Error).message },
      { status: 500 },
    )
  }
}
