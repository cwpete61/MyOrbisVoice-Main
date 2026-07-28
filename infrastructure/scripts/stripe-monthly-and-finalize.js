/* Give each tier TWO checkout links, both with the $250 setup:
 *   - Annual (already done): $250 setup + annual recurring.
 *   - Monthly (this script): $250 setup + monthly recurring (NEW links).
 * Also deactivate the OLD annual + OLD monthly links (no/ wrong setup),
 * report all active links, and archive the old $500 setup price if unused.
 * Run in-container:
 *   docker cp infrastructure/scripts/stripe-monthly-and-finalize.js myorbisvoice-api:/tmp/smf.js
 *   docker exec myorbisvoice-api node /tmp/smf.js
 * Paste the NEWMONTHLY + ACTIVE lines back to the assistant. */
(async () => {
  const { getStripe, bootStripeFromConfig } = require('/app/apps/api/dist/lib/stripe.js');
  try { await bootStripeFromConfig(); } catch (e) {}
  const stripe = getStripe();

  const SETUP = 'price_1Ty2tCRsXNhM9LwU7tMs6K2e';          // the $250 one-time price
  const OLD_SETUP_PRICE = 'price_1ToG4nRsXNhM9LwUYMNE09ok'; // the $500 one
  const OLD_ANNUAL_LINKS = ['plink_1ToG4pRsXNhM9LwUGpAKfslU', 'plink_1ToG4oRsXNhM9LwUN828zRfb'];
  const plans = [
    { tag: 'capture', monthlyCode: '4gMeVfgIH3xHdyDbzU0Ny08' },
    { tag: 'power',   monthlyCode: '8x27sN8cbb09527cDY0Ny06' },
  ];

  const links = await stripe.paymentLinks.list({ limit: 100 });

  for (const p of plans) {
    const oldMonthly = links.data.find(l => (l.url || '').endsWith(p.monthlyCode));
    if (!oldMonthly) { console.log('MONTHLY_NOT_FOUND', p.tag, p.monthlyCode); continue; }
    const li = await stripe.paymentLinks.listLineItems(oldMonthly.id, { limit: 10 });
    const rec = li.data.map(x => x.price).find(pr => pr.recurring && pr.recurring.interval === 'month');
    if (!rec) { console.log('MONTHLY_RECURRING_NOT_FOUND', p.tag); continue; }

    // Idempotent: reuse an existing active link that is exactly setup + this monthly recurring.
    let existingNew = null;
    for (const l of links.data) {
      if (!l.active || l.id === oldMonthly.id) continue;
      const lli = await stripe.paymentLinks.listLineItems(l.id, { limit: 10 });
      const ids = lli.data.map(x => x.price.id);
      if (ids.includes(SETUP) && ids.includes(rec.id) && ids.length === 2) { existingNew = l; break; }
    }
    const params = { line_items: [ { price: SETUP, quantity: 1 }, { price: rec.id, quantity: 1 } ] };
    if (oldMonthly.allow_promotion_codes != null) params.allow_promotion_codes = oldMonthly.allow_promotion_codes;
    if (oldMonthly.billing_address_collection) params.billing_address_collection = oldMonthly.billing_address_collection;
    if (oldMonthly.phone_number_collection) params.phone_number_collection = oldMonthly.phone_number_collection;
    const nl = existingNew || await stripe.paymentLinks.create(params);
    console.log('NEWMONTHLY', p.tag, 'OLD_ID', oldMonthly.id, 'NEW_URL', nl.url, 'NEW_ID', nl.id, existingNew ? '(already existed)' : '');

    // Deactivate the old monthly link (no / wrong setup).
    try { await stripe.paymentLinks.update(oldMonthly.id, { active: false }); console.log('DEACTIVATED_OLD_MONTHLY', p.tag, oldMonthly.id); }
    catch (e) { console.log('DEACT_MONTHLY_ERR', p.tag, e.message); }
  }

  for (const id of OLD_ANNUAL_LINKS) {
    try { const l = await stripe.paymentLinks.update(id, { active: false }); console.log('DEACTIVATED_OLD_ANNUAL', id, l.active); }
    catch (e) { console.log('DEACT_ANNUAL_ERR', id, e.message); }
  }

  const fresh = await stripe.paymentLinks.list({ limit: 100 });
  let oldSetupStillUsed = false;
  console.log('--- ACTIVE LINKS ---');
  for (const l of fresh.data) {
    if (!l.active) continue;
    const li = await stripe.paymentLinks.listLineItems(l.id, { limit: 10, expand: ['data.price.product'] });
    const parts = li.data.map(x => `${(x.price.product && x.price.product.name) || '?'} $${x.price.unit_amount / 100} ${x.price.recurring ? '/' + x.price.recurring.interval : 'once'}`);
    if (li.data.some(x => x.price.id === OLD_SETUP_PRICE)) oldSetupStillUsed = true;
    console.log('ACTIVE', l.url, '::', parts.join(' + '));
  }

  if (oldSetupStillUsed) console.log('SETUP_ARCHIVE_SKIPPED: old $500 setup still used by an active link.');
  else { await stripe.prices.update(OLD_SETUP_PRICE, { active: false }); console.log('ARCHIVED_OLD_SETUP_PRICE', OLD_SETUP_PRICE); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
