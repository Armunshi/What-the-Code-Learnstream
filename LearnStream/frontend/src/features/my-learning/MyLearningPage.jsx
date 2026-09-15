import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyLearning } from "./api";

const TABS = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

function CourseCard({ course }) {
  const resumeHref = course.resumeItemId
    ? `/learn/${course.courseId}/items/${course.resumeItemId}`
    : `/learn/${course.courseId}`;

  return (
    <Card data-testid="my-learning-card">
      <CardHeader>
        <CardTitle className="line-clamp-2 text-base">{course.title}</CardTitle>
        {course.authorName && <p className="text-xs text-muted-foreground">{course.authorName}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {/* L-FR-4.2: no price at all on an owned course — nothing renders
            here for it, rather than the page being trusted to hide a field
            it was handed. */}
        <Progress value={course.percentComplete} data-testid="my-learning-progress" />
        <p className="text-xs text-muted-foreground">{Math.round(course.percentComplete)}% complete</p>
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        {course.status === "completed" ? (
          <Badge data-testid="my-learning-status">Completed</Badge>
        ) : (
          <Badge variant="secondary" data-testid="my-learning-status">
            {course.status === "in_progress" ? "In progress" : "Not started"}
          </Badge>
        )}
        <Button asChild size="sm" data-testid="my-learning-resume">
          <Link to={resumeHref}>{course.status === "not_started" ? "Start" : "Resume"}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export function MyLearningPage() {
  const [activeTab, setActiveTab] = useState("all");
  const { data: courses, isLoading, isError } = useQuery({
    queryKey: ["my-learning"],
    queryFn: getMyLearning,
  });

  const filtered = useMemo(() => {
    if (!courses) return [];
    if (activeTab === "all") return courses;
    return courses.filter((course) => course.status === activeTab);
  }, [courses, activeTab]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6" data-testid="my-learning-page">
      <h1 className="text-2xl font-semibold">My Learning</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} data-testid={`my-learning-tab-${tab.value}`}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            {isLoading && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-40 w-full" />
                ))}
              </div>
            )}
            {isError && <p className="text-sm text-destructive">Couldn&apos;t load your courses.</p>}
            {!isLoading && !isError && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing here yet.</p>
            )}
            {!isLoading && !isError && filtered.length > 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((course) => (
                  <CourseCard key={course.courseId} course={course} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default MyLearningPage;
