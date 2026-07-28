/* Finalize the MyOrbisAgents Stripe pricing fix.
 * - Deactivate the two OLD annual payment links ($500 setup).
 * - Report every ACTIVE payment link's line items (to catch any link still on the
 *   old $500 setup price, e.g. the monthly links).
 * - Archive the old $500 setup price only if NO active link still references it.
 * Run in-container:
 *   docker cp infrastructure/scripts/stripe-finalize-agent-pricing.js myorbisvoice-api:/tmp/sfz.js
 *   docker exec myorbisvoice-api node /tmp/sfz.js
 * Paste the ACTIVE-LINK report back to the assistant. */
(async () => {
  const { getStripe, bootStripeFromConfig } = require('/app/apps/api/dist/lib/stripe.js');
  try { await bootStripeFromConfig(); } catch (e) {}
  const stripe = getStripe();

  const OLD_ANNUAL_LINKS = ['plink_1ToG4pRsXNhM9LwUGpAKfslU', 'plink_1ToG4oRsXNhM9LwUN828zRfb'];
  const OLD_SETUP_PRICE = 'price_1ToG4nRsXNhM9LwUYMNE09ok'; // the $500 one

  for (const id of OLD_ANNUAL_LINKS) {
    try { const l = await stripe.paymentLinks.update(id, { active: false }); console.log('DEACTIVATED', id, l.active); }
    catch (e) { console.log('DEACTIVATE_ERR', id, e.message); }
  }

  const links = await stripe.paymentLinks.list({ limit: 100 });
  let oldSetupStillUsed = false;
  console.log('--- ACTIVE LINKS ---');
  for (const l of links.data) {
    if (!l.active) continue;
    const li = await stripe.paymentLinks.listLineItems(l.id, { limit: 10, expand: ['data.price.product'] });
    const parts = li.data.map(x => `${(x.price.product && x.price.product.name) || '?'} $${x.price.unit_amount / 100} ${x.price.recurring ? '/' + x.price.recurring.interval : 'once'}`);
    if (li.data.some(x => x.price.id === OLD_SETUP_PRICE)) oldSetupStillUsed = true;
    console.log('ACTIVE', l.url, '::', parts.join(' + '));
  }

  if (oldSetupStillUsed) {
    console.log('SETUP_ARCHIVE_SKIPPED: old $500 setup price still used by an active link (see above).');
  } else {
    await stripe.prices.update(OLD_SETUP_PRICE, { active: false });
    console.log('ARCHIVED_OLD_SETUP_PRICE', OLD_SETUP_PRICE);
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
