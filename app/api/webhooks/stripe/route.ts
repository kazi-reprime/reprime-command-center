import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';

const stripeSecret = process.env.STRIPE_SECRET_KEY || 'mock';
const stripe = new Stripe(stripeSecret, {
  apiVersion: '2026-06-24.dahlia',
});

export async function POST(req: Request) {
  try {
    const text = await req.text();
    const signature = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (signature && webhookSecret && webhookSecret !== 'mock') {
      event = stripe.webhooks.constructEvent(text, signature, webhookSecret);
    } else {
      // Simulated direct parsing for verification webhook calls
      event = JSON.parse(text) as Stripe.Event;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      const planName = session.metadata?.planName;
      const customerId = session.customer as string;

      if (orgId && planName) {
        try {
          const service = createServiceClient();
          // Update organizations (if table exists)
          const { error } = await service
            .from('organizations')
            .update({
              plan: planName,
              stripe_customer_id: customerId,
            })
            .eq('id', orgId);
          if (error) {
            console.warn('Stripe Webhook: Could not update organizations table (likely does not exist):', error.message);
          } else {
            console.log(`Stripe Webhook: Upgraded organization ${orgId} to plan ${planName}`);
          }
        } catch (dbErr) {
          console.warn('Stripe Webhook: Database table upgrade skipped:', dbErr);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
