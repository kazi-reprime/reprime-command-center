import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

const stripeSecret = process.env.STRIPE_SECRET_KEY || 'mock';
const stripe = new Stripe(stripeSecret, {
  apiVersion: '2026-06-24.dahlia',
});

export async function POST(req: Request) {
  try {
    const { orgId, planName } = await req.json();
    if (!orgId || !planName) {
      return NextResponse.json({ error: 'orgId and planName are required' }, { status: 400 });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const successUrl = `${protocol}://${host}/cockpit?billing=success`;
    const cancelUrl = `${protocol}://${host}/cockpit?billing=cancel`;

    if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'mock') {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `RePrime Command Center - ${planName.toUpperCase()} Plan`,
              },
              unit_amount: planName.toLowerCase() === 'premium' ? 29900 : 9900, // $299/mo or $99/mo
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          orgId,
          planName,
        },
      });

      return NextResponse.json({ url: session.url });
    } else {
      // Direct update simulation for dev compilation/local preview
      console.log('Stripe Billing: Simulating successful checkout...');
      try {
        const service = createServiceClient();
        const { error } = await service
          .from('organizations')
          .update({ plan: planName, stripe_customer_id: 'cus_simulated_billing' })
          .eq('id', orgId);
        if (error) {
          console.warn('Stripe Billing: Could not update organizations table (likely does not exist):', error.message);
        }
      } catch (dbErr) {
        console.warn('Stripe Billing: Database update skipped:', dbErr);
      }

      return NextResponse.json({ url: successUrl });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
