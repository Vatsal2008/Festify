// lib/payments/razorpay.js — Razorpay Checkout integration.
//
// Flow: POST /orders creates a real Razorpay order server-side, we open
// Checkout with it, and the handler posts the signed result back to
// /orders/{id}/verify-payment. The backend verifies the signature before
// issuing any ticket, so a client that lies about success gets nothing.

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

// Opt-in UPI-only checkout. Off by default because enforcing it against
// an account without UPI enabled breaks payment entirely (see below).
const UPI_ONLY = import.meta.env.VITE_PAYMENT_UPI_ONLY === 'true';

let scriptPromise = null;
function loadCheckout() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const s = document.createElement('script');
    s.src = CHECKOUT_SRC;
    s.async = true;
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error('Could not load the payment window. Check your connection.'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Open Razorpay Checkout for a created order.
 * Resolves with {razorpay_payment_id, razorpay_signature} on success,
 * rejects if the user dismisses or payment fails.
 */
export async function openCheckout({ order, user, eventTitle }) {
  const Razorpay = await loadCheckout();

  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.razorpay_key_id,
      order_id: order.razorpay_order_id,
      amount: order.amount,
      currency: order.currency,
      name: 'Festify',
      description: eventTitle,
      // UPI-only is the intended end state for this product, but it can
      // only be enforced once UPI is actually enabled on the Razorpay
      // account. Restricting to a method the account does not offer
      // leaves Checkout with nothing to show and it fails outright with
      // "no appropriate payment method found" -- so this stays opt-in.
      // Check availability with:
      //   GET https://api.razorpay.com/v1/methods?key_id=<key>
      // and set VITE_PAYMENT_UPI_ONLY=true once "upi" reports true.
      ...(UPI_ONLY ? {
        method: {
          upi: true,
          card: false,
          netbanking: false,
          wallet: false,
          emi: false,
          paylater: false,
        },
      } : {}),
      prefill: {
        name: user?.full_name || '',
        email: user?.email || '',
      },
      theme: { color: '#6C4DFF' },
      handler: (response) => resolve({
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature,
      }),
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled.')),
      },
    });

    rzp.on('payment.failed', (resp) => {
      reject(new Error(resp?.error?.description || 'Payment failed. Please try again.'));
    });

    rzp.open();
  });
}
