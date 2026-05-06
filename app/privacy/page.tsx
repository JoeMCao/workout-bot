import { SiteChrome } from "@/components/dashboard/SiteChrome";

export default function PrivacyPage() {
  return (
    <SiteChrome
      eyebrow="Privacy"
      title="Personal fitness analytics"
      description="How workout data is used in this app."
    >
      <section className="card">
        <h2>Data Use</h2>
        <p>This application is for personal fitness analytics and workout insights.</p>
        <p>No data is sold to third parties.</p>
        <p>
          Workout data is only used for user-requested analytics and visualization.
        </p>
      </section>
    </SiteChrome>
  );
}
