export default function Privacy() {
  return (
    <div className="container section" style={{ maxWidth: 760 }}>
      <h1 style={{ letterSpacing: '-0.02em' }}>Privacy policy</h1>
      <p className="muted">Last updated: 30 October 2026. NagarTrace is a student-built working prototype (Team Grexars), not a government service. This page describes what the product actually does with data today.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Sign-in:</strong> your email address is handled by Supabase Auth (ap-south-1 region) to sign you in by password or email link. If Google sign-in is enabled, Google shares your name and email with Supabase Auth. The NagarTrace database itself stores only an issuer/subject identifier, a generated or chosen public alias (which may be your real name if you choose it), your optional ward, points and account creation time - not your email or name.</li>
        <li><strong>Reports you file:</strong> the issue type and note you write, GPS location with accuracy, the time, and the photo you attach.</li>
        <li><strong>Activity:</strong> points, badges and - when enabled - streaks, all derived from your activity and shown under your public alias.</li>
      </ul>

      <h2>Who can see what</h2>
      <ul>
        <li><strong>Public issue board:</strong> issue type, status, severity, ward, deadline and counts, with location rounded to about 11 metres. Never your identity, your photos or your notes.</li>
        <li><strong>Leaderboard (signed in):</strong> alias, ward and points only.</li>
        <li><strong>Photos:</strong> visible only to the reporter/uploader, responsible organisation staff and assigned reviewers. Staff handling the issue see its exact location.</li>
        <li><strong>Email address:</strong> never shown publicly.</li>
      </ul>

      <h2>Photos and metadata</h2>
      <ul>
        <li>The report form can check photo metadata (time, GPS, camera) on your device before upload; that check never leaves your browser.</li>
        <li>On upload the server re-encodes photos as JPEG and drops EXIF metadata. Faces and number plates are not blurred - do not upload photos you are not comfortable sharing with the issue's reviewers.</li>
      </ul>

      <h2>Where data lives</h2>
      <ul>
        <li>Database and private photo bucket: Supabase. API: Render. Website: GitHub Pages.</li>
        <li>Your sign-in session token is kept in your browser's local storage. This site sets no tracking cookies and runs no analytics or advertising trackers.</li>
      </ul>

      <h2>What we do not do</h2>
      <ul>
        <li>No complaint is sent to any real authority from this app.</li>
        <li>No third-party AI processes your photos.</li>
        <li>The app currently sends email only for sign-in and account verification.</li>
      </ul>

      <h2>Records and deletion</h2>
      <ul>
        <li>Points and status history are append-only audit records.</li>
        <li>There is no self-service deletion yet. To request deletion of your account or a report, email the contact below; requests are handled manually with no guaranteed timeline.</li>
        <li>Test data is kept in a hidden test cohort and never shown on public boards.</li>
      </ul>

      <h2>Contact</h2>
      <p className="muted">
        Privacy questions and deletion requests: <a href="mailto:aadityakhurana55555@gmail.com">aadityakhurana55555@gmail.com</a> (Team Grexars).
      </p>

      <p className="small-note">This policy covers only the current prototype and will be updated if data practices change.</p>
    </div>
  )
}
