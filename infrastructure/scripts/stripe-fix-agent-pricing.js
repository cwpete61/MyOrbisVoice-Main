/* One-shot (idempotent): correct MyOrbisAgents Stripe pricing.
 * - Reuse (or create) a $250 one-time setup price (old was $500).
 * - Rename both founding-annual products, dropping the misleading "(50pct off yr1)".
 * - Create two NEW payment links: $250 setup + existing (correct) recurring price.
 * - Does NOT deactivate old links here (kept live until config/marketing are swapped).
 * Run INSIDE the api container so the Stripe key never leaves it:
 *   docker cp infrastructure/scripts/stripe-fix-agent-pricing.js myorbisvoice-api:/tmp/sf.js
 *   docker exec myorbisvoice-api node /tmp/sf.js
 * Copy the NEWLINK lines it prints back to the assistant to finish the swap. */
(async () => {
  const { getStripe, bootStripeFromConfig } = require('/app/apps/api/dist/lib/stripe.js');
  try { await bootStripeFromConfig(); } catch (e) {}
  const stripe = getStripe();

  const SETUP_PRODUCT = 'prod_UnroM7kmXweZnp';
  const plans = [
    { code: '28E28tcsrd8h0LR47s0Ny07', product: 'prod_UnroLmSvK2uZhR', recurring: 'price_1ToG4oRsXNhM9LwU7P82FImE', newName: 'MyOrbisAgents Solo Capture - Founding Annual (50% off for life)', tag: 'capture' },
    { code: '6oUaEZ1NNfgp2TZ33o0Ny05', product: 'prod_UnrodMJ0n1kjq0', recurring: 'price_1ToG4nRsXNhM9LwUpqSr8DKG', newName: 'MyOrbisAgents Solo Power - Founding Annual (50% off for life)', tag: 'power' },
  ];

  // Reuse an existing active $250 one-time price on the setup product, else create one.
  const existingPrices = await stripe.prices.list({ product: SETUP_PRODUCT, active: true, limit: 100 });
  let setup = existingPrices.data.find(p => p.unit_amount === 25000 && p.type === 'one_time');
  if (!setup) setup = await stripe.prices.create({ product: SETUP_PRODUCT, unit_amount: 25000, currency: 'usd' });
  console.log('SETUP_PRICE', setup.id, '$' + setup.unit_amount / 100, '(reused=' + (existingPrices.data.includes(setup)) + ')');

  const links = await stripe.paymentLinks.list({ limit: 100 });
  for (const p of plans) {
    const prod = await stripe.products.update(p.product, { name: p.newName });
    console.log('RENAMED', p.tag, '=>', prod.name);
    const old = links.data.find(l => (l.url || '').endsWith(p.code));
    // Skip if a NEW link with the $250 setup + this recurring already exists (idempotent re-run).
    let existingNew = null;
    for (const l of links.data) {
      if (!l.active || (l.url || '').endsWith(p.code)) continue;
      const li = await stripe.paymentLinks.listLineItems(l.id, { limit: 10 });
      const priceIds = li.data.map(x => x.price.id);
      if (priceIds.includes(setup.id) && priceIds.includes(p.recurring)) { existingNew = l; break; }
    }
    if (existingNew) { console.log('NEWLINK', p.tag, 'OLD_ID', old && old.id, 'NEW_URL', existingNew.url, 'NEW_ID', existingNew.id, '(already existed)'); continue; }
    const params = { line_items: [ { price: setup.id, quantity: 1 }, { price: p.recurring, quantity: 1 } ] };
    if (old) {
      if (old.allow_promotion_codes != null) params.allow_promotion_codes = old.allow_promotion_codes;
      if (old.billing_address_collection) params.billing_address_collection = old.billing_address_collection;
      if (old.phone_number_collection) params.phone_number_collection = old.phone_number_collection;
    }
    const nl = await stripe.paymentLinks.create(params);
    console.log('NEWLINK', p.tag, 'OLD_ID', old && old.id, 'NEW_URL', nl.url, 'NEW_ID', nl.id);
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
