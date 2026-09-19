import { LegalLayout, LegalSection } from '../components/LegalLayout.jsx';

const SECTIONS = [
  { id: 'acceptance', title: 'Acceptance of terms' },
  { id: 'accounts', title: 'Accounts & eligibility' },
  { id: 'roles', title: 'Students & instructors' },
  { id: 'payments', title: 'Payments & refunds' },
  { id: 'ai-disclaimer', title: 'AI features — accuracy & limits' },
  { id: 'conduct', title: 'Acceptable use & academic integrity' },
  { id: 'ip', title: 'Content & intellectual property' },
  { id: 'termination', title: 'Suspension & termination' },
  { id: 'disclaimers', title: 'Disclaimers & liability' },
  { id: 'law', title: 'Governing law' },
  { id: 'changes', title: 'Changes to these terms' },
  { id: 'contact', title: 'Contact us' },
];

export function TermsConditions() {
  return (
    <LegalLayout
      title="Terms & Conditions"
      lastUpdated="September 19, 2026"
      intro="These terms govern your use of LearnStream as a student, instructor, or visitor. By creating an account or using the platform, you agree to them."
      sections={SECTIONS}
    >
      <LegalSection id="acceptance" title="1. Acceptance of terms">
        <p>
          By creating a LearnStream account, enrolling in or authoring a course, or otherwise using the
          platform, you agree to these Terms and to our <a href="/privacy">Privacy Policy</a>. If you do not
          agree, do not use LearnStream.
        </p>
      </LegalSection>

      <LegalSection id="accounts" title="2. Accounts & eligibility">
        <ul>
          <li>You must provide accurate information when registering and keep your credentials confidential — you are responsible for activity under your account.</li>
          <li>Each account has exactly one role, student or teacher, set at signup.</li>
          <li>You must verify your email before your account becomes active.</li>
          <li>You must be old enough to consent to these terms under the law of your country (see the Privacy Policy&apos;s Children&apos;s Privacy section).</li>
        </ul>
      </LegalSection>

      <LegalSection id="roles" title="3. Students & instructors">
        <p>
          <strong>As a student</strong>, enrolling in a paid course grants you a personal, non-transferable
          license to access that course&apos;s content for your own learning. You may not redistribute,
          resell, or publicly share course video, transcripts, or materials.
        </p>
        <p>
          <strong>As an instructor</strong>, you retain ownership of the courses, lectures, and materials you
          upload. By publishing a course, you grant LearnStream the license needed to host, stream, transcribe,
          and (where you enable it) run the AI features in Section 5 against that content, for the purpose of
          delivering it to your enrolled students. You are responsible for having the rights to everything you
          upload, and for reviewing and approving any AI-generated answer key before it is used to grade a
          student (see Section 5).
        </p>
      </LegalSection>

      <LegalSection id="payments" title="4. Payments & refunds">
        <p>
          Course prices are shown in the listed currency and charged through Razorpay at the time of purchase.
          Enrollment is granted once payment is confirmed. Refund eligibility (for example, a window after
          purchase before a student has consumed meaningful course content) is set by LearnStream&apos;s refund
          policy in effect at the time of purchase — request a refund at{' '}
          <a href="mailto:support@learnstream.app">support@learnstream.app</a>.
        </p>
        <p>
          <em>
            This section is a placeholder for an actual business refund policy — confirm the real terms (refund
            window, proration, instructor payout handling) before this product processes real payments.
          </em>
        </p>
      </LegalSection>

      <LegalSection id="ai-disclaimer" title="5. AI features — accuracy & limits">
        <p>
          LearnStream&apos;s lecture chat assistant and AI-assisted grading (described in the Privacy Policy,
          Section 3) are provided to support learning and grading, not to replace an instructor&apos;s
          judgment.
        </p>
        <ul>
          <li>The lecture chat assistant answers based only on that lecture&apos;s transcript; it can be incomplete or wrong, and is not a substitute for the actual lecture or your instructor.</li>
          <li>An AI-generated answer sheet is never used to grade a student until an instructor has reviewed and approved it.</li>
          <li>An AI-proposed grade is a recommendation to the instructor, not a final result — instructors can review and override it before it is released to a student.</li>
          <li>If you believe an AI-assisted grade is wrong, you can request instructor re-review at any time.</li>
        </ul>
      </LegalSection>

      <LegalSection id="conduct" title="6. Acceptable use & academic integrity">
        <ul>
          <li>Do not upload content you do not have the rights to, or content that is unlawful, infringing, or harmful.</li>
          <li>Do not attempt to bypass access controls, scrape course content in bulk, or interfere with the platform&apos;s operation.</li>
          <li>Assignment submissions must be your own work; misuse of the AI features to generate a submission where the assignment prohibits it is an academic-integrity matter for the instructor to handle, not something these Terms police on your behalf.</li>
          <li>Do not use the lecture chat assistant to extract or reproduce full lecture transcripts outside their intended use.</li>
        </ul>
      </LegalSection>

      <LegalSection id="ip" title="7. Content & intellectual property">
        <p>
          The LearnStream name, branding, and platform code are owned by LearnStream. Course content remains
          the property of the instructor who authored it, licensed to LearnStream and to enrolled students as
          described in Section 3. Nothing in these Terms transfers ownership of your content to us.
        </p>
      </LegalSection>

      <LegalSection id="termination" title="8. Suspension & termination">
        <p>
          You can stop using LearnStream and request account deletion at any time (see the Privacy
          Policy&apos;s &quot;Your rights&quot; section). We may suspend or terminate an account that violates
          these Terms — for example, uploading infringing content or abusing the platform — with notice where
          practical.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="9. Disclaimers & liability">
        <p>
          LearnStream is provided &quot;as is.&quot; We do not guarantee uninterrupted access, that every
          course meets a particular outcome, or that AI-generated answers or grades are error-free. To the
          extent permitted by law, LearnStream is not liable for indirect or consequential damages arising from
          your use of the platform.
        </p>
        <p>
          <em>This is standard placeholder liability language — have it reviewed against applicable consumer-protection law before relying on it in production.</em>
        </p>
      </LegalSection>

      <LegalSection id="law" title="10. Governing law">
        <p>
          These Terms are governed by the laws of India, given LearnStream&apos;s use of Razorpay and INR
          pricing.{' '}
          <em>Confirm this is actually the intended jurisdiction before treating it as final.</em>
        </p>
      </LegalSection>

      <LegalSection id="changes" title="11. Changes to these terms">
        <p>
          We may update these Terms as the product changes — most notably as the AI features in Section 5 are
          extended. We will update the &quot;last updated&quot; date above, and for material changes we will
          notify active users.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="12. Contact us">
        <p>
          Questions about these Terms: <a href="mailto:support@learnstream.app">support@learnstream.app</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

export default TermsConditions;
