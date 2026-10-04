import Link from "next/link";
import ReviewerTest from "./ReviewerTest";

export default function ReviewPage() {
  return <main className="review-page">
    <header className="review-hero">
      <div>
        <p className="eyebrow">Friends Included Ltd · live verification</p>
        <h1>Professor test route</h1>
        <p>This guided test uses the deployed Supabase database, public Google Sheets ledger, and real Telegram bot. No credentials are requested or exposed.</p>
      </div>
      <Link className="back-link" href="/">← Finance workspace</Link>
    </header>
    <ReviewerTest />
  </main>;
}
