// Static category → subcategory → topic taxonomy (D3 "Classification").
//
// This is deliberately a plain object, not a DB collection: the plan (D3)
// treats category/subcategory/topics as slugs stored on the course document,
// and `migrate-w0-course-status-metadata.js` needs a fixed list to backfill
// against. A later lane can promote this to a DB-backed registry without
// changing the slugs below — course documents already only store the slug
// strings, never a reference into this file.
//
// Slugs are the wire format everywhere (course.category, course.subcategory,
// course.topics[]) — see docs/contracts/domain-model.md D3 and dto.md's
// CourseCardDTO `category`/`subcategory` fields.

export const TAXONOMY = Object.freeze([
  {
    slug: "development",
    label: "Development",
    subcategories: [
      {
        slug: "web-development",
        label: "Web Development",
        topics: ["javascript", "react", "nodejs", "html-css", "typescript"],
      },
      {
        slug: "mobile-development",
        label: "Mobile Development",
        topics: ["android", "ios", "react-native", "flutter"],
      },
      {
        slug: "programming-languages",
        label: "Programming Languages",
        topics: ["python", "java", "c-plus-plus", "go", "rust"],
      },
      {
        slug: "databases",
        label: "Databases",
        topics: ["mongodb", "postgresql", "mysql", "redis"],
      },
      {
        slug: "software-testing",
        label: "Software Testing",
        topics: ["unit-testing", "e2e-testing", "test-automation"],
      },
    ],
  },
  {
    slug: "business",
    label: "Business",
    subcategories: [
      {
        slug: "entrepreneurship",
        label: "Entrepreneurship",
        topics: ["startups", "business-plans", "fundraising"],
      },
      {
        slug: "finance",
        label: "Finance",
        topics: ["accounting", "investing", "financial-analysis"],
      },
      {
        slug: "management",
        label: "Management",
        topics: ["leadership", "project-management", "operations"],
      },
      {
        slug: "sales",
        label: "Sales",
        topics: ["sales-skills", "negotiation", "crm"],
      },
    ],
  },
  {
    slug: "design",
    label: "Design",
    subcategories: [
      {
        slug: "ui-ux-design",
        label: "UI/UX Design",
        topics: ["figma", "user-research", "wireframing", "prototyping"],
      },
      {
        slug: "graphic-design",
        label: "Graphic Design",
        topics: ["photoshop", "illustrator", "branding"],
      },
      {
        slug: "3d-animation",
        label: "3D & Animation",
        topics: ["blender", "motion-graphics"],
      },
    ],
  },
  {
    slug: "marketing",
    label: "Marketing",
    subcategories: [
      {
        slug: "digital-marketing",
        label: "Digital Marketing",
        topics: ["seo", "social-media-marketing", "content-marketing"],
      },
      {
        slug: "branding",
        label: "Branding",
        topics: ["brand-strategy", "market-research"],
      },
      {
        slug: "analytics",
        label: "Analytics",
        topics: ["google-analytics", "growth-hacking"],
      },
    ],
  },
  {
    slug: "it-and-software",
    label: "IT & Software",
    subcategories: [
      {
        slug: "it-certifications",
        label: "IT Certifications",
        topics: ["comptia", "cisco", "aws-certified"],
      },
      {
        slug: "network-and-security",
        label: "Network & Security",
        topics: ["cybersecurity", "ethical-hacking", "networking-basics"],
      },
      {
        slug: "cloud-computing",
        label: "Cloud Computing",
        topics: ["aws", "azure", "gcp", "devops"],
      },
      {
        slug: "operating-systems",
        label: "Operating Systems",
        topics: ["linux", "windows-server"],
      },
    ],
  },
]);

/** Every valid category slug, e.g. for a zod enum. */
export const CATEGORY_SLUGS = TAXONOMY.map((category) => category.slug);

/** category slug -> Set of valid subcategory slugs under it. */
export const SUBCATEGORY_SLUGS_BY_CATEGORY = Object.freeze(
  Object.fromEntries(
    TAXONOMY.map((category) => [
      category.slug,
      new Set(category.subcategories.map((sub) => sub.slug)),
    ])
  )
);

/** Every valid topic slug across the whole taxonomy, flattened. */
export const TOPIC_SLUGS = Object.freeze(
  TAXONOMY.flatMap((category) => category.subcategories.flatMap((sub) => sub.topics))
);

export const findCategory = (slug) => TAXONOMY.find((category) => category.slug === slug);
