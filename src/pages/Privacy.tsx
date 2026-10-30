export default function Privacy() {
  return (
    <div className="container section" style={{ maxWidth: 760 }}>
      <h1 style={{ letterSpacing: '-0.02em' }}>Privacy policy</h1>
      <p className="muted">Last updated: 30 October 2026. This page describes what the NagarTrace website actually does with data today - no promises beyond the current product.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> your email address, used only to sign you in (password or email link). If Google sign-in is enabled, Google shares your basic profile with the sign-in service.</li>
        <li><strong>Reports you file:</strong> the description you write, the photo you attach, the location and time captured with the report, and the ward you enter.</li>
        <li><strong>Activity:</strong> points, badges and streaks derived from your verified activity, shown under your public alias - never your real name.</li>
      </ul>

      <h2>Who can see what</h2>
      <ul>
        <li><strong>Public:</strong> non-private report fields (category, status, ward, timeline) and leaderboard aliases with points.</li>
        <li><strong>Photos:</strong> visible only to the issue's participants - the reporter, the verifying officer, and the assigned organisation. You can strip photo metadata (camera, exact GPS) before upload; the form shows you what it found on your device first.</li>
        <li><strong>Email address:</strong> never shown publicly.</li>
      </ul>

      <h2>Where data lives</h2>
      <ul>
        <li>Accounts and session tokens: Supabase Auth (ap-south-1 region). Your session token stays in your browser's local storage; this site sets no tracking cookies.</li>
        <li>Reports, photos and points: the NagarTrace API and its database (hosted on Render/Supabase free tiers).</li>
        <li>Photo metadata check runs on your device; metadata is not uploaded unless you keep it in the photo.</li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>No advertising, no analytics trackers, no sale of personal data.</li>
        <li>No complaint is sent to any real authority from this app; it is a working prototype, not a government service.</li>
        <li>No marketing emails. Email is used only for sign-in and account verification.</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>Choose any public alias - your real name is never required for public display.</li>
        <li>Strip photo metadata before upload (checkbox in the report form).</li>
        <li>To delete your account or a report, contact the team through the project repository below; deletion is manual while the project is in prototype stage.</li>
      </ul>

      <h2>Contact</h2>
      <p className="muted">
        NagarTrace is built by Team Grexars. For privacy questions or deletion requests, open an issue at{' '}
        <a href="https://github.com/KhuranaCode/nagartrace-api" target="_blank" rel="noreferrer">github.com/KhuranaCode/nagartrace-api</a>.
      </p>

      <p className="small-note">This policy covers only the current prototype and will be updated if data practices change.</p>
    </div>
  )
}
