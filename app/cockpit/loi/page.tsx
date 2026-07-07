/* eslint-disable */
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

  const inputClassName = 'w-full px-2.5 py-1.5 bg-black/20 border border-border-strong rounded-lg text-text-primary text-sm outline-none font-[inherit] box-border'
  const labelClassName = 'block text-text-secondary text-[0.65rem] mb-0.5 font-semibold'

  return (
    <div>
      <h1 className="mb-1 text-text-primary text-2xl font-bold">LOI Creator</h1>
      <p className="mb-4 text-text-secondary text-xs">
        Generate a plain, de-branded Letter of Intent under a stealth company&apos;s name
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* LEFT: Form */}
        <div className="flex flex-col gap-3">
          {/* Identity */}
          <Card title="Identity & Deal">
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelClassName}>Stealth Company</label><input className={inputClassName} value={stealthCompany} onChange={e => setStealthCompany(e.target.value)} placeholder="e.g. Summit Crest Capital" /></div>
              <div><label className={labelClassName}>Signing Persona</label><input className={inputClassName} value={signatoryName} onChange={e => setSignatoryName(e.target.value)} placeholder="e.g. Claire Mitchell" /></div>
              <div><label className={labelClassName}>Property Name</label><input className={inputClassName} value={propertyName} onChange={e => setPropertyName(e.target.value)} placeholder="Start typing..." /></div>
              <div><label className={labelClassName}>Property Address</label><input className={inputClassName} value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} /></div>
            </div>
          </Card>

          {/* Underwriting */}
          <Card title="Underwriting">
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelClassName}>Net Operating Income</label><input className={inputClassName} value={noi} onChange={e => setNoi(e.target.value)} placeholder="$" type="number" /></div>
              <div><label className={labelClassName}>Target Cap Rate</label>
                <select className={`${inputClassName} cursor-pointer`} value={capRate} onChange={e => setCapRate(e.target.value)}>
                  {['7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'].map(v => <option key={v} value={v}>{v}%</option>)}
                </select>
              </div>
              <div><label className={labelClassName}>Square Feet</label><input className={inputClassName} value={sqft} onChange={e => setSqft(e.target.value)} type="number" /></div>
              <div><label className={labelClassName}>Occupancy %</label><input className={inputClassName} value={occupancy} onChange={e => setOccupancy(e.target.value)} type="number" /></div>
            </div>
            <div className="mt-2 px-2.5 py-2 bg-accent/[0.06] rounded-lg">
              <div className="text-text-secondary text-[0.6rem] uppercase font-semibold">Implied Offer Price</div>
              <div className="text-accent text-xl font-bold">{fmt(impliedPrice)}</div>
              <div className="text-text-muted text-[0.65rem]">NOI {fmt(parseFloat(noi) || 0)} ÷ {capRate}% cap</div>
            </div>
          </Card>

          {/* Letter Details */}
          <Card title="Letter Details">
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelClassName}>Seller Entity (blank = fill later)</label><input className={inputClassName} value={sellerEntity} onChange={e => setSellerEntity(e.target.value)} /></div>
              <div><label className={labelClassName}>Earnest Deposit</label><input className={inputClassName} value={earnest} onChange={e => setEarnest(e.target.value)} type="number" /></div>
              <div><label className={labelClassName}>Inspection (days)</label><input className={inputClassName} value={inspectionDays} onChange={e => setInspectionDays(e.target.value)} type="number" /></div>
              <div><label className={labelClassName}>Extension (days)</label><input className={inputClassName} value={extensionDays} onChange={e => setExtensionDays(e.target.value)} type="number" /></div>
              <div><label className={labelClassName}>Closing (days after)</label><input className={inputClassName} value={closingDays} onChange={e => setClosingDays(e.target.value)} type="number" /></div>
              <div><label className={labelClassName}>Offer valid (biz days)</label><input className={inputClassName} value={validDays} onChange={e => setValidDays(e.target.value)} type="number" /></div>
              <div><label className={labelClassName}>Signatory Title</label><input className={inputClassName} value={signatoryTitle} onChange={e => setSignatoryTitle(e.target.value)} /></div>
              <div><label className={labelClassName}>Escrow Holder</label><input className={inputClassName} value={escrowHolder} onChange={e => setEscrowHolder(e.target.value)} /></div>
              <div className="col-span-2"><label className={labelClassName}>Footer Contact Line</label><input className={inputClassName} value={footerContact} onChange={e => setFooterContact(e.target.value)} placeholder="Company · persona@domain" /></div>
            </div>

            <div className="flex gap-2 mt-3">
              <ActionButton label="Generate PDF" variant="primary" onClick={() => addToast('PDF generation requires server-side template engine', 'warning')} />
              <ActionButton label="Generate DOCX" variant="ghost" onClick={() => addToast('DOCX generation requires server-side template engine', 'warning')} />
            </div>
          </Card>
        </div>

        {/* RIGHT: Preview & Metrics */}
        <div className="flex flex-col gap-3">
          {/* Screen Metrics */}
          <Card title="Screen Metrics">
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'Offer Cap', value: `${capRate}%` },
                { label: 'Price/SF', value: pricePerSF > 0 ? `$${pricePerSF}` : '—' },
                { label: 'NOI/SF', value: noiPerSF > 0 ? `$${noiPerSF}` : '—' },
                { label: 'Earnest', value: fmt(parseInt(earnest) || 0) },
              ].map(m => (
                <div key={m.label} className="p-1.5 bg-black/10 rounded-md text-center">
                  <div className="text-accent text-base font-bold">{m.value}</div>
                  <div className="text-text-muted text-[0.5rem] uppercase">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-2">
              {checks.map(c => (
                <div key={c.label} className="flex items-center gap-1.5 py-0.5 text-[0.7rem]">
                  <span className={c.pass ? 'text-status-success' : 'text-status-error'}>{c.pass ? '✓' : '✗'}</span>
                  <span className={c.pass ? 'text-text-primary' : 'text-status-error'}>{c.label}</span>
                </div>
              ))}
              {failCount > 0 && (
                <div className="text-status-warning text-[0.65rem] mt-1">
                  {failCount} underwriting check(s) failing — not blocked.
                </div>
              )}
            </div>
          </Card>

          {/* Letter Preview */}
          <Card title="Letter Preview">
            <div className="p-4 bg-white/[0.03] rounded-lg text-[0.72rem] leading-relaxed text-text-primary max-h-[500px] overflow-y-auto">
              <p className="font-bold mt-0">Letter of Intent to Purchase Real Estate</p>
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
              <hr className="border-none border-t border-border my-3" />
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
