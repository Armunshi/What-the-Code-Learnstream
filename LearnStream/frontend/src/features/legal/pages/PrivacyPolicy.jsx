import { LegalLayout, LegalSection } from '../components/LegalLayout.jsx';

const SECTIONS = [
  { id: 'overview', title: 'Overview' },
  { id: 'information-we-collect', title: 'Information we collect' },
  { id: 'ai-features', title: 'AI features & the data they use' },
  { id: 'how-we-use-it', title: 'How we use your information' },
  { id: 'sharing', title: 'Who we share data with' },
  { id: 'retention', title: 'How long we keep data' },
  { id: 'cookies', title: 'Cookies & sessions' },
  { id: 'security', title: 'Security' },
  { id: 'your-rights', title: 'Your rights & choices' },
  { id: 'children', title: "Children's privacy" },
  { id: 'changes', title: 'Changes to this policy' },
  { id: 'contact', title: 'Contact us' },
];

export function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      lastUpdated="September 19, 2026"
      intro="This page explains what LearnStream collects about students and instructors, why, how long we keep it, and who else sees it — including the AI features that read lecture transcripts and assignment submissions."
      sections={SECTIONS}
    >
      <LegalSection id="overview" title="1. Overview">
        <p>
          LearnStream is a course platform connecting instructors and students through video lectures,
          assignments, and (where enabled) an AI lecture assistant and AI-assisted grading. This policy covers
          every part of the product — account data, course content, payments, and the data our AI features
          read and generate. It applies to anyone with a student or instructor account, and to visitors
          browsing the public catalog.
        </p>
        <p>
          This is a plain-language policy for the current product, not a substitute for legal advice — if
          LearnStream is deployed for real users and real payments, have it reviewed by counsel before launch,
          particularly the refund, liability, and governing-law terms in the{' '}
          <a href="/terms">Terms &amp; Conditions</a>.
        </p>
      </LegalSection>

      <LegalSection id="information-we-collect" title="2. Information we collect">
        <p>
          <strong>Account &amp; profile.</strong> Name, email, password (stored only as a bcrypt hash, never in
          plain text), role (student or teacher), and optional profile details you add yourself: username,
          avatar and cover image, headline, bio, social links, language, phone number, interests, and
          onboarding answers. A signup is not a real account until you verify the one-time code we email you
          — until then it sits in a temporary, self-expiring record holding your email, hashed password, and a
          hashed (never plaintext) OTP.
        </p>
        <p>
          <strong>Course &amp; learning activity.</strong> Courses you author or enroll in, your wishlist, cart
          contents, lecture watch position and total watched time (used to compute course completion), which
          lectures and assignments you have completed, and any course review or rating you leave.
        </p>
        <p>
          <strong>Assignments.</strong> Files you submit for an assignment, when you submitted them, whether
          the submission was on time, and the grade and grading state once it is assessed.
        </p>
        <p>
          <strong>Payments.</strong> Course price, currency, and order status, plus the identifiers Razorpay
          returns for a transaction (order ID, payment ID, signature). We do not receive or store your card,
          UPI, or bank account details — those are handled entirely by Razorpay.
        </p>
        <p>
          <strong>Uploads.</strong> When you or your instructor upload a video, image, or file (course media,
          assignment files, lecture transcripts), we keep a short-lived record of the upload itself — file
          name, size, and type — to confirm it finished correctly. Media files are hosted by Cloudinary, our
          storage provider.
        </p>
        <p>
          <strong>Search activity.</strong> What you search for and how many results it returned, tied to an
          anonymous, rotating session identifier — never to your account or user ID. Search terms are also
          aggregated (e.g. &quot;how many times has anyone searched for this&quot;) without any per-person link.
        </p>
      </LegalSection>

      <LegalSection id="ai-features" title="3. AI features & the data they use">
        <p>
          Two features on LearnStream use AI to read course material and answer or assess based on it. Both
          are described here so this policy stays accurate as they roll out; if a feature below is not turned
          on for your course yet, no processing described for it happens until it is.
        </p>
        <p>
          <strong>Lecture chat assistant (retrieval-based Q&amp;A).</strong> While a lecture is playing, you can
          ask the assistant a question. The lecture&apos;s transcript is split into small passages and stored
          in a vector database as embeddings (a numeric representation of meaning, not the words themselves)
          scoped to that lecture and course. Your question is matched against those passages to find the most
          relevant ones, and both your question and the retrieved passages are sent to a third-party AI model
          to generate an answer. We log the question, which passages were retrieved, and the answer given, so
          we can measure and improve answer quality — never to build an advertising or behavioral profile of
          you.
        </p>
        <p>
          <strong>AI-assisted assignment grading.</strong> For an assignment an instructor enables this for, an
          AI model drafts a model answer sheet and rubric from the lecture transcripts and course material,
          which the instructor must review and approve before it is used — an unapproved answer key is never
          used to grade anyone. Once approved, your submission is compared against that answer sheet by an AI
          model, which proposes a grade and a rationale. Your instructor sees both and can override the grade
          before it is final; an AI-proposed grade is never released to you without having passed through this
          instructor-visible step.
        </p>
        <p>
          <strong>Where this data goes.</strong> Transcript passages, your questions, and your submissions sent
          to either feature are shared with the AI/embedding model provider that powers it, strictly to
          generate the response — not used by us or that provider to train models on your data, and not
          shared with any other student.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use-it" title="4. How we use your information">
        <ul>
          <li>To create and secure your account, and to tell student and instructor experiences apart.</li>
          <li>To run the core product: enrolling you in courses, tracking progress, serving lecture video, and accepting assignment submissions.</li>
          <li>To process payments and fulfil enrollment once Razorpay confirms a payment.</li>
          <li>To power the lecture chat assistant and AI-assisted grading described in Section 3, where enabled.</li>
          <li>To rank and suggest courses (trending and related searches), using only anonymized, non-attributable search activity.</li>
          <li>To send transactional email — signup verification codes, order confirmations, and similar account notices.</li>
          <li>To investigate abuse, enforce our Terms, and keep the platform secure.</li>
        </ul>
      </LegalSection>

      <LegalSection id="sharing" title="5. Who we share data with">
        <p>We do not sell your data. We share it only with the service providers that make LearnStream work:</p>
        <ul>
          <li><strong>Cloudinary</strong> — hosts lecture videos, course thumbnails, avatars, transcripts, and uploaded assignment files.</li>
          <li><strong>Razorpay</strong> — processes course payments; we never see or store your raw payment credentials.</li>
          <li><strong>Our email provider</strong> — delivers verification codes and account notices.</li>
          <li><strong>AI model and vector database providers</strong> — process transcript passages, chat questions, and assignment submissions solely to generate the responses described in Section 3.</li>
        </ul>
        <p>
          Within LearnStream itself, an instructor can see the enrollment, progress, submissions, and grades of
          students enrolled in their own course, and nothing beyond that; students never see another
          student&apos;s submissions, grades, or chat questions.
        </p>
        <p>We share data with law enforcement or regulators only when legally required to.</p>
      </LegalSection>

      <LegalSection id="retention" title="6. How long we keep data">
        <ul>
          <li><strong>Pending signups</strong> that never verify their email expire and are deleted automatically.</li>
          <li><strong>Search event logs</strong> (anonymous, session-based) are kept for 90 days, then deleted.</li>
          <li><strong>Upload sessions</strong> (the record of an in-progress file upload) are kept for 7 days — the file itself, once attached to a course or assignment, is retained as part of that course&apos;s or submission&apos;s data.</li>
          <li><strong>Account, course, submission, grade, and payment records</strong> are kept for as long as your account is active, plus a reasonable period afterward to meet financial and legal record-keeping obligations.</li>
          <li><strong>AI chat logs and grading rationales</strong> are kept for as long as needed to support the course and evaluate answer quality, and are deleted or anonymized on request as described in Section 9.</li>
        </ul>
      </LegalSection>

      <LegalSection id="cookies" title="7. Cookies & sessions">
        <p>
          We use a small number of cookies to keep you signed in: an access token and a refresh token, both set
          as httpOnly cookies your browser cannot read via JavaScript. We do not use third-party advertising or
          tracking cookies.
        </p>
      </LegalSection>

      <LegalSection id="security" title="8. Security">
        <p>
          Passwords are hashed with bcrypt and never stored or logged in plain text. Access to instructor and
          admin tooling is role-gated. Payment confirmation is verified against Razorpay&apos;s signed callback,
          not taken at face value from the browser. No system is perfectly secure, and we cannot guarantee
          absolute security, but we design storage and access around not holding more sensitive data than the
          product needs.
        </p>
      </LegalSection>

      <LegalSection id="your-rights" title="9. Your rights & choices">
        <ul>
          <li><strong>Access &amp; correction</strong> — most profile fields are editable directly from your account settings; for anything else, email us.</li>
          <li><strong>Deletion</strong> — you can request deletion of your account and associated personal data, subject to records we are required to keep (e.g. completed payment records).</li>
          <li><strong>Export</strong> — you can request a copy of the data we hold about you.</li>
          <li><strong>AI features</strong> — if you would rather not have your assignment submissions or lecture questions processed by the AI features in Section 3, contact us and we will route your grading through instructor-only review instead.</li>
        </ul>
        <p>
          Send any of the above to{' '}
          <a href="mailto:support@learnstream.app">support@learnstream.app</a>.
        </p>
      </LegalSection>

      <LegalSection id="children" title="10. Children's privacy">
        <p>
          LearnStream is intended for users old enough to independently form an account (13 and older, or the
          minimum age of digital consent in your country, whichever is higher). We do not knowingly collect
          data from children below that age; if you believe a child has created an account, contact us and we
          will remove it.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="11. Changes to this policy">
        <p>
          If we materially change what we collect or how we use it — especially expanding what the AI features
          in Section 3 do — we will update the &quot;last updated&quot; date above and, for significant changes,
          notify you directly.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="12. Contact us">
        <p>
          Questions, requests, or concerns about this policy: <a href="mailto:support@learnstream.app">support@learnstream.app</a>.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}

export default PrivacyPolicy;
