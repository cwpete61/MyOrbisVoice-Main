export const metadata = { title: 'Terms of Service — MyOrbisVoice' }

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px', fontFamily: 'sans-serif', lineHeight: 1.7, color: '#1a1a1a' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: '#666', marginBottom: 40 }}>Last updated: April 30, 2026</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>1. Acceptance of Terms</h2>
        <p>By accessing or using MyOrbisVoice ("Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including businesses and individuals who access the platform.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>2. Description of Service</h2>
        <p>MyOrbisVoice is a multi-tenant voice automation platform that allows businesses to configure AI-powered voice agents for website widgets, inbound phone reception, and outbound calling campaigns. The Service integrates with third-party providers including Google, Twilio, and Stripe.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>3. Account Registration</h2>
        <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials. You must notify us immediately of any unauthorized access. Each account represents a single business workspace. You must be at least 18 years old to use the Service.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>4. Acceptable Use</h2>
        <p>You agree not to use the Service to:</p>
        <ul style={{ paddingLeft: 24, marginTop: 12 }}>
          <li>Make calls or send messages to individuals who have not consented to be contacted.</li>
          <li>Violate any applicable telemarketing laws including the TCPA, GDPR, or CAN-SPAM Act.</li>
          <li>Impersonate any person or entity or misrepresent your affiliation.</li>
          <li>Transmit spam, malware, or other harmful content.</li>
          <li>Interfere with or disrupt the integrity or performance of the Service.</li>
          <li>Attempt to gain unauthorized access to any part of the Service.</li>
        </ul>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>5. Google Workspace Integration</h2>
        <p>When you connect a Google account to the Service, you authorize MyOrbisVoice to access your Gmail and Google Calendar on your behalf solely for the purposes of sending appointment confirmations, reading appointment-related emails, and managing calendar events created by your voice agents. You may revoke this access at any time through your integrations dashboard or through your Google account settings at myaccount.google.com.</p>
        <p style={{ marginTop: 12 }}>Our use of Google user data is governed by the <a href="https://developers.google.com/terms/api-services-user-data-policy" style={{ color: '#1a73e8' }}>Google API Services User Data Policy</a>.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>6. Billing and Subscriptions</h2>
        <p>Paid plans are billed on a recurring basis via Stripe. You authorize us to charge your payment method on the billing cycle you select. Subscriptions renew automatically unless cancelled before the renewal date. Refunds are handled on a case-by-case basis. We reserve the right to change pricing with 30 days notice.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>7. Data Ownership</h2>
        <p>You retain ownership of all data you input into the Service, including business profiles, prompts, contacts, and conversation records. By using the Service you grant us a limited license to store and process that data solely to provide the Service to you.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>8. Service Availability</h2>
        <p>We aim for high availability but do not guarantee uninterrupted service. We may perform maintenance that temporarily affects availability. We are not liable for losses resulting from downtime, interruptions, or data loss caused by events outside our reasonable control.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>9. Termination</h2>
        <p>You may cancel your account at any time from your billing settings. We reserve the right to suspend or terminate accounts that violate these terms. Upon termination, your data will be retained for 30 days before deletion, during which time you may request an export.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>10. Limitation of Liability</h2>
        <p>To the maximum extent permitted by law, MyOrbisVoice shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or data arising from your use of the Service. Our total liability to you for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>11. Changes to Terms</h2>
        <p>We may update these Terms from time to time. We will notify you of material changes by email or in-app notice at least 14 days before they take effect. Continued use of the Service constitutes acceptance of the updated Terms.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>12. Governing Law</h2>
        <p>These Terms are governed by the laws of the jurisdiction in which MyOrbisVoice is incorporated, without regard to conflict of law principles.</p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>13. Contact</h2>
        <p>For questions about these Terms, contact us at:</p>
        <p style={{ marginTop: 8 }}><strong>MyOrbisVoice</strong><br />Email: legal@myorbisvoice.com<br />Website: https://myorbisvoice.com</p>
      </section>
    </main>
  )
}
