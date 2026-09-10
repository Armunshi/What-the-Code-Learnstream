const Contact = () => {
  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-16">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">Contact Us</h1>
      <p className="text-gray-600 mb-8 max-w-2xl">
        Have a question, found a bug, or want to talk about a course? Reach
        out and we&apos;ll get back to you.
      </p>

      <div className="rounded-lg border p-6 shadow-sm max-w-md space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase">Email</h2>
          <a
            href="mailto:support@learnstream.app"
            className="text-lg text-[#588157] hover:underline"
          >
            support@learnstream.app
          </a>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase">Response time</h2>
          <p className="text-gray-700">We usually reply within 1-2 business days.</p>
        </div>
      </div>
    </div>
  );
};

export default Contact;
