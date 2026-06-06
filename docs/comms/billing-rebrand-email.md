# Customer Comms — Billing rebrand notice (Phase 4a)

> Send this to existing paying customers BEFORE flipping the Stripe statement
> descriptor / public business name to MyOrbisResults (4a). A descriptor change
> without notice is a classic chargeback trigger. Bilingual (EN + ES) per the
> product's bilingual rule — Spanish = Latin-American, informal "tú". Send each
> customer their preferred-locale version (User.preferredLocale).
>
> STATUS: DRAFT — not sent. Nothing in Stripe changes until you send this + give
> the go for 4a.

---

## English

**Subject:** A small change to how your billing appears

Hi {firstName},

Quick heads-up — nothing about your plan, price, or service is changing.

We've brought our products (MyOrbisVoice, and soon MyOrbisLocal and
MyOrbisReviews) under one parent brand: **MyOrbisResults**. Because of that,
your billing statement and receipts will now show **MyOrbisResults** instead of
MyOrbisVoice.

- **Your plan, price, and billing date:** unchanged.
- **What you'll see on your card statement:** `MYORBISRESULTS` going forward.
- **Anything you need to do:** nothing.

If you see a MyOrbisResults charge you don't recognize, it's just us — same
service, same team. Questions? Just reply to this email.

Thanks,
The MyOrbisResults team

---

## Español (Latinoamérica, "tú")

**Asunto:** Un pequeño cambio en cómo aparece tu facturación

Hola {firstName}:

Aviso rápido: no cambia nada de tu plan, tu precio ni tu servicio.

Reunimos nuestros productos (MyOrbisVoice, y pronto MyOrbisLocal y
MyOrbisReviews) bajo una misma marca: **MyOrbisResults**. Por eso, tu estado de
cuenta y tus recibos ahora mostrarán **MyOrbisResults** en lugar de MyOrbisVoice.

- **Tu plan, precio y fecha de cobro:** sin cambios.
- **Lo que verás en el estado de cuenta de tu tarjeta:** `MYORBISRESULTS` de
  ahora en adelante.
- **Lo que tienes que hacer:** nada.

Si ves un cargo de MyOrbisResults que no reconoces, somos nosotros: el mismo
servicio, el mismo equipo. ¿Dudas? Responde a este correo.

Gracias,
El equipo de MyOrbisResults

---

## Send mechanics (when you authorize)
- Recipients: active paying customers (the 4 active paid subs + any new). Trial/free
  optional.
- Per-recipient language from `User.preferredLocale` (en/es).
- Send via the existing transactional path (notify@myorbisvoice.com / Postfix), or
  the cold/transactional email service. Brand stays English ("MyOrbisResults",
  "MyOrbisVoice", etc.).
- Then (after a day or two) run 4a: Stripe public name + statement descriptor →
  MyOrbisResults.
