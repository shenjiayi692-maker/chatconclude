import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReviewHistory } from "@/lib/weekly";
import ReviewDisplay from "@/app/components/ReviewDisplay";
import { getLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

function formatWeek(weekStart: string, isEnglish: boolean) {
  const [, month, day] = weekStart.split("-");
  return isEnglish
    ? `Week of ${new Date(`${weekStart}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
    : `${Number(month)} 月 ${Number(day)} 日那周`;
}

export default async function HistoryPage() {
  const locale = await getLocale();
  const isEnglish = locale === "en";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/app/history");
  const reviews = await getReviewHistory(user.id, 52);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium text-zinc-500">{isEnglish ? "Previous weeks" : "过去的每一周"}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          {isEnglish ? "Review history" : "历史回顾"}
        </h1>
        <p className="text-sm leading-6 text-zinc-500">
          {isEnglish
            ? "Revisit each week's organized knowledge and quizzes. Original conversations are removed after weekly archiving according to the privacy policy."
            : "回看每周整理后的知识与 Quiz。跨周后，原始对话会按隐私规则清理。"}
        </p>
      </header>

      {reviews.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <p className="font-medium text-zinc-800 dark:text-zinc-200">
            {isEnglish ? "No review history yet" : "还没有历史回顾"}
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            {isEnglish ? "Your first completed weekly review will appear here." : "完成第一周的回顾后，它会出现在这里。"}
          </p>
          <Link
            href="/app"
            className="mt-5 inline-flex rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isEnglish ? "Back to this week" : "返回本周"}
          </Link>
        </section>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <details
              key={review.weekStart}
              className="rounded-2xl border border-zinc-200 bg-white p-5 open:shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            >
              <summary className="cursor-pointer list-none">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatWeek(review.weekStart, isEnglish)}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  {isEnglish
                    ? `${review.itemCount} item${review.itemCount === 1 ? "" : "s"}`
                    : `${review.itemCount} 条内容`}
                </p>
              </summary>
              <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
                <ReviewDisplay result={{ review: review.review, filtered: [], quiz: review.quiz }} />
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
