'use client'

import React, { useState, useMemo } from 'react'
import { Card, ActionButton } from '@/components/ui/shared'
import { useToast } from '@/lib/contexts/ToastContext'

export default function LOIPage() {
  const { addToast } = useToast()

  // Identity
  const [stealthCompany, setStealthCompany] = useState('')
  const [signatoryName, setSignatoryName] = useState('')
  const [signatoryTitle, setSignatoryTitle] = useState('')
  const [footerContact, setFooterContact] = useState('')

  // Deal
  const [propertyName, setPropertyName] = useState('')
  const [propertyAddress, setPropertyAddress] = useState('')
  const [sellerEntity, setSellerEntity] = useState('')

  // Underwriting
  const [noi, setNoi] = useState('')
  const [capRate, setCapRate] = useState('9.5')
  const [sqft, setSqft] = useState('')
  const [occupancy, setOccupancy] = useState('')

  // Terms
  const [earnest, setEarnest] = useState('100000')
  const [inspectionDays, setInspectionDays] = useState('30')
  const [extensionDays, setExtensionDays] = useState('30')
  const [closingDays, setClosingDays] = useState('30')
  const [validDays, setValidDays] = useState('7')
  const [escrowHolder, setEscrowHolder] = useState('an attorney escrow account to be designated')

  // Offer type
  const [offerType, setOfferType] = useState<'single' | 'dual'>('single')

  const impliedPrice = useMemo(() => {
    const n = parseFloat(noi) || 0
    const c = parseFloat(capRate) || 9.5
    return c > 0 ? Math.round(n / (c / 100)) : 0
  }, [noi, capRate])

  const pricePerSF = useMemo(() => {
    const sf = parseFloat(sqft) || 0
    return sf > 0 ? Math.round(impliedPrice / sf) : 0
  }, [impliedPrice, sqft])

  const noiPerSF = useMemo(() => {
    const sf = parseFloat(sqft) || 0
    const n = parseFloat(noi) || 0
    return sf > 0 ? Math.round(n / sf) : 0
  }, [noi, sqft])

  const fmt = (n: number) => n > 0 ? `$${n.toLocaleString()}` : '$0'
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Underwriting checks
  const checks = [
    { label: 'Cap rate ≥ 8%', pass: parseFloat(capRate) >= 8 },
    { label: 'Deal size ≥ $2M', pass: impliedPrice >= 2000000 },
    { label: `Occupancy ≥ 70%`, pass: !occupancy || parseFloat(occupancy) >= 70 },
    { label: 'NOI provided', pass: parseFloat(noi) > 0 },
    { label: 'Property identified', pass: !!propertyName },
  ]
  const failCount = checks.filter(c => !c.pass).length

  const inputStyle = {
    width: '100%', padding: '0.45rem 0.65rem', background: 'rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,204,51,0.1)', borderRadius: 8, color: '#fff',
    fontSize: '0.8rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const,
  }
  const labelStyle = { display: 'block', color: 'rgba(255,204,51,0.5)', fontSize: '0.65rem', marginBottom: '0.2rem', fontWeight: 600 as const }

  return (
    <div>
      <h1 style={{ margin: '0 0 0.25rem', color: '#FFCC33', fontSize: '1.5rem', fontWeight: 700 }}>LOI Creator</h1>
      <p style={{ margin: '0 0 1rem', color: 'rgba(255,204,51,0.5)', fontSize: '0.8rem' }}>
        Generate a plain, de-branded Letter of Intent under a stealth company&apos;s name
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {/* LEFT: Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Identity */}
          <Card title="Identity & Deal">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><label style={labelStyle}>Stealth Company</label><input style={inputStyle} value={stealthCompany} onChange={e => setStealthCompany(e.target.value)} placeholder="e.g. Summit Crest Capital" /></div>
              <div><label style={labelStyle}>Signing Persona</label><input style={inputStyle} value={signatoryName} onChange={e => setSignatoryName(e.target.value)} placeholder="e.g. Claire Mitchell" /></div>
              <div><label style={labelStyle}>Property Name</label><input style={inputStyle} value={propertyName} onChange={e => setPropertyName(e.target.value)} placeholder="Start typing..." /></div>
              <div><label style={labelStyle}>Property Address</label><input style={inputStyle} value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} /></div>
            </div>
          </Card>

          {/* Underwriting */}
          <Card title="Underwriting">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><label style={labelStyle}>Net Operating Income</label><input style={inputStyle} value={noi} onChange={e => setNoi(e.target.value)} placeholder="$" type="number" /></div>
              <div><label style={labelStyle}>Target Cap Rate</label>
                <select style={{ ...inputStyle, cursor: 'pointer' }} value={capRate} onChange={e => setCapRate(e.target.value)}>
                  {['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'].map(v => <option key={v} value={v}>{v}%</option>)}
                </select>
              </div>
              <div><label style={labelStyle}>Square Feet</label><input style={inputStyle} value={sqft} onChange={e => setSqft(e.target.value)} type="number" /></div>
              <div><label style={labelStyle}>Occupancy %</label><input style={inputStyle} value={occupancy} onChange={e => setOccupancy(e.target.value)} type="number" /></div>
            </div>
            <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.65rem', background: 'rgba(255,204,51,0.06)', borderRadius: 8 }}>
              <div style={{ color: 'rgba(255,204,51,0.5)', fontSize: '0.6rem', textTransform: 'uppercase', fontWeight: 600 }}>Implied Offer Price</div>
              <div style={{ color: '#FFCC33', fontSize: '1.3rem', fontWeight: 700 }}>{fmt(impliedPrice)}</div>
              <div style={{ color: 'rgba(255,204,51,0.35)', fontSize: '0.65rem' }}>NOI {fmt(parseFloat(noi) || 0)} ÷ {capRate}% cap</div>
            </div>
          </Card>

          {/* Letter Details */}
          <Card title="Letter Details">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><label style={labelStyle}>Seller Entity (blank = fill later)</label><input style={inputStyle} value={sellerEntity} onChange={e => setSellerEntity(e.target.value)} /></div>
              <div><label style={labelStyle}>Earnest Deposit</label><input style={inputStyle} value={earnest} onChange={e => setEarnest(e.target.value)} type="number" /></div>
              <div><label style={labelStyle}>Inspection (days)</label><input style={inputStyle} value={inspectionDays} onChange={e => setInspectionDays(e.target.value)} type="number" /></div>
              <div><label style={labelStyle}>Extension (days)</label><input style={inputStyle} value={extensionDays} onChange={e => setExtensionDays(e.target.value)} type="number" /></div>
              <div><label style={labelStyle}>Closing (days after)</label><input style={inputStyle} value={closingDays} onChange={e => setClosingDays(e.target.value)} type="number" /></div>
              <div><label style={labelStyle}>Offer valid (biz days)</label><input style={inputStyle} value={validDays} onChange={e => setValidDays(e.target.value)} type="number" /></div>
              <div><label style={labelStyle}>Signatory Title</label><input style={inputStyle} value={signatoryTitle} onChange={e => setSignatoryTitle(e.target.value)} /></div>
              <div><label style={labelStyle}>Escrow Holder</label><input style={inputStyle} value={escrowHolder} onChange={e => setEscrowHolder(e.target.value)} /></div>
              <div style={{ gridColumn: '1 / -1' }}><label style={labelStyle}>Footer Contact Line</label><input style={inputStyle} value={footerContact} onChange={e => setFooterContact(e.target.value)} placeholder="Company · persona@domain" /></div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
              <ActionButton label="Generate PDF" variant="primary" onClick={() => addToast('PDF generation requires server-side template engine', 'warning')} />
              <ActionButton label="Generate DOCX" variant="ghost" onClick={() => addToast('DOCX generation requires server-side template engine', 'warning')} />
            </div>
          </Card>
        </div>

        {/* RIGHT: Preview & Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Screen Metrics */}
          <Card title="Screen Metrics">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
              {[
                { label: 'Offer Cap', value: `${capRate}%` },
                { label: 'Price/SF', value: pricePerSF > 0 ? `$${pricePerSF}` : '—' },
                { label: 'NOI/SF', value: noiPerSF > 0 ? `$${noiPerSF}` : '—' },
                { label: 'Earnest', value: fmt(parseInt(earnest) || 0) },
              ].map(m => (
                <div key={m.label} style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.1)', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ color: '#FFCC33', fontSize: '0.9rem', fontWeight: 700 }}>{m.value}</div>
                  <div style={{ color: 'rgba(255,204,51,0.3)', fontSize: '0.5rem', textTransform: 'uppercase' }}>{m.label}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              {checks.map(c => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0', fontSize: '0.7rem' }}>
                  <span style={{ color: c.pass ? '#00A980' : '#EF4444' }}>{c.pass ? '✓' : '✗'}</span>
                  <span style={{ color: c.pass ? '#e2e8f0' : '#EF4444' }}>{c.label}</span>
                </div>
              ))}
              {failCount > 0 && (
                <div style={{ color: '#F59E0B', fontSize: '0.65rem', marginTop: '0.3rem' }}>
                  {failCount} underwriting check(s) failing — not blocked.
                </div>
              )}
            </div>
          </Card>

          {/* Letter Preview */}
          <Card title="Letter Preview">
            <div style={{
              padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8,
              fontSize: '0.72rem', lineHeight: 1.7, color: '#e2e8f0', maxHeight: 500, overflowY: 'auto',
            }}>
              <p style={{ fontWeight: 700, marginTop: 0 }}>Letter of Intent to Purchase Real Estate</p>
              <p>Date: {today}</p>
              <p>Property: {propertyName || '________'}{propertyAddress ? `, ${propertyAddress}` : ''}</p>
              <p>Seller: {sellerEntity || '________________________________________'}</p>
              <p>Buyer: {stealthCompany || '________'}</p>
              <p>{stealthCompany || '________'} would like to put the following offer in front of you for the property above. We&apos;ve kept this short and written it in plain terms. It isn&apos;t a contract. Neither side is bound by anything here until a definitive purchase agreement is signed by both of us.</p>
              <p><strong>The price.</strong> {fmt(impliedPrice)}, with the full amount paid to you at closing.</p>
              <p><strong>Earnest money.</strong> Once a purchase agreement is signed, we&apos;ll place {fmt(parseInt(earnest) || 100000)} in earnest money with {escrowHolder}, credited toward the price at closing.</p>
              <p><strong>Inspection.</strong> We&apos;d like {inspectionDays} days to inspect the property and review your records, with the option to extend another {extensionDays} days if something needs a closer look.</p>
              <p><strong>Closing.</strong> We&apos;d plan to close within {closingDays} days after the inspection period ends.</p>
              <p><strong>Timing.</strong> We&apos;d appreciate hearing back within {validDays} business days.</p>
              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,204,51,0.1)', margin: '0.75rem 0' }} />
              <p>Agreed and accepted for the Seller:</p>
              <p>Signature: ______________________________________</p>
              <p>Date: ______________________________________</p>
              <p>Name / Title: ______________________________________</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
