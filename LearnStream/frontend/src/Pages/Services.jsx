import { Link } from "react-router-dom";

const studentServices = [
  {
    title: "Browse & enroll in courses",
    description: "Explore courses across categories like Web Development, Data Science, Business, and more.",
  },
  {
    title: "Track your progress",
    description: "See how much of each course you've completed, lecture by lecture and assignment by assignment.",
  },
  {
    title: "Submit assignments",
    description: "Upload your work directly against each assignment and keep track of what you've submitted.",
  },
];

const teacherServices = [
  {
    title: "Build structured courses",
    description: "Organize your content into modules, each with its own lectures and assignments.",
  },
  {
    title: "Upload video lectures",
    description: "Add video lectures to any module for your students to watch at their own pace.",
  },
  {
    title: "Review student work",
    description: "See who's submitted what for each assignment and review their uploaded files.",
  },
];

const ServiceColumn = ({ title, items }) => (
  <div>
    <h2 className="text-2xl font-bold mb-6">{title}</h2>
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.title} className="rounded-lg border p-5 shadow-sm">
          <h3 className="font-semibold text-lg mb-1">{item.title}</h3>
          <p className="text-gray-600">{item.description}</p>
        </div>
      ))}
    </div>
  </div>
);

const Services = () => {
  return (
    <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-16">
      <h1 className="text-3xl sm:text-4xl font-extrabold mb-4">What LearnStream Offers</h1>
      <p className="text-gray-600 mb-12 max-w-2xl">
        Whether you&apos;re here to learn or to teach, LearnStream gives you the
        tools to do it well.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <ServiceColumn title="For Students" items={studentServices} />
        <ServiceColumn title="For Teachers" items={teacherServices} />
      </div>
      <div className="mt-12">
        <Link
          to="/login"
          className="rounded bg-[#588157] px-6 py-3 text-sm font-medium text-white shadow hover:bg-[#137dc7]"
        >
          Get Started
        </Link>
      </div>
    </div>
  );
};

export default Services;
