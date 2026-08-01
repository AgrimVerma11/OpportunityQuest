import Avatar from "./Avatar";
import Badge from "./Badge";
import { IconLocation } from "./Icons";
import "./ProfileView.css";

// Read-only, role-aware presentation of a user's profile. Shared by the
// faculty's applicant review and the student's view of a faculty member.
export default function ProfileView({ profile }) {
  if (!profile) return null;

  // Faculty and coordinators share the professional (faculty-style) layout;
  // students get the student layout.
  const isFacultyLike =
    profile.role === "Faculty" || profile.role === "Coordinator";
  const displayName =
    isFacultyLike && profile.prefix ? `${profile.prefix} ${profile.name}` : profile.name;

  const subline = isFacultyLike
    ? [profile.department, profile.designation].filter(Boolean).join(" · ")
    : [profile.branch, profile.year ? `Year ${profile.year}` : ""]
        .filter(Boolean)
        .join(" · ");

  return (
    <div className="profile-view">
      <div className="pv-head">
        <Avatar name={profile.name} image={profile.profileImage} size={64} />
        <div className="pv-head-text">
          <h3 className="pv-name">{displayName}</h3>
          <div className="pv-sub">
            <Badge tone="primary">{profile.role}</Badge>
            {subline && <span className="pv-subline">{subline}</span>}
          </div>
          {isFacultyLike && profile.office && (
            <div className="pv-office">
              <IconLocation /> {profile.office}
            </div>
          )}
        </div>
      </div>

      {isFacultyLike ? (
        <>
          {profile.interests && (
            <Section label="Research Interests">
              <p>{profile.interests}</p>
            </Section>
          )}
          {profile.bio && (
            <Section label="About">
              <p className="pv-bio">{profile.bio}</p>
            </Section>
          )}
        </>
      ) : (
        <>
          {profile.skills?.length > 0 && (
            <Section label="Skills">
              <div className="pv-chips">
                {profile.skills.map((s, i) => (
                  <span className="pv-chip" key={i}>
                    {s}
                  </span>
                ))}
              </div>
            </Section>
          )}
          {profile.society?.name && (
            <Section label="Society / Club">
              <p>
                {profile.society.name}
                {profile.society.position ? ` · ${profile.society.position}` : ""}
              </p>
            </Section>
          )}
          {profile.interests && (
            <Section label="Areas of Interest">
              <p>{profile.interests}</p>
            </Section>
          )}
          {profile.projects?.length > 0 && (
            <Section label="Projects">
              {profile.projects.map((p, i) => (
                <div className="pv-project" key={i}>
                  <strong>{p.title}</strong>
                  {p.description && <p>{p.description}</p>}
                </div>
              ))}
            </Section>
          )}
          {profile.bio && (
            <Section label="About">
              <p className="pv-bio">{profile.bio}</p>
            </Section>
          )}
        </>
      )}

      {profile.linkedinUrl && (
        <a
          className="pv-linkedin"
          href={profile.linkedinUrl}
          target="_blank"
          rel="noreferrer"
        >
          LinkedIn profile →
        </a>
      )}
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div className="pv-section">
      <span className="pv-label">{label}</span>
      {children}
    </div>
  );
}
