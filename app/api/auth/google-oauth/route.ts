import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Google OAuth Token Generator
 * 
 * GET /api/auth/google-oauth → returns the authorization URL to visit
 * GET /api/auth/google-oauth?code=XXX → exchanges code for tokens
 * 
 * Steps:
 * 1. Visit the URL returned by GET (no params)
 * 2. Sign in with the Google account you want to authorize
 * 3. Copy the refresh_token from the response
 * 4. Set it as GOOGLE_REFRESH_TOKEN (for fst) or GOOGLE_REFRESH_TOKEN_2 (for reprime)
 */

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/contacts.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  
  if (!clientId || !clientSecret) {
    return NextResponse.json({ 
      error: 'Google OAuth not configured',
      missing: !clientId ? 'GOOGLE_OAUTH_CLIENT_ID' : 'GOOGLE_OAUTH_CLIENT_SECRET',
    }, { status: 500 })
  }

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')
  
  // If there's an error from Google
  if (error) {
    return NextResponse.json({ error: `Google OAuth error: ${error}` }, { status: 400 })
  }

  // Step 2: Exchange authorization code for tokens
  if (code) {
    const redirectUri = `${url.origin}/api/auth/google-oauth`
    
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json()
    
    if (!tokenRes.ok) {
      return NextResponse.json({
        error: 'Token exchange failed',
        details: tokenData,
      }, { status: 400 })
    }

    // Get the email of the authenticated user
    let email = 'unknown'
    try {
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const profile = await profileRes.json()
      email = profile.email || 'unknown'
    } catch { /* ignore */ }

    // Determine which env var to use
    const envVar = email.includes('reprime.com') ? 'GOOGLE_REFRESH_TOKEN_2' : 'GOOGLE_REFRESH_TOKEN'

    return NextResponse.json({
      success: true,
      email,
      refresh_token: tokenData.refresh_token,
      access_token: tokenData.access_token ? '***REDACTED***' : null,
      expires_in: tokenData.expires_in,
      scope: tokenData.scope,
      instructions: {
        env_var: envVar,
        step_1: `Copy the refresh_token above`,
        step_2: `Set it as ${envVar} in your .env.local file`,
        step_3: `Run: vercel env add ${envVar}`,
        step_4: `Paste the token when prompted`,
        step_5: `Redeploy: vercel --prod --yes`,
      },
    })
  }

  // Step 1: Generate authorization URL
  const redirectUri = `${url.origin}/api/auth/google-oauth`
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES.join(' '))
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')  // Force consent to get refresh_token
  authUrl.searchParams.set('include_granted_scopes', 'true')

  return NextResponse.json({
    message: 'Visit the authorization URL below in your browser',
    instructions: [
      '1. Click the auth_url link below',
      '2. Sign in with g@reprime.com OR g@floridastatetrust.com',
      '3. Grant all permissions',
      '4. You will be redirected back here with the refresh token',
      '5. Repeat for the second account',
    ],
    auth_url: authUrl.toString(),
    redirect_uri: redirectUri,
    scopes: SCOPES,
    note: 'IMPORTANT: Make sure the redirect URI is added in Google Cloud Console → OAuth 2.0 Client → Authorized redirect URIs',
    required_redirect_uris: [
      `${url.origin}/api/auth/google-oauth`,
      'http://localhost:3000/api/auth/google-oauth',
    ],
  })
}
